import asyncio
import json
import time

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db, async_session
from middleware.auth import get_current_user
from models.user import User
from models.app import App
from models.knowledge import ChatSession, ChatMessage, Execution
from schemas.app import ChatInput
from services.gemini import classify_intent, generate_chat_response, generate_embedding
from models.workflow import Workflow
from services.rag.pipeline import run_rag_pipeline
from services.chat_orchestrator import (
    execute_chat_actions, match_workflow, execute_workflow_from_chat,
    generate_workflow_summary,
)
from services.workflow_engine import run_workflow, resume_workflow
from models.workflow import WorkflowExecution, StepExecution, WorkflowAgent

router = APIRouter(prefix="/api/chat", tags=["chat"])

# Band limits for mobile reimbursement confirmation messages
BAND_LIMITS = {
    "Associate": {"band": "L1", "monthly_mobile_limit": 800},
    "Senior Associate": {"band": "L2", "monthly_mobile_limit": 1000},
    "Analyst": {"band": "L3", "monthly_mobile_limit": 1200},
    "Senior Analyst": {"band": "L4", "monthly_mobile_limit": 1500},
    "Lead": {"band": "L5", "monthly_mobile_limit": 2000},
    "Manager": {"band": "L6", "monthly_mobile_limit": 2500},
    "Senior Manager": {"band": "L7", "monthly_mobile_limit": 3000},
    "Director": {"band": "L8", "monthly_mobile_limit": 4000},
    "Vice President": {"band": "L9", "monthly_mobile_limit": 5000},
    "Senior Vice President": {"band": "L10", "monthly_mobile_limit": 6000},
}


async def _generate_confirmation_message(user: User, workflow: Workflow) -> str:
    """Generate a confirmation message for a matched workflow using Gemini."""
    # Strip internal terms from the workflow name for user-facing messages
    friendly_name = (workflow.name or "").replace(" Automation", "").replace(" automation", "")

    # Only include band/allowance info for reimbursement-related workflows
    is_reimbursement = "reimburs" in (workflow.name or "").lower()

    user_context = (
        f"User: {user.name}\n"
        f"Title: {user.title or 'N/A'}\n"
        f"Department: {user.department or 'N/A'}\n"
    )

    band_hint = ""
    if is_reimbursement:
        band_info = BAND_LIMITS.get(user.title or "", {})
        band_label = band_info.get("band", "N/A")
        monthly_limit = band_info.get("monthly_mobile_limit")
        if band_label != "N/A":
            user_context += f"Band: {band_label}\n"
        if monthly_limit:
            user_context += f"Monthly mobile allowance: ₹{monthly_limit:,}\n"
            band_hint = f"- Mention the band and allowance naturally (e.g., 'As a {user.title} (Band {band_label}), your monthly mobile allowance is ₹{monthly_limit:,}.')\n"

    prompt = (
        f"You are ORKY, an AI assistant. The user wants to submit a request related to: \"{friendly_name}\".\n"
        f"Before starting, generate a short confirmation message (2-3 sentences max).\n\n"
        f"{user_context}\n"
        f"Request type: {friendly_name}\n"
        f"Description: {workflow.description or 'N/A'}\n\n"
        f"Guidelines:\n"
        f"- Greet the user by first name\n"
        f"{band_hint}"
        f"- Ask if they'd like to proceed\n"
        f"- Keep it concise and friendly\n"
        f"- Do NOT use markdown or bullet points, just a short conversational message\n"
        f"- Do NOT mention 'automation', 'workflow', 'agentic', 'agents', or any internal system terms\n"
        f"- Do NOT mention mobile allowance or reimbursement limits unless this is a reimbursement request"
    )

    try:
        return await generate_chat_response(
            "You are ORKY, a friendly AI assistant. Write short, clear confirmation messages. Never mention automation, workflows, agents, or internal system details.",
            prompt,
        )
    except Exception:
        # Fallback if Gemini fails
        return f"Hi {(user.name or 'there').split()[0]}! I can help you with your {friendly_name.lower()}. Would you like to proceed?"


