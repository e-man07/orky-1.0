"""
Unified chat orchestrator — routes user messages to KB search or action execution.

When the user wants to perform an action (create incident, send Slack message, etc.),
this orchestrator discovers available app actions, gives them to Gemini as tools,
and executes the real actions via function calling.
"""

import json
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from google.genai import types

from models.app import App, AppAction
from models.user import User
from models.workflow import Workflow, WorkflowAgent, WorkflowExecution, StepExecution
from services.gemini import generate_with_tools, generate_with_tools_chat, generate_chat_response, generate_embedding
from services.action_executor import execute_action
from services.workflow_engine import run_workflow, resume_workflow
from services.rag.search import chat_history_search


@dataclass
class ActionTaken:
    app: str
    action: str
    input: dict[str, Any]
    output: Any = None
    success: bool = True
    error: str | None = None


@dataclass
class OrchestratorResult:
    response: str
    actions_taken: list[ActionTaken] = field(default_factory=list)
    error: str | None = None
    workflow_execution_id: int | None = None


async def _get_chat_context(db: AsyncSession, user_id: int, message: str) -> str:
    """Retrieve relevant past chat messages for context."""
    try:
        query_embedding = await generate_embedding(message, "RETRIEVAL_QUERY")
        results = await chat_history_search(db, user_id, query_embedding)
        if not results:
            return ""
        lines = ["Relevant context from past conversations:"]
        for r in results:
            role_label = "User" if r["role"] == "user" else "Assistant"
            lines.append(f"  [{r.get('sessionTitle', 'Untitled')}] {role_label}: {r['content'][:500]}")
        return "\n".join(lines)
    except Exception as e:
        print(f"[ORCHESTRATOR] Chat history lookup failed: {e}")
        return ""


async def _load_configured_apps(db: AsyncSession) -> list[App]:
    """Load all apps that have credentials configured, with their enabled actions."""
    result = await db.execute(
        select(App)
        .options(selectinload(App.actions))
        .where(App.credentials.isnot(None))
    )
    apps = result.scalars().all()
    # Filter to apps that have at least one enabled action and non-empty credentials
    return [
        app for app in apps
        if app.credentials and any(v for v in (app.credentials or {}).values())
        and any(a.is_enabled for a in app.actions)
    ]


def _build_function_declarations(apps: list[App]) -> tuple[list[types.FunctionDeclaration], dict[str, tuple[App, AppAction]]]:
    """Build Gemini function declarations from configured app actions.

    Returns:
        - list of FunctionDeclaration for Gemini
        - mapping of function_name -> (App, AppAction)
    """
    declarations = []
    action_map: dict[str, tuple[App, AppAction]] = {}

    for app in apps:
        for action in app.actions:
            if not action.is_enabled:
                continue

            # Use a unique name: app_slug__action_name
            func_name = f"{app.slug}__{action.name}"

            schema = action.input_schema or {}
            properties = schema.get("properties", {})
            required = schema.get("required", [])

            gemini_properties = {}
            for prop_name, prop_def in properties.items():
                prop_type = prop_def.get("type", "STRING").upper()
                desc = prop_def.get("description", "")
                if prop_type in ("STRING", ""):
                    gemini_properties[prop_name] = types.Schema(type="STRING", description=desc)
                elif prop_type in ("INTEGER", "NUMBER"):
                    gemini_properties[prop_name] = types.Schema(type="NUMBER", description=desc)
                elif prop_type == "BOOLEAN":
                    gemini_properties[prop_name] = types.Schema(type="BOOLEAN", description=desc)
                elif prop_type == "ARRAY":
                    gemini_properties[prop_name] = types.Schema(
                        type="ARRAY", description=desc, items=types.Schema(type="STRING")
                    )
                else:
                    gemini_properties[prop_name] = types.Schema(type="STRING", description=desc)

            declarations.append(types.FunctionDeclaration(
                name=func_name,
                description=f"[{app.name}] {action.display_name}: {action.description or action.name}",
                parameters=types.Schema(
                    type="OBJECT",
                    properties=gemini_properties,
                    required=required,
                ) if gemini_properties else None,
            ))
            action_map[func_name] = (app, action)

    return declarations, action_map


