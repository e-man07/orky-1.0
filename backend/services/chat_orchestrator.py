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
from services.gemini import generate_with_tools, generate_with_tools_chat
from services.action_executor import execute_action


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
