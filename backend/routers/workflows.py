import asyncio
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select, func as sa_func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.agent import Agent, AgentAction
from models.app import App, AppAction
from models.workflow import Workflow, WorkflowAgent, WorkflowExecution
from schemas.workflow import (
    WorkflowCreate, WorkflowUpdate, WorkflowExecuteInput, WorkflowGenerateInput,
)
from services.workflow_engine import run_workflow
from services.workflow_generator import generate_workflow_plan

router = APIRouter(prefix="/api/workflows", tags=["workflows"])


@router.get("")
async def list_workflows(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.user_id == user.id)
        .options(
            selectinload(Workflow.agents)
            .selectinload(WorkflowAgent.agent),
        )
        .order_by(Workflow.created_at.desc())
    )
    workflows = result.scalars().all()

    response = []
    for wf in workflows:
        # Count executions
        count_result = await db.execute(
            select(sa_func.count()).select_from(WorkflowExecution).where(WorkflowExecution.workflow_id == wf.id)
        )
        exec_count = count_result.scalar() or 0

        sorted_agents = sorted(wf.agents, key=lambda wa: wa.step_order)
        response.append({
            "id": wf.id,
            "userId": wf.user_id,
            "name": wf.name,
            "description": wf.description,
            "steps": wf.steps,
            "triggerRoles": wf.trigger_roles or [],
            "status": wf.status,
            "createdAt": wf.created_at.isoformat() if wf.created_at else None,
            "updatedAt": wf.updated_at.isoformat() if wf.updated_at else None,
            "agents": [
                {
                    "id": wa.id,
                    "agentId": wa.agent_id,
                    "stepOrder": wa.step_order,
                    "taskPrompt": wa.task_prompt,
                    "agent": {
                        "id": wa.agent.id,
                        "name": wa.agent.name,
                        "icon": wa.agent.icon,
                        "color": wa.agent.color,
                    } if wa.agent else None,
                }
                for wa in sorted_agents
            ],
            "_count": {"agents": len(wf.agents), "executions": exec_count},
        })

    return response


@router.post("", status_code=201)
async def create_workflow(
    body: WorkflowCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    workflow = Workflow(
        user_id=user.id,
        name=body.name,
        description=body.description,
        steps=body.steps,
        trigger_roles=body.triggerRoles or [],
        status=body.status,
    )
    db.add(workflow)
    await db.flush()

    if body.agents:
        for a in body.agents:
            db.add(WorkflowAgent(
                workflow_id=workflow.id,
                agent_id=a.agentId,
                step_order=a.stepOrder,
                task_prompt=a.taskPrompt,
            ))

    await db.commit()

    # Reload with relations
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow.id)
        .options(selectinload(Workflow.agents).selectinload(WorkflowAgent.agent))
    )
    workflow = result.scalar_one()
    return _workflow_to_dict(workflow)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(
            selectinload(Workflow.agents)
            .selectinload(WorkflowAgent.agent)
            .selectinload(Agent.actions)
            .selectinload(AgentAction.action)
            .selectinload(AppAction.app),
        )
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    count_result = await db.execute(
        select(sa_func.count()).select_from(WorkflowExecution).where(WorkflowExecution.workflow_id == workflow.id)
    )
    exec_count = count_result.scalar() or 0

    wf_dict = _workflow_to_dict(workflow)
    wf_dict["_count"] = {"agents": len(workflow.agents), "executions": exec_count}
    return wf_dict


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: int,
    body: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")

    update_data = body.model_dump(exclude_unset=True, exclude={"agents", "triggerRoles"})
    for key, value in update_data.items():
        setattr(workflow, key, value)
    if body.triggerRoles is not None:
        workflow.trigger_roles = body.triggerRoles

    if body.agents is not None:
        await db.execute(delete(WorkflowAgent).where(WorkflowAgent.workflow_id == workflow_id))
        for a in body.agents:
            db.add(WorkflowAgent(
                workflow_id=workflow_id,
                agent_id=a.agentId,
                step_order=a.stepOrder,
                task_prompt=a.taskPrompt,
            ))

    await db.commit()

    # Reload
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.agents).selectinload(WorkflowAgent.agent))
    )
    workflow = result.scalar_one()
    return _workflow_to_dict(workflow)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Workflow).where(Workflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)
    await db.commit()
    return {"deleted": True}


