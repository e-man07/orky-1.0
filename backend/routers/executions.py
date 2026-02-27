from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth import get_current_user
from models.user import User
from models.workflow import WorkflowExecution, StepExecution, WorkflowAgent, Workflow
from models.agent import Agent
from models.knowledge import Execution, AgentLog

router = APIRouter(tags=["executions"])


@router.get("/api/workflow-executions/{execution_id}")
async def get_workflow_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(WorkflowExecution)
        .where(WorkflowExecution.id == execution_id)
        .options(
            selectinload(WorkflowExecution.workflow),
            selectinload(WorkflowExecution.steps)
            .selectinload(StepExecution.workflow_agent)
            .selectinload(WorkflowAgent.agent),
        )
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    sorted_steps = sorted(execution.steps, key=lambda s: s.step_order)

    return {
        "id": execution.id,
        "workflowId": execution.workflow_id,
        "userId": execution.user_id,
        "status": execution.status,
        "currentStep": execution.current_step,
        "variables": execution.variables,
        "triggerInput": execution.trigger_input,
        "errorMessage": execution.error_message,
        "startedAt": execution.started_at.isoformat() if execution.started_at else None,
        "completedAt": execution.completed_at.isoformat() if execution.completed_at else None,
        "workflow": {"name": execution.workflow.name} if execution.workflow else None,
        "steps": [
            {
                "id": step.id,
                "workflowAgentId": step.workflow_agent_id,
                "stepOrder": step.step_order,
                "status": step.status,
                "agentThinking": step.agent_thinking,
                "actionsInvoked": step.actions_invoked,
                "result": step.result,
                "errorMessage": step.error_message,
                "startedAt": step.started_at.isoformat() if step.started_at else None,
                "completedAt": step.completed_at.isoformat() if step.completed_at else None,
                "workflowAgent": {
                    "id": step.workflow_agent.id,
                    "agent": {
                        "name": step.workflow_agent.agent.name,
                        "icon": step.workflow_agent.agent.icon,
                        "color": step.workflow_agent.agent.color,
                    } if step.workflow_agent and step.workflow_agent.agent else None,
                } if step.workflow_agent else None,
            }
            for step in sorted_steps
        ],
    }


@router.get("/api/executions")
async def list_executions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Execution)
        .where(Execution.user_id == user.id)
        .options(selectinload(Execution.logs))
        .order_by(Execution.created_at.desc())
        .limit(50)
    )
    executions = result.scalars().all()

    return [
        {
            "id": ex.id,
            "userId": ex.user_id,
            "conversationId": ex.conversation_id,
            "userPrompt": ex.user_prompt,
            "status": ex.status,
            "agentType": ex.agent_type,
            "conversationalResponse": ex.conversational_response,
            "sources": ex.sources,
            "errorMessage": ex.error_message,
            "createdAt": ex.created_at.isoformat() if ex.created_at else None,
            "logs": [
                {
                    "id": log.id,
                    "agentType": log.agent_type,
                    "action": log.action,
                    "details": log.details,
                    "createdAt": log.created_at.isoformat() if log.created_at else None,
                }
                for log in ex.logs
            ],
        }
        for ex in executions
    ]


@router.get("/api/executions/{execution_id}")
async def get_execution(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Execution)
        .where(Execution.id == execution_id)
        .options(selectinload(Execution.logs))
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")

    return {
        "id": execution.id,
        "userId": execution.user_id,
        "conversationId": execution.conversation_id,
        "userPrompt": execution.user_prompt,
        "status": execution.status,
        "agentType": execution.agent_type,
        "conversationalResponse": execution.conversational_response,
        "sources": execution.sources,
        "errorMessage": execution.error_message,
        "createdAt": execution.created_at.isoformat() if execution.created_at else None,
        "logs": [
            {
                "id": log.id,
                "agentType": log.agent_type,
                "action": log.action,
                "details": log.details,
                "createdAt": log.created_at.isoformat() if log.created_at else None,
            }
            for log in execution.logs
        ],
    }


@router.get("/api/executions/{execution_id}/logs")
async def get_execution_logs(
    execution_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AgentLog)
        .where(AgentLog.execution_id == execution_id)
        .order_by(AgentLog.created_at)
    )
    logs = result.scalars().all()

    return [
        {
            "id": log.id,
            "agentType": log.agent_type,
            "action": log.action,
            "details": log.details,
            "createdAt": log.created_at.isoformat() if log.created_at else None,
        }
        for log in logs
    ]