async def execute_chat_actions(
    db: AsyncSession,
    user: User,
    message: str,
    conversation_history: list[dict] | None = None,
) -> OrchestratorResult:
    """
    Handle a workflow/action intent from the chat.

    1. Load all configured apps + their actions
    2. Present them as Gemini tools
    3. Let Gemini decide which actions to call
    4. Execute the real actions
    5. Return a summary with action details
    """
    # Load configured apps
    apps = await _load_configured_apps(db)

    if not apps:
        return OrchestratorResult(
            response="I'd like to help with that action, but no apps are configured yet. "
                     "Please go to the **Apps** page to configure your integrations (ServiceNow, Jira, Slack, etc.), "
                     "then I'll be able to execute actions for you."
        )

    # Build function declarations
    declarations, action_map = _build_function_declarations(apps)

    if not declarations:
        return OrchestratorResult(
            response="No actions are available at the moment. Please configure app integrations on the **Apps** page."
        )

    # Fetch relevant past chat context
    chat_context = await _get_chat_context(db, user.id, message)

    # Build system prompt
    app_names = ", ".join(sorted(set(app.name for app in apps)))
    system_prompt = f"""You are ORKY, an AI assistant for enterprise employees. The user wants you to perform an action.

You have access to the following integrations: {app_names}.

Guidelines:
- Use the available tools to fulfill the user's request.
- If the user's request is ambiguous, make reasonable assumptions rather than refusing.
- Fill in sensible defaults for optional fields (e.g., priority: "3 - Moderate", urgency: "3 - Low").
- After executing actions, provide a clear, friendly summary of what was done.
- If an action fails, explain what happened and suggest next steps.
- You may call multiple actions if the task requires it.
- Always respond in a helpful, professional tone.

User info:
- Name: {user.name}
- Email: {user.email}
- Department: {user.department or "N/A"}
- Title: {user.title or "N/A"}"""

    if chat_context:
        system_prompt += f"\n\n{chat_context}"

    tools = [types.Tool(function_declarations=declarations)]
    actions_taken: list[ActionTaken] = []

    try:
        # Build messages with conversation history
        contents: list[types.Content] = []
        if conversation_history:
            for msg in conversation_history[-6:]:
                role = "user" if msg.get("role") == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=message)]))

        # First call
        response = await generate_with_tools(system_prompt, message, tools)
        messages = list(contents)

        # Function calling loop (max 5 rounds)
        for _round in range(5):
            candidates = response.candidates
            if not candidates:
                break

            parts = candidates[0].content.parts or []
            function_calls = [p for p in parts if p.function_call]

            if not function_calls:
                # No more function calls — extract final text
                text_parts = [p for p in parts if p.text]
                final_text = "\n".join(p.text for p in text_parts) if text_parts else ""
                if final_text:
                    return OrchestratorResult(response=final_text, actions_taken=actions_taken)
                break

            # Add model response to messages
            messages.append(types.Content(role="model", parts=parts))

            # Process each function call
            function_response_parts = []
            for part in function_calls:
                fc = part.function_call
                func_name = fc.name
                func_args = dict(fc.args) if fc.args else {}

                mapping = action_map.get(func_name)
                if not mapping:
                    function_response_parts.append(types.Part(
                        function_response=types.FunctionResponse(
                            name=func_name,
                            response={"error": f"Unknown action: {func_name}"},
                        )
                    ))
                    continue

                app, app_action = mapping
                action_taken = ActionTaken(
                    app=app.slug,
                    action=app_action.name,
                    input=func_args,
                )

                # Execute the real action
                action_result = await execute_action(
                    app.slug,
                    app_action.name,
                    func_args,
                    dict(app.credentials or {}),
                )

                if action_result.success:
                    action_taken.output = action_result.result
                    action_taken.success = True
                else:
                    action_taken.error = action_result.error
                    action_taken.success = False

                actions_taken.append(action_taken)

                function_response_parts.append(types.Part(
                    function_response=types.FunctionResponse(
                        name=func_name,
                        response={"result": action_result.result} if action_result.success else {"error": action_result.error},
                    )
                ))

            # Send function results back to Gemini
            messages.append(types.Content(role="user", parts=function_response_parts))
            response = await generate_with_tools_chat(system_prompt, messages, tools)

        # Extract final response
        try:
            final_text = response.text or ""
        except Exception:
            final_text = ""

        if not final_text and actions_taken:
            # Gemini didn't produce text — build a summary
            lines = ["Here's what I did:\n"]
            for at in actions_taken:
                status = "completed" if at.success else "failed"
                lines.append(f"- **{at.app}** / `{at.action}` — {status}")
                if at.error:
                    lines.append(f"  - Error: {at.error}")
            final_text = "\n".join(lines)

        return OrchestratorResult(response=final_text, actions_taken=actions_taken)

    except Exception as e:
        return OrchestratorResult(
            response=f"I encountered an error while trying to execute that action: {str(e)}. Please try again.",
            actions_taken=actions_taken,
            error=str(e),
        )