@router.post("/{workflow_id}/execute", status_code=201)
async def execute_workflow(
    workflow_id: int,
    body: WorkflowExecuteInput | None = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Workflow)
        .where(Workflow.id == workflow_id)
        .options(selectinload(Workflow.agents))
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if not workflow.agents:
        raise HTTPException(status_code=400, detail="Workflow has no agents configured")

    body = body or WorkflowExecuteInput()
    execution = WorkflowExecution(
        workflow_id=workflow_id,
        user_id=user.id,
        status="pending",
        trigger_input=body.triggerInput,
        variables=body.variables or {},
    )
    db.add(execution)
    await db.commit()
    await db.refresh(execution)

    # Run workflow in background
    async def _run():
        try:
            await run_workflow(execution.id)
        except Exception as err:
            async with db.begin():
                execution.status = "failed"
                execution.error_message = str(err)
                await db.commit()

    background_tasks.add_task(_run)

    return {"executionId": execution.id, "status": "pending"}


@router.post("/generate")
async def generate_workflow(
    body: WorkflowGenerateInput,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """AI-powered workflow generation from natural language description."""
    # Fetch all apps with their actions
    result = await db.execute(
        select(App).options(selectinload(App.actions))
    )
    apps = result.scalars().all()

    apps_data = []
    for app in apps:
        apps_data.append({
            "name": app.name,
            "slug": app.slug,
            "description": app.description,
            "actions": [
                {
                    "name": action.name,
                    "display_name": action.display_name,
                    "description": action.description,
                    "input_schema": action.input_schema,
                }
                for action in app.actions
                if action.is_enabled
            ],
        })

    # Generate the workflow plan
    plan = await generate_workflow_plan(body.description, apps_data)

    # Auto-create suggested agents in DB
    created_agents = []
    for agent_plan in plan.agents:
        # Find action IDs from the catalog
        action_ids = []
        for action_name in agent_plan.actions:
            # Handle both "action_name" and "app_slug.action_name" formats from Gemini
            if "." in action_name:
                app_slug, clean_name = action_name.split(".", 1)
                action_result = await db.execute(
                    select(AppAction)
                    .join(App, App.id == AppAction.app_id)
                    .where(AppAction.name == clean_name, App.slug == app_slug)
                )
            else:
                clean_name = action_name
                action_result = await db.execute(
                    select(AppAction).where(AppAction.name == clean_name)
                )
            # Use first() instead of scalar_one_or_none() since action names
            # can exist across multiple apps (e.g. send_message in Slack & WhatsApp)
            action = action_result.scalars().first()
            if action:
                action_ids.append(action.id)

        # Create the agent
        agent = Agent(
            user_id=user.id,
            name=agent_plan.name,
            description=agent_plan.description,
            role=agent_plan.role,
            steps=agent_plan.steps,
            model="gemini-2.5-flash",
        )
        db.add(agent)
        await db.flush()

        # Assign actions
        for action_id in action_ids:
            db.add(AgentAction(agent_id=agent.id, action_id=action_id))

        created_agents.append({
            "id": agent.id,
            "name": agent.name,
            "description": agent.description,
            "role": agent.role,
            "steps": agent.steps,
            "actions": agent_plan.actions,
            "taskPrompt": agent_plan.taskPrompt,
        })

    await db.commit()

    return {
        "name": plan.name,
        "description": plan.description,
        "steps": plan.steps,
        "agents": created_agents,
    }


def _workflow_to_dict(workflow: Workflow) -> dict:
    sorted_agents = sorted(workflow.agents, key=lambda wa: wa.step_order)
    return {
        "id": workflow.id,
        "userId": workflow.user_id,
        "name": workflow.name,
        "description": workflow.description,
        "steps": workflow.steps,
        "triggerRoles": workflow.trigger_roles or [],
        "status": workflow.status,
        "createdAt": workflow.created_at.isoformat() if workflow.created_at else None,
        "updatedAt": workflow.updated_at.isoformat() if workflow.updated_at else None,
        "agents": [
            {
                "id": wa.id,
                "agentId": wa.agent_id,
                "stepOrder": wa.step_order,
                "taskPrompt": wa.task_prompt,
                "agent": {
                    "id": wa.agent.id,
                    "name": wa.agent.name,
                    "icon": wa.agent.icon,
                    "color": wa.agent.color,
                } if wa.agent else None,
            }
            for wa in sorted_agents
        ],
    }
