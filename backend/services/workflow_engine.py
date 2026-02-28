import os
import re
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.workflow import Workflow, WorkflowExecution, WorkflowAgent, StepExecution
from models.agent import Agent, AgentAction
from models.app import AppAction, App
from models.user import User
from services.agent_executor import execute_workflow_agent, AgentActionInfo

# Type alias for the optional event callback
OnEvent = Callable[[str, dict[str, Any]], Awaitable[None]] | None


async def _emit(on_event: OnEvent, event_type: str, data: dict[str, Any]) -> None:
    """Safely emit an event if callback is provided."""
    if on_event:
        try:
            await on_event(event_type, data)
        except Exception as e:
            print(f"[WORKFLOW] Event emission error ({event_type}): {e}")


def _step_requires_file(workflow_agent: WorkflowAgent) -> bool:
    """Check if any of this step's agent actions need a file (s3_bucket/s3_key params)."""
    for aa in workflow_agent.agent.actions:
        schema = aa.action.input_schema or {}
        props = schema.get("properties", {})
        if "s3_bucket" in props or "s3_key" in props:
            return True
    return False


def _build_actions_summary(actions_invoked: list[dict] | None) -> list[dict[str, str]]:
    """Extract compact app/action pairs from actions_invoked list."""
    if not actions_invoked:
        return []
    return [
        {"app": a.get("app", ""), "action": a.get("action", "")}
        for a in actions_invoked
    ]


def _get_agent_apps(wa: WorkflowAgent) -> list[dict[str, str]]:
    """Get unique apps used by a workflow agent's actions."""
    seen: dict[str, str] = {}
    for aa in wa.agent.actions:
        app = aa.action.app
        if app.slug not in seen:
            seen[app.slug] = app.name
    return [{"slug": s, "name": n} for s, n in seen.items()]


async def _send_completion_email(
    db: AsyncSession,
    execution: WorkflowExecution,
    workflow_name: str,
    steps_summary: list[dict],
    on_event: OnEvent,
) -> None:
    """Send a completion email via Gmail SMTP. Fails silently (never breaks workflow)."""
    try:
        smtp_server = os.getenv("SMTP_SERVER")
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
        smtp_username = os.getenv("SMTP_USERNAME")
        smtp_password = os.getenv("SMTP_PASSWORD")
        from_email = os.getenv("FROM_EMAIL")
        if not all([smtp_server, smtp_username, smtp_password, from_email]):
            return

        # Load user
        user_result = await db.execute(
            select(User).where(User.id == execution.user_id)
        )
        user = user_result.scalar_one_or_none()
        if not user or not user.email:
            return

        first_name = (user.name or "there").split()[0]
        friendly_name = workflow_name.replace(" Automation", "").replace(" automation", "")

        # Ask Gemini to write the email as clean HTML
        email_prompt = f"""Write a notification email for an employee named {first_name}.
Their request for "{friendly_name}" has been approved and completed.

Write the email as HTML that goes inside a <td> tag. Rules:
- 2-3 short paragraphs ONLY. Be concise.
- Use <p> tags for each paragraph with style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;"
- If mentioning any links/URLs, wrap them in <a> tags with style="color:#00D4FF;text-decoration:underline;"
- Do NOT mention "automation", "workflow", "agents", "steps", "Slack channels", channel IDs, or any internal system details
- Do NOT include raw IDs, API responses, or technical data
- Write it like a friendly HR/IT team member — warm, short, professional
- Infer the appropriate next steps from the request type (e.g. payroll processing for reimbursements, ticket tracking for incidents)
- End with a brief "If you have questions, contact your HR/IT team." line

Also write a short email subject line (max 8 words, no "Re:" or "Subject:" prefix).

Respond in EXACTLY this format:
SUBJECT: <subject>
HTML: <html paragraphs>"""

        from services.gemini import generate_chat_response
        email_content = await generate_chat_response(
            system_prompt="You write short, professional employee notification emails as clean HTML. Never mention automation, workflows, agents, AI, Slack channel IDs, or internal system details. Keep it to 2-3 paragraphs max.",
            user_message=email_prompt,
        )

        # Parse subject and HTML body
        subject = f"Your {friendly_name} request has been approved"
        body_inner_html = ""
        if "SUBJECT:" in email_content and "HTML:" in email_content:
            parts = email_content.split("HTML:", 1)
            subject_part = parts[0].split("SUBJECT:", 1)[1].strip()
            if subject_part:
                subject = subject_part
            body_inner_html = parts[1].strip()
        else:
            body_inner_html = f'<p style="margin:0 0 16px;font-size:14px;color:#374151;line-height:1.7;">Hi {first_name}, your request for {friendly_name} has been approved and completed. No further action is needed from your side.</p>'

        # Strip markdown backtick wrappers if Gemini added them
        body_inner_html = body_inner_html.strip().removeprefix("```html").removeprefix("```").removesuffix("```").strip()

        body_html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background-color:#0a0a0a;padding:24px 32px;text-align:center;">
            <span style="color:#00D4FF;font-size:22px;font-weight:700;letter-spacing:-0.5px;">ORKY</span>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            {body_inner_html}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Sent by ORKY &middot; Enterprise AI Platform
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["From"] = from_email
        msg["To"] = user.email
        msg["Subject"] = subject
        msg.attach(MIMEText(body_html, "html"))

        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.send_message(msg)

        await _emit(on_event, "notification_sent", {
            "type": "email",
            "to": user.email,
        })
    except Exception as e:
        print(f"[WORKFLOW] Failed to send completion email: {e}")