async def workflow_requires_file(db: AsyncSession, workflow: Workflow) -> bool:
    """Check if any agent in the workflow uses actions that need a file (s3_bucket/s3_key params)."""
    from models.agent import Agent, AgentAction
    from models.app import AppAction

    # Load all agent IDs in this workflow
    agent_ids = [wa.agent_id for wa in workflow.agents]
    if not agent_ids:
        return False

    # Load the actions assigned to these agents
    result = await db.execute(
        select(AppAction)
        .join(AgentAction, AgentAction.action_id == AppAction.id)
        .where(AgentAction.agent_id.in_(agent_ids))
    )
    actions = result.scalars().all()

    for action in actions:
        schema = action.input_schema or {}
        props = schema.get("properties", {})
        if "s3_bucket" in props or "s3_key" in props:
            return True

    return False


async def match_workflow(db: AsyncSession, user: User, message: str) -> Workflow | None:
    """Check if user message matches any of the user's active workflows."""
    result = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == user.id, Workflow.status == "active")
        .options(selectinload(Workflow.agents).selectinload(WorkflowAgent.agent))
    )
    workflows = result.scalars().all()
    if not workflows:
        return None

    # Build workflow descriptions for Gemini
    wf_list = []
    for wf in workflows:
        agents = sorted(wf.agents, key=lambda a: a.step_order)
        agent_names = " → ".join(a.agent.name for a in agents if a.agent)
        wf_list.append(
            f"ID:{wf.id} | {wf.name} | {wf.description or 'No description'} | Steps: {agent_names}"
        )

    prompt = (
        "You are a workflow matcher. Given the user's request and available workflows, "
        "determine if any workflow matches.\n\n"
        f"Available workflows:\n{chr(10).join(wf_list)}\n\n"
        f'User request: "{message}"\n\n'
        "If a workflow matches, respond with ONLY the workflow ID number.\n"
        'If no workflow matches, respond with ONLY "none".'
    )

    response_text = await generate_chat_response("You are a workflow matcher.", prompt)
    response_text = response_text.strip().lower()

    if response_text == "none":
        return None

    # Extract ID
    try:
        wf_id = int(response_text.replace("id:", "").strip())
        return next((wf for wf in workflows if wf.id == wf_id), None)
    except (ValueError, StopIteration):
        return None