async def _classify_confirmation(message: str) -> bool:
    """Use Gemini to classify if the user is confirming (yes) or declining (no)."""
    prompt = (
        f'The user was asked to confirm a workflow. They replied: "{message}"\n\n'
        f'Is this a confirmation (yes/proceed/sure/go ahead/ok) or a decline (no/cancel/stop/nevermind)?\n'
        f'Respond with ONLY "yes" or "no".'
    )
    try:
        response = await generate_chat_response(
            "You classify user replies as confirmations or declines. Respond with only 'yes' or 'no'.",
            prompt,
        )
        return response.strip().lower().startswith("yes")
    except Exception:
        # Fallback: simple keyword matching
        lower = message.lower().strip()
        yes_words = {"yes", "yeah", "yep", "sure", "ok", "okay", "proceed", "go", "go ahead", "y", "do it", "start"}
        return any(w in lower for w in yes_words)


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload a file (invoice image/PDF) to S3 for use in chat workflows."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    max_size = 10 * 1024 * 1024  # 10 MB
    contents = await file.read()
    if len(contents) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 10 MB)")

    timestamp = int(time.time())
    safe_filename = file.filename.replace("/", "_").replace("\\", "_")
    s3_key = f"invoices/{user.id}/{timestamp}_{safe_filename}"

    # Try to upload to S3 using the configured AWS app credentials
    try:
        result = await db.execute(
            select(App).where(App.slug == "aws")
        )
        aws_app = result.scalar_one_or_none()
        creds = aws_app.credentials if aws_app else None

        if creds and creds.get("access_key_id") and creds.get("secret_access_key"):
            from clients.aws import AWSClient
            client = AWSClient(
                creds["access_key_id"],
                creds["secret_access_key"],
                creds.get("region", "us-east-1"),
            )
            bucket = creds.get("s3_bucket", "orky-uploads")
            content_type = file.content_type or "application/octet-stream"
            await asyncio.to_thread(
                client.s3.put_object,
                Bucket=bucket,
                Key=s3_key,
                Body=contents,
                ContentType=content_type,
            )
            return {
                "s3_bucket": bucket,
                "s3_key": s3_key,
                "filename": file.filename,
                "file_size": len(contents),
            }
        else:
            # Fallback mock response for demo when AWS is not configured
            return {
                "s3_bucket": "orky-uploads-demo",
                "s3_key": s3_key,
                "filename": file.filename,
                "file_size": len(contents),
                "mock": True,
            }
    except Exception as e:
        # Fallback mock on any AWS error so demo still works
        print(f"[UPLOAD] S3 upload failed, using mock: {e}")
        return {
            "s3_bucket": "orky-uploads-demo",
            "s3_key": s3_key,
            "filename": file.filename,
            "file_size": len(contents),
            "mock": True,
        }


async def _embed_chat_messages(message_ids: list[int]):
    """Background task: generate and store embeddings for chat messages."""
    async with async_session() as db:
        for msg_id in message_ids:
            try:
                result = await db.execute(
                    select(ChatMessage).where(ChatMessage.id == msg_id)
                )
                msg = result.scalar_one_or_none()
                if not msg or msg.embedding is not None:
                    continue
                embedding = await generate_embedding(msg.content, "RETRIEVAL_DOCUMENT")
                msg.embedding = embedding
                await db.commit()
            except Exception as e:
                print(f"[EMBED] Failed to embed message {msg_id}: {e}")
                await db.rollback()


