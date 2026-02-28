import json
from dataclasses import dataclass, field
from typing import Any

from google.genai import types

from services.gemini import generate_with_tools, generate_with_tools_chat
from services.action_executor import execute_action


@dataclass
class AgentActionInfo:
    action_name: str
    app_slug: str
    app_credentials: dict[str, Any]
    input_schema: dict[str, Any]


@dataclass
class AgentExecutionResult:
    thinking: str = ""
    actions_invoked: list[dict] = field(default_factory=list)
    result: Any = None
    error: str | None = None
    document_rejected: bool = False
    rejection_reason: str | None = None


async def execute_workflow_agent(
    agent_name: str,
    role: str,
    steps: str,
    model: str,
    actions: list[AgentActionInfo],
    task_prompt: str,
    variables: dict[str, Any],
) -> AgentExecutionResult:
    """Execute a workflow agent with Gemini function calling."""
    actions_invoked: list[dict] = []

    # Build system prompt
    parts = [f"You are {agent_name}, an AI agent in an automated workflow."]
    if role:
        parts.append(f"\nYour Role:\n{role}")
    if steps:
        parts.append(f"\nYour Steps:\n{steps}")
    if variables:
        parts.append(f"\nContext from previous steps:\n{json.dumps(variables, indent=2)}")
    parts.append("\nYou have access to tools/actions. Use them to accomplish your task.")
    parts.append("After completing your task, provide a clear summary of what you did and the results.")
    if variables.get("_file_attachment"):
        parts.append(
            "\nIMPORTANT: A document has been uploaded for this workflow. "
            "If at any point you find the document is missing required information "
            "(e.g. no GST/tax details on an invoice, missing vendor name, unreadable content, "
            "invalid data), you MUST call _reject_document with a clear reason. "
            "Do NOT proceed with made-up or zero values — reject the document instead."
        )
    system_prompt = "\n".join(parts)

    # Convert actions to Gemini function declarations
    function_declarations = []
    for a in actions:
        schema = a.input_schema or {}
        properties = schema.get("properties", {})
        required = schema.get("required", [])

        # Convert properties to Gemini Schema format
        gemini_properties = {}
        for prop_name, prop_def in properties.items():
            prop_type = prop_def.get("type", "STRING").upper()
            if prop_type == "STRING":
                gemini_properties[prop_name] = types.Schema(type="STRING", description=prop_def.get("description", ""))
            elif prop_type == "INTEGER" or prop_type == "NUMBER":
                gemini_properties[prop_name] = types.Schema(type="NUMBER", description=prop_def.get("description", ""))
            elif prop_type == "BOOLEAN":
                gemini_properties[prop_name] = types.Schema(type="BOOLEAN", description=prop_def.get("description", ""))
            elif prop_type == "ARRAY":
                gemini_properties[prop_name] = types.Schema(type="ARRAY", description=prop_def.get("description", ""), items=types.Schema(type="STRING"))
            else:
                gemini_properties[prop_name] = types.Schema(type="STRING", description=prop_def.get("description", ""))

        function_declarations.append(types.FunctionDeclaration(
            name=a.action_name,
            description=f"[{a.app_slug}] {a.action_name}",
            parameters=types.Schema(
                type="OBJECT",
                properties=gemini_properties,
                required=required,
            ) if gemini_properties else None,
        ))

    # Inject _reject_document for ANY agent when a file is attached in the workflow.
    # This allows validation agents (e.g. GSTIN verification) to reject bad invoices,
    # not just file-uploading agents.
    if variables.get("_file_attachment"):
        function_declarations.append(types.FunctionDeclaration(
            name="_reject_document",
            description=(
                "Call this if the uploaded document is invalid, missing required information "
                "(e.g. missing GST number, missing vendor details, unreadable), or doesn't match "
                "what's needed. This will pause the workflow and ask the user to upload a correct document. "
                "Provide a clear, user-friendly reason explaining what's wrong."
            ),
            parameters=types.Schema(
                type="OBJECT",
                properties={
                    "reason": types.Schema(
                        type="STRING",
                        description="Clear reason why the document was rejected and what the user should fix or upload instead.",
                    ),
                },
                required=["reason"],
            ),
        ))

    tools = [types.Tool(function_declarations=function_declarations)] if function_declarations else []

    try:
        # First call to Gemini
        result = await generate_with_tools(system_prompt, task_prompt, tools, model)
        response = result
        thinking = ""
        messages: list[types.Content] = [
            types.Content(role="user", parts=[types.Part(text=task_prompt)]),
        ]

        # Handle function calling loop (max 5 rounds)
        for _round in range(5):
            candidates = response.candidates
            if not candidates:
                break

            parts = candidates[0].content.parts or []
            function_calls = [p for p in parts if p.function_call]

            if not function_calls:
                # No more function calls - extract text
                text_parts = [p for p in parts if p.text]
                thinking = "\n".join(p.text for p in text_parts)
                break

            # Add model response to messages
            messages.append(types.Content(role="model", parts=parts))

            # Process each function call
            function_response_parts = []
            for part in function_calls:
                fc = part.function_call
                action_name = fc.name
                action_args = dict(fc.args) if fc.args else {}

                # Handle document rejection (synthetic function)
                if action_name == "_reject_document":
                    reason = action_args.get("reason", "The document was rejected.")
                    return AgentExecutionResult(
                        thinking=reason,
                        actions_invoked=actions_invoked,
                        document_rejected=True,
                        rejection_reason=reason,
                    )

                # Find matching action
                action_info = next((a for a in actions if a.action_name == action_name), None)
                if not action_info:
                    function_response_parts.append(types.Part(
                        function_response=types.FunctionResponse(
                            name=action_name,
                            response={"error": f"Unknown action: {action_name}"},
                        )
                    ))
                    continue

                # Execute the real action
                action_result = await execute_action(
                    action_info.app_slug,
                    action_name,
                    action_args,
                    action_info.app_credentials,
                )

                actions_invoked.append({
                    "action": action_name,
                    "app": action_info.app_slug,
                    "input": action_args,
                    "output": action_result.result if action_result.success else action_result.error,
                })

                function_response_parts.append(types.Part(
                    function_response=types.FunctionResponse(
                        name=action_name,
                        response={"result": action_result.result} if action_result.success else {"error": action_result.error},
                    )
                ))

            # Send function results back
            messages.append(types.Content(role="user", parts=function_response_parts))
            result = await generate_with_tools_chat(system_prompt, messages, tools, model)
            response = result

        # If we never got thinking text, extract from last response
        if not thinking:
            try:
                thinking = response.text or "Agent completed without text response."
            except Exception:
                thinking = "Agent completed without text response."

        # Gather action outputs as result
        if actions_invoked:
            result_data = {a["action"]: a["output"] for a in actions_invoked}
        else:
            result_data = {"summary": thinking}

        return AgentExecutionResult(thinking=thinking, actions_invoked=actions_invoked, result=result_data)

    except Exception as e:
        return AgentExecutionResult(actions_invoked=actions_invoked, error=str(e))
