from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from models.app import App, AppAction

router = APIRouter(prefix="/api/apps", tags=["apps"])


@router.get("")
async def list_apps(
    include_actions: bool = False,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(App).options(selectinload(App.actions)).order_by(App.name)
    )
    apps = result.scalars().all()

    response = []
    for app in apps:
        item: dict = {
            "id": app.id,
            "name": app.name,
            "slug": app.slug,
            "description": app.description,
            "icon": app.icon,
            "logoUrl": app.logo_url,
            "category": app.category,
            "isConfigured": app.credentials is not None,
            "createdAt": app.created_at.isoformat() if app.created_at else None,
            "_count": {"actions": len(app.actions)},
        }
        if include_actions:
            item["actions"] = [
                {
                    "id": action.id,
                    "name": action.name,
                    "displayName": action.display_name,
                    "description": action.description,
                    "actionType": action.action_type,
                    "isEnabled": action.is_enabled,
                }
                for action in app.actions
            ]
        response.append(item)

    return response


@router.get("/{app_id}")
async def get_app(app_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(App)
        .where(App.id == app_id)
        .options(selectinload(App.actions))
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    return {
        "id": app.id,
        "name": app.name,
        "slug": app.slug,
        "description": app.description,
        "icon": app.icon,
        "logoUrl": app.logo_url,
        "category": app.category,
        "isConfigured": app.credentials is not None,
        "createdAt": app.created_at.isoformat() if app.created_at else None,
        "actions": [
            {
                "id": action.id,
                "name": action.name,
                "displayName": action.display_name,
                "description": action.description,
                "actionType": action.action_type,
                "inputSchema": action.input_schema,
                "isEnabled": action.is_enabled,
            }
            for action in app.actions
        ],
    }


@router.post("/{app_id}/credentials")
async def save_credentials(
    app_id: int,
    credentials: dict,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(App).where(App.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    app.credentials = credentials
    await db.commit()

    return {"id": app.id, "name": app.name, "isConfigured": True}