async def _handle_document_rejection(
    db: AsyncSession,
    execution: WorkflowExecution,
    step_exec: StepExecution,
    wa: WorkflowAgent,
    agent_result: Any,
    variables: dict,
    on_event: OnEvent,
) -> bool:
    """Handle document rejection. Returns True if handled (caller should return)."""
    if not agent_result.document_rejected:
        return False

    step_exec.status = "failed"
    step_exec.error_message = agent_result.rejection_reason
    step_exec.agent_thinking = agent_result.thinking
    step_exec.actions_invoked = agent_result.actions_invoked
    step_exec.completed_at = datetime.now(timezone.utc)

    # Clear stale file data for retry
    variables.pop("_file_attachment", None)

    # Strip appended file context from trigger input
    if "_triggerInput" in variables:
        variables["_triggerInput"] = re.sub(
            r'\n\n\[Attached file:.*?\]$', '', variables["_triggerInput"], flags=re.DOTALL
        )

    execution.status = "awaiting_upload"
    execution.current_step = wa.step_order
    execution.variables = variables
    await db.commit()

    await _emit(on_event, "workflow_paused", {
        "step_order": wa.step_order,
        "reason": agent_result.rejection_reason,
    })
    return True


async def run_workflow(execution_id: int, on_event: OnEvent = None) -> None:
    """Run a workflow execution — processes agents sequentially.

    Pauses with status 'awaiting_upload' if a step requires a file
    and no file attachment is present in the variables.

    Args:
        execution_id: The workflow execution ID to run.
        on_event: Optional async callback(event_type, data) for streaming progress.
    """
    async with async_session() as db:
        # Load execution with workflow
        result = await db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.id == execution_id)
            .options(selectinload(WorkflowExecution.workflow))
        )
        execution = result.scalar_one_or_none()
        if not execution:
            raise Exception(f"Execution {execution_id} not found")

        # Load workflow agents with full nested relations
        wa_result = await db.execute(
            select(WorkflowAgent)
            .where(WorkflowAgent.workflow_id == execution.workflow_id)
            .options(
                selectinload(WorkflowAgent.agent)
                .selectinload(Agent.actions)
                .selectinload(AgentAction.action)
                .selectinload(AppAction.app)
            )
            .order_by(WorkflowAgent.step_order)
        )
        workflow_agents = wa_result.scalars().all()

        # Mark execution as running
        execution.status = "running"
        execution.current_step = 0
        await db.commit()

        # Emit workflow_started event
        await _emit(on_event, "workflow_started", {
            "workflow_name": execution.workflow.name,
            "total_steps": len(workflow_agents),
            "steps": [
                {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "agent_icon": wa.agent.icon,
                    "agent_color": wa.agent.color,
                    "apps": _get_agent_apps(wa),
                }
                for wa in workflow_agents
            ],
        })

        variables: dict = dict(execution.variables or {})
        if execution.trigger_input:
            variables["_triggerInput"] = execution.trigger_input

        for wa in workflow_agents:
            # Check if this step requires a file and we don't have one
            if _step_requires_file(wa) and "_file_attachment" not in variables:
                execution.status = "awaiting_upload"
                execution.current_step = wa.step_order
                execution.variables = variables
                await db.commit()
                await _emit(on_event, "workflow_paused", {
                    "step_order": wa.step_order,
                    "reason": "File upload required for this step.",
                })
                return

            # Emit step_started event
            await _emit(on_event, "step_started", {
                "step_order": wa.step_order,
                "agent_name": wa.agent.name,
            })

            # Create step execution
            step_exec = StepExecution(
                workflow_execution_id=execution_id,
                workflow_agent_id=wa.id,
                step_order=wa.step_order,
                status="running",
                started_at=datetime.now(timezone.utc),
            )
            db.add(step_exec)
            await db.flush()

            # Update current step
            execution.current_step = wa.step_order
            await db.commit()

            try:
                # Build action info from agent's actions
                agent_actions = []
                for aa in wa.agent.actions:
                    action = aa.action
                    app = action.app
                    agent_actions.append(AgentActionInfo(
                        action_name=action.name,
                        app_slug=app.slug,
                        app_credentials=dict(app.credentials or {}),
                        input_schema=dict(action.input_schema or {}),
                    ))

                # Build task prompt
                task_prompt = (
                    wa.task_prompt
                    or execution.trigger_input
                    or f"Execute step {wa.step_order} of the workflow."
                )

                # Execute the agent
                agent_result = await execute_workflow_agent(
                    agent_name=wa.agent.name,
                    role=wa.agent.role or "",
                    steps=wa.agent.steps or "",
                    model=wa.agent.model,
                    actions=agent_actions,
                    task_prompt=task_prompt,
                    variables=variables,
                )

                # Check for document rejection first (retryable)
                if await _handle_document_rejection(db, execution, step_exec, wa, agent_result, variables, on_event):
                    return

                if agent_result.error:
                    step_exec.status = "failed"
                    step_exec.agent_thinking = agent_result.thinking
                    step_exec.actions_invoked = agent_result.actions_invoked
                    step_exec.error_message = agent_result.error
                    step_exec.completed_at = datetime.now(timezone.utc)
                    execution.status = "failed"
                    execution.error_message = f"Step {wa.step_order} failed: {agent_result.error}"
                    execution.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                    await _emit(on_event, "step_failed", {
                        "step_order": wa.step_order,
                        "agent_name": wa.agent.name,
                        "error": agent_result.error,
                    })
                    return

                # Step succeeded
                step_exec.status = "completed"
                step_exec.agent_thinking = agent_result.thinking
                step_exec.actions_invoked = agent_result.actions_invoked
                step_exec.result = agent_result.result
                step_exec.completed_at = datetime.now(timezone.utc)

                # Merge result into shared variables
                if agent_result.result and isinstance(agent_result.result, dict):
                    variables[f"step_{wa.step_order}"] = agent_result.result

                execution.variables = variables
                await db.commit()

                await _emit(on_event, "step_completed", {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "actions": _build_actions_summary(agent_result.actions_invoked),
                    "result_summary": None,
                })

            except Exception as e:
                step_exec.status = "failed"
                step_exec.error_message = str(e)
                step_exec.completed_at = datetime.now(timezone.utc)
                execution.status = "failed"
                execution.error_message = f"Step {wa.step_order} error: {str(e)}"
                execution.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await _emit(on_event, "step_failed", {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "error": str(e),
                })
                return

        # All steps completed
        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.variables = variables
        await db.commit()

        # Send completion email
        steps_summary = [
            {"step_order": wa.step_order, "agent_name": wa.agent.name}
            for wa in workflow_agents
        ]
        await _send_completion_email(db, execution, execution.workflow.name, steps_summary, on_event)