@router.post("")
async def send_chat_message(
    body: ChatInput,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.message:
        raise HTTPException(status_code=400, detail="Message is required")

    # Build file context string if attachment is present
    file_attachment = body.fileAttachment
    file_context = ""
    if file_attachment:
        file_context = (
            f"\n\n[Attached file: {file_attachment.get('filename', 'unknown')} "
            f"(stored at s3_bucket={file_attachment.get('s3_bucket')}, "
            f"s3_key={file_attachment.get('s3_key')}). "
            f"Use this file for any actions that require s3_bucket/s3_key parameters.]"
        )

    # Get or create chat session
    if body.sessionId:
        session_id = body.sessionId
    else:
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")
        chat_session = ChatSession(user_id=user.id, title=title)
        db.add(chat_session)
        await db.flush()
        session_id = chat_session.id

    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=body.message)
    db.add(user_msg)

    # Create execution
    execution = Execution(
        user_id=user.id,
        conversation_id=str(session_id),
        user_prompt=body.message,
        status="pending",
    )
    db.add(execution)
    await db.flush()

    # Classify intent + pre-generate embedding in parallel
    t0 = time.time()
    intent_task = asyncio.create_task(classify_intent(body.message))
    embedding_task = asyncio.create_task(generate_embedding(body.message, "RETRIEVAL_QUERY"))
    intent = await intent_task
    print(f"[CHAT] Intent: {intent} ({time.time() - t0:.1f}s)")
    conversation_history = body.conversationHistory or []

    if intent == "kb_query":
        # Run RAG pipeline with pre-computed embedding
        query_embedding = await embedding_task
        t1 = time.time()
        rag_result = await run_rag_pipeline(db, user.id, body.message, conversation_history, query_embedding=query_embedding)
        print(f"[CHAT] RAG pipeline done ({time.time() - t1:.1f}s) | Total: {time.time() - t0:.1f}s")
        response_text = rag_result["response"]
        sources = rag_result["sources"]
        status = rag_result["status"]

        execution.conversational_response = response_text
        execution.sources = sources
        execution.status = status

    elif intent == "conversational":
        embedding_task.cancel()
        response_text = await generate_chat_response(
            "You are ORKY, a friendly AI assistant for enterprise employees. Be helpful, concise, and professional.",
            body.message,
            conversation_history,
        )
        sources = []
        status = "conversational"

        execution.conversational_response = response_text
        execution.status = "conversational"

    else:
        embedding_task.cancel()
        workflow_execution_id = None

        # Augment message with file context for orchestrator
        augmented_message = body.message + file_context if file_context else body.message

        # Check for a paused workflow awaiting file upload
        paused_result = await db.execute(
            select(WorkflowExecution)
            .where(
                WorkflowExecution.user_id == user.id,
                WorkflowExecution.status == "awaiting_upload",
            )
            .order_by(WorkflowExecution.started_at.desc())
            .limit(1)
        )
        paused_execution = paused_result.scalar_one_or_none()

        if paused_execution and file_attachment:
            # Resume the paused workflow with the uploaded file
            await resume_workflow(paused_execution.id, file_attachment)

            # Reload and summarize results (same as execute_workflow_from_chat post-logic)
            await db.refresh(paused_execution)
            wf_result = await db.execute(
                select(WorkflowExecution)
                .where(WorkflowExecution.id == paused_execution.id)
                .options(selectinload(WorkflowExecution.workflow))
            )
            paused_execution = wf_result.scalar_one()

            step_result = await db.execute(
                select(StepExecution)
                .where(StepExecution.workflow_execution_id == paused_execution.id)
                .options(selectinload(StepExecution.workflow_agent).selectinload(WorkflowAgent.agent))
                .order_by(StepExecution.step_order)
            )
            steps = step_result.scalars().all()

            import json as _json
            step_summaries = []
            actions_taken = []
            for step in steps:
                agent_name = step.workflow_agent.agent.name if step.workflow_agent and step.workflow_agent.agent else ""
                step_info = {
                    "step": step.step_order, "agent": agent_name,
                    "status": step.status, "actions": [], "error": step.error_message,
                }
                if step.actions_invoked:
                    for action in step.actions_invoked:
                        step_info["actions"].append({"app": action.get("app", ""), "action": action.get("action", ""), "output": action.get("output")})
                        actions_taken.append({"app": action.get("app", ""), "action": action.get("action", ""), "input": action.get("input", {}), "output": action.get("output"), "success": step.status == "completed", "error": step.error_message})
                if step.result and isinstance(step.result, dict):
                    step_info["result"] = step.result
                step_summaries.append(step_info)

            summary_prompt = (
                f'You are ORKY, an AI assistant. A workflow just finished running (resumed after file upload). '
                f'Summarize the results for the user in a clear, friendly way.\n\n'
                f'Workflow: {paused_execution.workflow.name}\n'
                f'Overall status: {paused_execution.status}\n\n'
                f'Step results:\n{_json.dumps(step_summaries, indent=2, default=str)}\n\n'
                f'Guidelines:\n- Show each step with the agent name and what it did\n'
                f'- Highlight key outputs: ticket numbers, instance IDs, resource details\n'
                f'- If a step failed, explain the error clearly\n'
                f'- Use markdown formatting\n- Be concise but include all important details'
            )
            try:
                response_text = await generate_chat_response(
                    "You are ORKY, a friendly AI assistant that summarizes workflow execution results.",
                    summary_prompt, conversation_history,
                )
            except Exception:
                lines = [f"**Workflow: {paused_execution.workflow.name}** — {paused_execution.status}\n"]
                for s in step_summaries:
                    lines.append(f"**Step {s['step']}** ({s['agent']}) — {s['status']}")
                response_text = "\n".join(lines)

            workflow_execution_id = paused_execution.id
            sources = []
            status = "action_completed" if actions_taken else "conversational"
            execution.conversational_response = response_text
            execution.status = status

        elif paused_execution and not file_attachment:
            # Paused workflow exists but no file attached — remind user
            response_text = (
                "Your workflow is still waiting for a document. "
                "Please attach your file using the 📎 button and send again to continue."
            )
            sources = []
            status = "conversational"
            actions_taken = []
            workflow_execution_id = paused_execution.id
            execution.conversational_response = response_text
            execution.status = status

        else:
            # No paused workflow — normal flow: match or execute ad-hoc actions
            matched_workflow = await match_workflow(db, user, body.message)

            if matched_workflow:
                orchestrator_result = await execute_workflow_from_chat(
                    db, user, matched_workflow, augmented_message, conversation_history
                )
                workflow_execution_id = orchestrator_result.workflow_execution_id
            else:
                orchestrator_result = await execute_chat_actions(
                    db, user, augmented_message, conversation_history
                )

            response_text = orchestrator_result.response
            sources = []
            status = "action_completed" if orchestrator_result.actions_taken else "conversational"
            actions_taken = [
                {
                    "app": a.app, "action": a.action, "input": a.input,
                    "output": a.output, "success": a.success, "error": a.error,
                }
                for a in orchestrator_result.actions_taken
            ]
            execution.conversational_response = response_text
            execution.status = status

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session_id,
        role="assistant",
        content=response_text,
        sources=sources,
    )
    db.add(assistant_msg)

    await db.commit()

    # Embed messages in background (non-blocking)
    msg_ids = [m.id for m in [user_msg, assistant_msg] if m.id]
    if msg_ids:
        background_tasks.add_task(_embed_chat_messages, msg_ids)

    result = {
        "response": response_text,
        "sources": sources,
        "status": status,
        "executionId": execution.id,
        "sessionId": session_id,
    }

    # Include actions_taken and workflow ID when workflow/action was executed
    if intent not in ("kb_query", "conversational"):
        result["actionsTaken"] = actions_taken
        if workflow_execution_id:
            result["workflowExecutionId"] = workflow_execution_id

    return result


