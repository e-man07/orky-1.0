from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from database import get_db
from middleware.auth import get_current_user
from models.user import User, UserCriteria
from services.rag.pipeline import resolve_user_access

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Resolve access criteria
    access = await resolve_user_access(db, user.id)
    roles = [r.role_name for r in user.roles] if user.roles else []

    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "department": user.department,
        "location": user.location,
        "company": user.company,
        "title": user.title,
        "roles": roles,
        "criteria": access.get("criteria", []) if access else [],
    }
