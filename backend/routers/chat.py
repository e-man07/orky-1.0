import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.knowledge import ChatSession, ChatMessage, Execution
from schemas.app import ChatInput
from services.gemini import classify_intent, generate_chat_response
from services.rag.pipeline import run_rag_pipeline
from services.chat_orchestrator import execute_chat_actions, match_workflow, execute_workflow_from_chat

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("")
async def send_chat_message(
    body: ChatInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.message:
        raise HTTPException(status_code=400, detail="Message is required")

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
    db.add(ChatMessage(session_id=session_id, role="user", content=body.message))

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
    import asyncio
    from services.gemini import generate_embedding
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
        # workflow/action intent — check for matching saved workflow first
        matched_workflow = await match_workflow(db, user, body.message)
        workflow_execution_id = None

        if matched_workflow:
            orchestrator_result = await execute_workflow_from_chat(
                db, user, matched_workflow, body.message
            )
            workflow_execution_id = orchestrator_result.workflow_execution_id
        else:
            orchestrator_result = await execute_chat_actions(
                db, user, body.message, conversation_history
            )

        response_text = orchestrator_result.response
        sources = []
        status = "action_completed" if orchestrator_result.actions_taken else "conversational"
        actions_taken = [
            {
                "app": a.app,
                "action": a.action,
                "input": a.input,
                "output": a.output,
                "success": a.success,
                "error": a.error,
            }
            for a in orchestrator_result.actions_taken
        ]

        execution.conversational_response = response_text
        execution.status = status

    # Save assistant message
    db.add(ChatMessage(
        session_id=session_id,
        role="assistant",
        content=response_text,
        sources=sources,
    ))

    await db.commit()

    result = {
        "response": response_text,
        "sources": sources,
        "status": status,
        "executionId": execution.id,
        "sessionId": session_id,
    }

    # Include actions_taken when workflow/action was executed
    if intent == "workflow":
        result["actionsTaken"] = actions_taken
        if workflow_execution_id:
            result["workflowExecutionId"] = workflow_execution_id

    return result


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
