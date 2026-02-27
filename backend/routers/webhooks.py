from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.app import App
from models.workflow import Workflow, WorkflowExecution, WorkflowAgent
from services.workflow_engine import run_workflow

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])


@router.post("/{app_slug}")
async def receive_webhook(
    app_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives incoming webhooks from external apps (ServiceNow, Jira, etc.).
    Can trigger workflows based on webhook payload.
    """
    payload = await request.json()

    # Verify app exists
    result = await db.execute(select(App).where(App.slug == app_slug))
    app = result.scalar_one_or_none()

    if not app:
        return {"received": True, "matched_workflows": 0, "message": f"Unknown app: {app_slug}"}

    # Find active workflows that have agents linked to this app
    # This is a basic matching - could be enhanced with more sophisticated triggers
    result = await db.execute(
        select(Workflow)
        .where(Workflow.status == "active")
        .options(selectinload(Workflow.agents))
    )
    active_workflows = result.scalars().all()

    triggered = []
    for wf in active_workflows:
        if not wf.agents:
            continue

        # Create execution for each matching active workflow
        execution = WorkflowExecution(
            workflow_id=wf.id,
            user_id=wf.user_id,
            status="pending",
            trigger_input=str(payload),
            variables={"webhook_payload": payload, "webhook_app": app_slug},
        )
        db.add(execution)
        await db.flush()

        triggered.append({
            "workflow_id": wf.id,
            "workflow_name": wf.name,
            "execution_id": execution.id,
        })

    await db.commit()

    # Run triggered workflows in background
    for t in triggered:
        try:
            await run_workflow(t["execution_id"])
        except Exception as e:
            print(f"Webhook-triggered workflow {t['workflow_id']} failed: {e}")

    return {
        "received": True,
        "app": app_slug,
        "matched_workflows": len(triggered),
        "triggered": triggered,
    }