async def generate_workflow_summary(
    db: AsyncSession,
    execution_id: int,
    workflow_name: str,
    workflow_description: str | None,
    execution_status: str,
    message: str,
    user_id: int,
    conversation_history: list[dict] | None = None,
) -> tuple[str, list[ActionTaken]]:
    """Generate a Gemini-powered summary for a completed workflow execution.

    Returns (response_text, actions_taken) tuple.
    """
    import json as _json

    # Load step results with agent names
    step_result = await db.execute(
        select(StepExecution)
        .where(StepExecution.workflow_execution_id == execution_id)
        .options(selectinload(StepExecution.workflow_agent).selectinload(WorkflowAgent.agent))
        .order_by(StepExecution.step_order)
    )
    steps = step_result.scalars().all()

    actions_taken: list[ActionTaken] = []
    step_summaries = []

    for step in steps:
        agent_name = ""
        if step.workflow_agent and step.workflow_agent.agent:
            agent_name = step.workflow_agent.agent.name

        step_info = {
            "step": step.step_order,
            "agent": agent_name,
            "status": step.status,
            "actions": [],
            "error": step.error_message,
        }

        if step.actions_invoked:
            for action in step.actions_invoked:
                step_info["actions"].append({
                    "app": action.get("app", ""),
                    "action": action.get("action", ""),
                    "output": action.get("output"),
                })
                actions_taken.append(ActionTaken(
                    app=action.get("app", ""),
                    action=action.get("action", ""),
                    input=action.get("input", {}),
                    output=action.get("output"),
                    success=step.status == "completed",
                    error=step.error_message,
                ))

        if step.result and isinstance(step.result, dict):
            step_info["result"] = step.result

        step_summaries.append(step_info)

    chat_context = await _get_chat_context(db, user_id, message)

    summary_prompt = (
        f'You are ORKY, an AI assistant. A workflow just finished. '
        f'Write a SHORT, friendly summary for the user.\n\n'
        f'Workflow: {workflow_name}\n'
        f'Status: {execution_status}\n'
        f'User request: "{message}"\n\n'
        f'Step results (internal — do NOT expose to user):\n{_json.dumps(step_summaries, indent=2, default=str)}\n\n'
        f'Guidelines:\n'
        f'- Write 2-3 short paragraphs MAX. Be concise like a chat message, not a report.\n'
        f'- Do NOT list every step or agent name. The user does not need to know internal workflow details.\n'
        f'- Do NOT mention "automation", "workflow", "agents", "steps", Slack channel IDs, sys_ids, or any internal identifiers.\n'
        f'- DO mention key outcomes the user cares about: approval status, ticket numbers (e.g. INC0010005), amounts.\n'
        f'- If there are any URLs (e.g. ServiceNow incident links), format them as markdown links: [INC0010005](https://...)\n'
        f'- If a step failed, explain what went wrong in simple terms.\n'
        f'- Use markdown: **bold** for key info, proper paragraph spacing with blank lines between paragraphs.\n'
        f'- Tone: friendly, professional, like a helpful colleague giving you a quick update.'
    )

    if chat_context:
        summary_prompt += f'\n\n{chat_context}'

    try:
        response_text = await generate_chat_response(
            "You are ORKY, a friendly AI assistant. Give short, clear updates. Never mention internal details like agent names, step numbers, automation, Slack channel IDs, or sys_ids. Use markdown for formatting with proper paragraph spacing.",
            summary_prompt,
            conversation_history,
        )
    except Exception:
        lines = [f"**Workflow: {workflow_name}** — {execution_status}\n"]
        for s in step_summaries:
            lines.append(f"**Step {s['step']}** ({s['agent']}) — {s['status']}")
            if s.get("error"):
                lines.append(f"  - Error: {s['error']}")
        response_text = "\n".join(lines)

    return response_text, actions_taken


async def execute_workflow_from_chat(
    db: AsyncSession, user: User, workflow: Workflow, message: str,
    conversation_history: list[dict] | None = None,
) -> OrchestratorResult:
    """Trigger a workflow from chat, run synchronously, return results."""
    # Create execution record with user context injected
    execution = WorkflowExecution(
        workflow_id=workflow.id,
        user_id=user.id,
        status="pending",
        trigger_input=message,
        variables={
            "_user": {
                "name": user.name,
                "email": user.email,
                "department": user.department,
                "title": user.title,
            },
        },
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Run the workflow (synchronous — awaited)
    await run_workflow(execution.id)

    # Reload execution to check status
    await db.refresh(execution)

    # If paused awaiting file upload, summarize completed pre-checks and prompt user
    if execution.status == "awaiting_upload":
        step_result = await db.execute(
            select(StepExecution)
            .where(StepExecution.workflow_execution_id == execution.id)
            .options(selectinload(StepExecution.workflow_agent).selectinload(WorkflowAgent.agent))
            .order_by(StepExecution.step_order)
        )
        completed_steps = step_result.scalars().all()

        lines = [f"**{workflow.name}** — Pre-checks completed:\n"]
        for step in completed_steps:
            agent_name = step.workflow_agent.agent.name if step.workflow_agent and step.workflow_agent.agent else f"Step {step.step_order}"
            lines.append(f"- **{agent_name}** — {step.status}")
        lines.append("\nThe next step requires a file. Please attach your document using the 📎 button and send again to continue.")

        return OrchestratorResult(
            response="\n".join(lines),
            workflow_execution_id=execution.id,
        )

    # Use the shared summary generator
    response_text, actions_taken = await generate_workflow_summary(
        db=db,
        execution_id=execution.id,
        workflow_name=workflow.name,
        workflow_description=workflow.description,
        execution_status=execution.status,
        message=message,
        user_id=user.id,
        conversation_history=conversation_history,
    )

    return OrchestratorResult(
        response=response_text,
        actions_taken=actions_taken,
        workflow_execution_id=execution.id,
    )
