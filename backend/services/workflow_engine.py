from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from database import async_session
from models.workflow import Workflow, WorkflowExecution, WorkflowAgent, StepExecution
from models.agent import Agent, AgentAction
from models.app import AppAction, App
from services.agent_executor import execute_workflow_agent, AgentActionInfo


async def run_workflow(execution_id: int) -> None:
    """Run a workflow execution — processes agents sequentially."""
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

        variables: dict = dict(execution.variables or {})
        if execution.trigger_input:
            variables["_triggerInput"] = execution.trigger_input

        for wa in workflow_agents:
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

            except Exception as e:
                step_exec.status = "failed"
                step_exec.error_message = str(e)
                step_exec.completed_at = datetime.now(timezone.utc)
                execution.status = "failed"
                execution.error_message = f"Step {wa.step_order} error: {str(e)}"
                execution.completed_at = datetime.now(timezone.utc)
                await db.commit()
                return

        # All steps completed
        execution.status = "completed"
        execution.completed_at = datetime.now(timezone.utc)
        execution.variables = variables
        await db.commit()
