from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func as sa_func, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.agent import Agent, AgentAction
from models.app import AppAction, App
from models.workflow import WorkflowAgent
from schemas.agent import AgentCreate, AgentUpdate

router = APIRouter(prefix="/api/agents", tags=["agents"])


async def _resolve_action_keys(db: AsyncSession, action_keys: list[str]) -> list[int]:
    """Resolve 'appSlug:actionName' strings to DB action IDs."""
    action_ids = []
    for key in action_keys:
        if ":" not in key:
            continue
        app_slug, action_name = key.split(":", 1)
        result = await db.execute(
            select(AppAction.id)
            .join(App, AppAction.app_id == App.id)
            .where(App.slug == app_slug, AppAction.name == action_name)
        )
        action_id = result.scalar_one_or_none()
        if action_id:
            action_ids.append(action_id)
    return action_ids


@router.get("")
async def list_agents(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent)
        .where(Agent.user_id == user.id)
        .options(
            selectinload(Agent.actions)
            .selectinload(AgentAction.action)
            .selectinload(AppAction.app),
        )
        .order_by(Agent.created_at.desc())
    )
    agents = result.scalars().all()

    response = []
    for agent in agents:
        count_result = await db.execute(
            select(sa_func.count()).select_from(WorkflowAgent).where(WorkflowAgent.agent_id == agent.id)
        )
        workflow_count = count_result.scalar() or 0

        agent_dict = _agent_to_dict(agent)
        agent_dict["_count"] = {
            "actions": len(agent.actions),
            "workflowAgents": workflow_count,
        }
        response.append(agent_dict)

    return response


@router.post("", status_code=201)
async def create_agent(
    body: AgentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    agent = Agent(
        user_id=user.id,
        name=body.name,
        description=body.description,
        role=body.role,
        steps=body.steps,
        model=body.model,
        icon=body.icon,
        color=body.color,
        status=body.status,
    )
    db.add(agent)
    await db.flush()

    if body.actionKeys:
        action_ids = await _resolve_action_keys(db, body.actionKeys)
        for action_id in action_ids:
            db.add(AgentAction(agent_id=agent.id, action_id=action_id))

    await db.commit()

    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent.id)
        .options(
            selectinload(Agent.actions)
            .selectinload(AgentAction.action)
            .selectinload(AppAction.app),
        )
    )
    agent = result.scalar_one()

    return _agent_to_dict(agent)


@router.get("/{agent_id}")
async def get_agent(
    agent_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent_id)
        .options(
            selectinload(Agent.actions)
            .selectinload(AgentAction.action)
            .selectinload(AppAction.app),
        )
    )
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    count_result = await db.execute(
        select(sa_func.count()).select_from(WorkflowAgent).where(WorkflowAgent.agent_id == agent.id)
    )
    workflow_count = count_result.scalar() or 0

    agent_dict = _agent_to_dict(agent)
    agent_dict["_count"] = {
        "actions": len(agent.actions),
        "workflowAgents": workflow_count,
    }
    return agent_dict


@router.patch("/{agent_id}")
async def update_agent(
    agent_id: int,
    body: AgentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    update_data = body.model_dump(exclude_unset=True, exclude={"actionKeys"})
    for key, value in update_data.items():
        setattr(agent, key, value)

    if body.actionKeys is not None:
        await db.execute(delete(AgentAction).where(AgentAction.agent_id == agent.id))
        action_ids = await _resolve_action_keys(db, body.actionKeys)
        for action_id in action_ids:
            db.add(AgentAction(agent_id=agent.id, action_id=action_id))

    await db.commit()

    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent.id)
        .options(
            selectinload(Agent.actions)
            .selectinload(AgentAction.action)
            .selectinload(AppAction.app),
        )
    )
    agent = result.scalar_one()
    return _agent_to_dict(agent)


@router.delete("/{agent_id}")
async def delete_agent(
    agent_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Agent).where(Agent.id == agent_id))
    agent = result.scalar_one_or_none()
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
    await db.delete(agent)
    await db.commit()
    return {"deleted": True}


def _agent_to_dict(agent: Agent) -> dict:
    return {
        "id": agent.id,
        "userId": agent.user_id,
        "name": agent.name,
        "description": agent.description,
        "role": agent.role,
        "steps": agent.steps,
        "model": agent.model,
        "icon": agent.icon,
        "color": agent.color,
        "status": agent.status,
        "createdAt": agent.created_at.isoformat() if agent.created_at else None,
        "updatedAt": agent.updated_at.isoformat() if agent.updated_at else None,
        "actions": [
            {
                "action": {
                    "id": aa.action.id,
                    "name": aa.action.name,
                    "displayName": aa.action.display_name,
                    "description": aa.action.description,
                    "actionType": aa.action.action_type,
                    "inputSchema": aa.action.input_schema,
                    "app": {
                        "name": aa.action.app.name,
                        "slug": aa.action.app.slug,
                        "icon": aa.action.app.icon,
                    } if aa.action.app else None,
                }
            }
            for aa in agent.actions
        ],
    }