@router.post("/stream")
async def stream_chat_message(
    body: ChatInput,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """SSE streaming endpoint for chat — streams workflow progress events in real time."""
    if not body.message:
        raise HTTPException(status_code=400, detail="Message is required")

    file_attachment = body.fileAttachment
    file_context = ""
    if file_attachment:
        file_context = (
            f"\n\n[Attached file: {file_attachment.get('filename', 'unknown')} "
            f"(stored at s3_bucket={file_attachment.get('s3_bucket')}, "
            f"s3_key={file_attachment.get('s3_key')}). "
            f"Use this file for any actions that require s3_bucket/s3_key parameters.]"
        )

    # Get or create chat session
    chat_session = None
    if body.sessionId:
        session_id = body.sessionId
        # Load existing session to check for pending workflow confirmation
        sess_result = await db.execute(
            select(ChatSession).where(ChatSession.id == session_id)
        )
        chat_session = sess_result.scalar_one_or_none()
    else:
        title = body.message[:50] + ("..." if len(body.message) > 50 else "")
        chat_session = ChatSession(user_id=user.id, title=title)
        db.add(chat_session)
        await db.flush()
        session_id = chat_session.id

    # Save user message
    user_msg = ChatMessage(session_id=session_id, role="user", content=body.message)
    db.add(user_msg)

    # Create execution record
    execution = Execution(
        user_id=user.id,
        conversation_id=str(session_id),
        user_prompt=body.message,
        status="pending",
    )
    db.add(execution)
    await db.flush()

    conversation_history = body.conversationHistory or []
    augmented_message = body.message + file_context if file_context else body.message

    # ---- Check for pending workflow confirmation ----
    if chat_session and chat_session.pending_workflow_id:
        pending_wf_id = chat_session.pending_workflow_id
        is_confirmed = await _classify_confirmation(body.message)

        if is_confirmed:
            # User confirmed — load the workflow and start it
            print(f"[STREAM] User confirmed pending workflow {pending_wf_id}")
            wf_result = await db.execute(
                select(Workflow)
                .where(Workflow.id == pending_wf_id)
                .options(selectinload(Workflow.agents).selectinload(WorkflowAgent.agent))
            )
            confirmed_workflow = wf_result.scalar_one_or_none()

            # Retrieve the original message that triggered the workflow
            original_trigger_input = chat_session.pending_workflow_input or augmented_message

            # Clear the pending state
            chat_session.pending_workflow_id = None
            chat_session.pending_workflow_input = None
            await db.flush()

            if confirmed_workflow:
                # Create workflow execution and stream it
                wf_exec = WorkflowExecution(
                    workflow_id=confirmed_workflow.id,
                    user_id=user.id,
                    status="pending",
                    trigger_input=original_trigger_input,
                    variables={
                        "_user": {
                            "name": user.name,
                            "email": user.email,
                            "department": user.department,
                            "title": user.title,
                            "monthly_mobile_limit": BAND_LIMITS.get(user.title or "", {}).get("monthly_mobile_limit"),
                            "band": BAND_LIMITS.get(user.title or "", {}).get("band"),
                        },
                    },
                )
                db.add(wf_exec)
                await db.commit()
                await db.refresh(wf_exec)

                _execution_id = execution.id
                _session_id = session_id
                _user_msg_id = user_msg.id
                _wf_execution_id = wf_exec.id
                _wf_name = confirmed_workflow.name
                _wf_description = confirmed_workflow.description
                _message = body.message
                _user_id = user.id
                _conversation_history = conversation_history

                async def confirmed_wf_generator():
                    event_queue: asyncio.Queue = asyncio.Queue()

                    async def on_event(event_type: str, data: dict):
                        await event_queue.put({"type": event_type, "data": data})

                    async def run_wf():
                        try:
                            await run_workflow(_wf_execution_id, on_event=on_event)
                        except Exception as e:
                            await event_queue.put({"type": "step_failed", "data": {"step_order": -1, "agent_name": "", "error": str(e)}})
                        finally:
                            await event_queue.put(None)

                    wf_task = asyncio.create_task(run_wf())
                    while True:
                        event = await event_queue.get()
                        if event is None:
                            break
                        yield f"data: {json.dumps(event)}\n\n"
                        await asyncio.sleep(0.05)
                    await wf_task

                    try:
                        async with async_session() as summary_db:
                            exec_result = await summary_db.execute(
                                select(WorkflowExecution).where(WorkflowExecution.id == _wf_execution_id)
                            )
                            wf_exec_obj = exec_result.scalar_one()
                            response_text, actions_taken = await generate_workflow_summary(
                                db=summary_db, execution_id=_wf_execution_id,
                                workflow_name=_wf_name, workflow_description=_wf_description,
                                execution_status=wf_exec_obj.status, message=_message,
                                user_id=_user_id, conversation_history=_conversation_history,
                            )
                            actions_list = [
                                {"app": a.app, "action": a.action, "input": a.input,
                                 "output": a.output, "success": a.success, "error": a.error}
                                for a in actions_taken
                            ]
                            assistant_msg = ChatMessage(
                                session_id=_session_id, role="assistant",
                                content=response_text, sources=[],
                            )
                            summary_db.add(assistant_msg)
                            exec_record = await summary_db.execute(
                                select(Execution).where(Execution.id == _execution_id)
                            )
                            exc = exec_record.scalar_one_or_none()
                            if exc:
                                exc.conversational_response = response_text
                                exc.status = "action_completed" if actions_taken else "conversational"
                            await summary_db.commit()
                            asyncio.create_task(_embed_chat_messages_safe([_user_msg_id, assistant_msg.id]))
                            yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': [], 'status': 'action_completed' if actions_taken else 'conversational', 'executionId': _execution_id, 'sessionId': _session_id, 'actionsTaken': actions_list, 'workflowExecutionId': _wf_execution_id}})}\n\n"
                    except Exception as e:
                        print(f"[STREAM] Summary generation error: {e}")
                        yield f"data: {json.dumps({'type': 'response', 'data': {'response': f'Workflow completed but summary generation failed: {str(e)}', 'sources': [], 'status': 'action_completed', 'executionId': _execution_id, 'sessionId': _session_id, 'workflowExecutionId': _wf_execution_id}})}\n\n"

                return StreamingResponse(
                    confirmed_wf_generator(), media_type="text/event-stream",
                    headers={"Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
                )

        # User declined or workflow not found — clear pending state and respond normally
        chat_session.pending_workflow_id = None
        chat_session.pending_workflow_input = None
        response_text = "No problem! Let me know if there's anything else I can help with."
        execution.conversational_response = response_text
        execution.status = "conversational"
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text, sources=[])
        db.add(assistant_msg)
        await db.commit()

        async def declined_generator():
            yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': [], 'status': 'conversational', 'executionId': execution.id, 'sessionId': session_id}})}\n\n"

        return StreamingResponse(declined_generator(), media_type="text/event-stream")

    # ---- Check for paused workflow BEFORE intent classification ----
    # This must happen first because "Here is the attached document" gets classified
    # as conversational, but we need to resume the paused workflow instead.
    paused_result = await db.execute(
        select(WorkflowExecution)
        .where(
            WorkflowExecution.user_id == user.id,
            WorkflowExecution.status == "awaiting_upload",
        )
        .order_by(WorkflowExecution.started_at.desc())
        .limit(1)
    )
    paused_execution = paused_result.scalar_one_or_none()

    # If there's a paused workflow with a file, skip intent classification and resume
    if paused_execution and file_attachment:
        print(f"[STREAM] Resuming paused workflow execution {paused_execution.id}")
        # Jump directly to the workflow streaming block below
        intent = "action"
    elif paused_execution and not file_attachment:
        response_text = (
            "Your workflow is still waiting for a document. "
            "Please attach your file using the 📎 button and send again to continue."
        )
        execution.conversational_response = response_text
        execution.status = "conversational"
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text, sources=[])
        db.add(assistant_msg)
        await db.commit()

        async def paused_generator():
            yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': [], 'status': 'conversational', 'executionId': execution.id, 'sessionId': session_id, 'workflowExecutionId': paused_execution.id}})}\n\n"

        return StreamingResponse(paused_generator(), media_type="text/event-stream")

    else:
        # No paused workflow — classify intent normally
        t0 = time.time()
        intent_task = asyncio.create_task(classify_intent(body.message))
        embedding_task = asyncio.create_task(generate_embedding(body.message, "RETRIEVAL_QUERY"))
        intent = await intent_task
        print(f"[STREAM] Intent: {intent} ({time.time() - t0:.1f}s)")

        if intent == "kb_query":
            query_embedding = await embedding_task
            rag_result = await run_rag_pipeline(db, user.id, body.message, conversation_history, query_embedding=query_embedding)
            response_text = rag_result["response"]
            sources = rag_result["sources"]
            status = rag_result["status"]
            execution.conversational_response = response_text
            execution.sources = sources
            execution.status = status

            assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text, sources=sources)
            db.add(assistant_msg)
            await db.commit()

            msg_ids = [m.id for m in [user_msg, assistant_msg] if m.id]
            if msg_ids:
                background_tasks.add_task(_embed_chat_messages, msg_ids)

            async def kb_generator():
                yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': sources, 'status': status, 'executionId': execution.id, 'sessionId': session_id}})}\n\n"

            return StreamingResponse(kb_generator(), media_type="text/event-stream")

        if intent == "conversational":
            embedding_task.cancel()
            response_text = await generate_chat_response(
                "You are ORKY, a friendly AI assistant for enterprise employees. Be helpful, concise, and professional.",
                body.message, conversation_history,
            )
            execution.conversational_response = response_text
            execution.status = "conversational"

            assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text, sources=[])
            db.add(assistant_msg)
            await db.commit()

            msg_ids = [m.id for m in [user_msg, assistant_msg] if m.id]
            if msg_ids:
                background_tasks.add_task(_embed_chat_messages, msg_ids)

            async def conv_generator():
                yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': [], 'status': 'conversational', 'executionId': execution.id, 'sessionId': session_id}})}\n\n"

            return StreamingResponse(conv_generator(), media_type="text/event-stream")

        # Action/workflow intent — cancel embedding task
        embedding_task.cancel()

    # ---- Workflow streaming (new or resumed) ----
    matched_workflow = None
    if not (paused_execution and file_attachment):
        matched_workflow = await match_workflow(db, user, body.message)

    # If a NEW workflow matched, ask for confirmation instead of executing immediately
    if matched_workflow and not (paused_execution and file_attachment):
        confirmation_msg = await _generate_confirmation_message(user, matched_workflow)

        # Store pending workflow on the session
        if chat_session:
            chat_session.pending_workflow_id = matched_workflow.id
            chat_session.pending_workflow_input = augmented_message

        execution.conversational_response = confirmation_msg
        execution.status = "conversational"
        assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=confirmation_msg, sources=[])
        db.add(assistant_msg)
        await db.commit()

        msg_ids = [m.id for m in [user_msg, assistant_msg] if m.id]
        if msg_ids:
            background_tasks.add_task(_embed_chat_messages, msg_ids)

        async def confirmation_generator():
            yield f"data: {json.dumps({'type': 'response', 'data': {'response': confirmation_msg, 'sources': [], 'status': 'conversational', 'executionId': execution.id, 'sessionId': session_id}})}\n\n"

        return StreamingResponse(confirmation_generator(), media_type="text/event-stream")

    # If it's a resumed workflow (paused + file attachment), stream it
    if paused_execution and file_attachment:
        wf_execution_id = paused_execution.id
        # Load workflow name
        wf_result = await db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.id == paused_execution.id)
            .options(selectinload(WorkflowExecution.workflow))
        )
        pe = wf_result.scalar_one()
        wf_name = pe.workflow.name
        wf_description = pe.workflow.description

        # Commit user message before streaming
        await db.commit()

        # Capture values for the closure
        _execution_id = execution.id
        _session_id = session_id
        _user_msg_id = user_msg.id
        _wf_execution_id = wf_execution_id
        _wf_name = wf_name
        _wf_description = wf_description
        _message = body.message
        _augmented_message = augmented_message
        _user_id = user.id
        _conversation_history = conversation_history
        _file_attachment = file_attachment

        async def workflow_generator():
            event_queue: asyncio.Queue = asyncio.Queue()

            async def on_event(event_type: str, data: dict):
                await event_queue.put({"type": event_type, "data": data})

            async def run_wf():
                try:
                    await resume_workflow(_wf_execution_id, _file_attachment, on_event=on_event)
                except Exception as e:
                    await event_queue.put({"type": "step_failed", "data": {"step_order": -1, "agent_name": "", "error": str(e)}})
                finally:
                    await event_queue.put(None)  # Sentinel to stop the generator

            # Start workflow in background task
            wf_task = asyncio.create_task(run_wf())

            # Yield events as they arrive
            while True:
                event = await event_queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event)}\n\n"
                # Small sleep to ensure the browser processes each event separately
                # and React can re-render between events
                await asyncio.sleep(0.05)

            await wf_task  # Ensure task is fully done

            # Generate summary using its own DB session
            try:
                async with async_session() as summary_db:
                    # Reload execution status
                    exec_result = await summary_db.execute(
                        select(WorkflowExecution)
                        .where(WorkflowExecution.id == _wf_execution_id)
                    )
                    wf_exec = exec_result.scalar_one()

                    response_text, actions_taken = await generate_workflow_summary(
                        db=summary_db,
                        execution_id=_wf_execution_id,
                        workflow_name=_wf_name,
                        workflow_description=_wf_description,
                        execution_status=wf_exec.status,
                        message=_message,
                        user_id=_user_id,
                        conversation_history=_conversation_history,
                    )

                    actions_list = [
                        {"app": a.app, "action": a.action, "input": a.input,
                         "output": a.output, "success": a.success, "error": a.error}
                        for a in actions_taken
                    ]

                    # Save assistant message + update execution
                    assistant_msg = ChatMessage(
                        session_id=_session_id, role="assistant",
                        content=response_text, sources=[],
                    )
                    summary_db.add(assistant_msg)

                    exec_record = await summary_db.execute(
                        select(Execution).where(Execution.id == _execution_id)
                    )
                    exc = exec_record.scalar_one_or_none()
                    if exc:
                        exc.conversational_response = response_text
                        exc.status = "action_completed" if actions_taken else "conversational"

                    await summary_db.commit()

                    # Embed messages in background (fire and forget)
                    msg_ids = [_user_msg_id, assistant_msg.id]
                    asyncio.create_task(_embed_chat_messages_safe(msg_ids))

                    yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': [], 'status': 'action_completed' if actions_taken else 'conversational', 'executionId': _execution_id, 'sessionId': _session_id, 'actionsTaken': actions_list, 'workflowExecutionId': _wf_execution_id}})}\n\n"

            except Exception as e:
                print(f"[STREAM] Summary generation error: {e}")
                yield f"data: {json.dumps({'type': 'response', 'data': {'response': f'Workflow completed but summary generation failed: {str(e)}', 'sources': [], 'status': 'action_completed', 'executionId': _execution_id, 'sessionId': _session_id, 'workflowExecutionId': _wf_execution_id}})}\n\n"

        return StreamingResponse(
            workflow_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache, no-transform",
                "X-Accel-Buffering": "no",
                "Connection": "keep-alive",
            },
        )

    # ---- No workflow matched: ad-hoc action execution (non-streaming) ----
    orchestrator_result = await execute_chat_actions(
        db, user, augmented_message, conversation_history
    )
    response_text = orchestrator_result.response
    sources = []
    status = "action_completed" if orchestrator_result.actions_taken else "conversational"
    actions_taken = [
        {"app": a.app, "action": a.action, "input": a.input,
         "output": a.output, "success": a.success, "error": a.error}
        for a in orchestrator_result.actions_taken
    ]
    execution.conversational_response = response_text
    execution.status = status

    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=response_text, sources=sources)
    db.add(assistant_msg)
    await db.commit()

    msg_ids = [m.id for m in [user_msg, assistant_msg] if m.id]
    if msg_ids:
        background_tasks.add_task(_embed_chat_messages, msg_ids)

    async def action_generator():
        yield f"data: {json.dumps({'type': 'response', 'data': {'response': response_text, 'sources': sources, 'status': status, 'executionId': execution.id, 'sessionId': session_id, 'actionsTaken': actions_taken}})}\n\n"

    return StreamingResponse(action_generator(), media_type="text/event-stream")


async def _embed_chat_messages_safe(message_ids: list[int]):
    """Fire-and-forget version of embedding for use inside generators."""
    try:
        await _embed_chat_messages(message_ids)
    except Exception as e:
        print(f"[EMBED] Background embed error: {e}")


@router.get("/sessions")
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(30)
    )
    sessions = result.scalars().all()

    return [
        {
            "id": s.id,
            "title": s.title,
            "createdAt": s.created_at.isoformat() if s.created_at else None,
        }
        for s in sessions
    ]


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()

    return [
        {
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": m.sources,
            "createdAt": m.created_at.isoformat() if m.created_at else None,
        }
        for m in messages
    ]
