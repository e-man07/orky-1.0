from datetime import datetime, timezone
from typing import Any, Callable, Awaitable

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.workflow import Workflow, WorkflowExecution, WorkflowAgent, StepExecution
from models.agent import Agent, AgentAction
from models.app import AppAction, App
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