async def resume_workflow(execution_id: int, file_attachment: dict, on_event: OnEvent = None) -> None:
    """Resume a paused workflow execution after a file has been uploaded.

    Injects file info into variables and continues from the paused step.

    Args:
        execution_id: The workflow execution ID to resume.
        file_attachment: Dict with s3_bucket, s3_key, filename.
        on_event: Optional async callback(event_type, data) for streaming progress.
    """
    async with async_session() as db:
        # Load execution
        result = await db.execute(
            select(WorkflowExecution)
            .where(WorkflowExecution.id == execution_id)
            .options(selectinload(WorkflowExecution.workflow))
        )
        execution = result.scalar_one_or_none()
        if not execution:
            raise Exception(f"Execution {execution_id} not found")
        if execution.status != "awaiting_upload":
            raise Exception(f"Execution {execution_id} is not awaiting upload (status: {execution.status})")

        # Inject file info into variables
        variables: dict = dict(execution.variables or {})
        variables["_file_attachment"] = file_attachment

        # Append file context to trigger input so agents can see it
        file_context = (
            f"\n\n[Attached file: {file_attachment.get('filename', 'unknown')} "
            f"(stored at s3_bucket={file_attachment.get('s3_bucket')}, "
            f"s3_key={file_attachment.get('s3_key')}). "
            f"Use this file for any actions that require s3_bucket/s3_key parameters.]"
        )
        if "_triggerInput" in variables:
            variables["_triggerInput"] += file_context

        # Mark as running again
        execution.status = "running"
        execution.variables = variables
        await db.commit()

        resume_from_step = execution.current_step

        # Load workflow agents with full nested relations
        wa_result = await db.execute(
            select(WorkflowAgent)
            .where(WorkflowAgent.workflow_id == execution.workflow_id)
            .options(
                selectinload(WorkflowAgent.agent)
                .selectinload(Agent.actions)
                .selectinload(AgentAction.action)
                .selectinload(AppAction.app)
            )
            .order_by(WorkflowAgent.step_order)
        )
        workflow_agents = wa_result.scalars().all()

        # Skip steps that were already completed (before the pause point)
        remaining_agents = [wa for wa in workflow_agents if wa.step_order >= resume_from_step]

        # Emit workflow_started for remaining steps
        await _emit(on_event, "workflow_started", {
            "workflow_name": execution.workflow.name,
            "total_steps": len(remaining_agents),
            "steps": [
                {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "agent_icon": wa.agent.icon,
                    "agent_color": wa.agent.color,
                    "apps": _get_agent_apps(wa),
                }
                for wa in remaining_agents
            ],
        })

        for wa in remaining_agents:
            # Emit step_started event
            await _emit(on_event, "step_started", {
                "step_order": wa.step_order,
                "agent_name": wa.agent.name,
            })

            # Create step execution
            step_exec = StepExecution(
                workflow_execution_id=execution_id,
                workflow_agent_id=wa.id,
                step_order=wa.step_order,
                status="running",
                started_at=datetime.now(timezone.utc),
            )
            db.add(step_exec)
            await db.flush()

            execution.current_step = wa.step_order
            await db.commit()

            try:
                agent_actions = []
                for aa in wa.agent.actions:
                    action = aa.action
                    app = action.app
                    agent_actions.append(AgentActionInfo(
                        action_name=action.name,
                        app_slug=app.slug,
                        app_credentials=dict(app.credentials or {}),
                        input_schema=dict(action.input_schema or {}),
                    ))

                task_prompt = (
                    wa.task_prompt
                    or execution.trigger_input
                    or f"Execute step {wa.step_order} of the workflow."
                )

                agent_result = await execute_workflow_agent(
                    agent_name=wa.agent.name,
                    role=wa.agent.role or "",
                    steps=wa.agent.steps or "",
                    model=wa.agent.model,
                    actions=agent_actions,
                    task_prompt=task_prompt,
                    variables=variables,
                )

                # Check for document rejection first (retryable)
                if await _handle_document_rejection(db, execution, step_exec, wa, agent_result, variables, on_event):
                    return

                if agent_result.error:
                    step_exec.status = "failed"
                    step_exec.agent_thinking = agent_result.thinking
                    step_exec.actions_invoked = agent_result.actions_invoked
                    step_exec.error_message = agent_result.error
                    step_exec.completed_at = datetime.now(timezone.utc)
                    execution.status = "failed"
                    execution.error_message = f"Step {wa.step_order} failed: {agent_result.error}"
                    execution.completed_at = datetime.now(timezone.utc)
                    await db.commit()
                    await _emit(on_event, "step_failed", {
                        "step_order": wa.step_order,
                        "agent_name": wa.agent.name,
                        "error": agent_result.error,
                    })
                    return

                step_exec.status = "completed"
                step_exec.agent_thinking = agent_result.thinking
                step_exec.actions_invoked = agent_result.actions_invoked
                step_exec.result = agent_result.result
                step_exec.completed_at = datetime.now(timezone.utc)

                if agent_result.result and isinstance(agent_result.result, dict):
                    variables[f"step_{wa.step_order}"] = agent_result.result

                execution.variables = variables
                await db.commit()

                await _emit(on_event, "step_completed", {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "actions": _build_actions_summary(agent_result.actions_invoked),
                    "result_summary": None,
                })

            except Exception as e:
                step_exec.status = "failed"
                step_exec.error_message = str(e)
                step_exec.completed_at = datetime.now(timezone.utc)
                execution.status = "failed"
                execution.error_message = f"Step {wa.step_order} error: {str(e)}"
                execution.completed_at = datetime.now(timezone.utc)
                await db.commit()
                await _emit(on_event, "step_failed", {
                    "step_order": wa.step_order,
                    "agent_name": wa.agent.name,
                    "error": str(e),
                })
                return

        # All remaining steps completed
        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.variables = variables
        await db.commit()

        # Send completion email
        steps_summary = [
            {"step_order": wa.step_order, "agent_name": wa.agent.name}
            for wa in workflow_agents
        ]
        await _send_completion_email(db, execution, execution.workflow.name, steps_summary, on_event)
