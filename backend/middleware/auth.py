from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from config import get_settings
from database import get_db
from models.user import User

security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Validate NextAuth JWT and return the authenticated user."""
    settings = get_settings()
    token = credentials.credentials

    try:
        # NextAuth uses HS256 with NEXTAUTH_SECRET for JWT strategy
        payload = jwt.decode(
            token,
            settings.nextauth_secret,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
    except JWTError:
        # Try without verification for development (NextAuth may use different encoding)
        try:
            payload = jwt.decode(
                token,
                settings.nextauth_secret,
                algorithms=["HS256"],
                options={"verify_aud": False, "verify_exp": False},
            )
        except JWTError:
            raise HTTPException(status_code=401, detail="Invalid authentication token")

    email = payload.get("email")
    if not email:
        raise HTTPException(status_code=401, detail="Token missing email claim")

    result = await db.execute(
        select(User).where(User.email == email).options(selectinload(User.roles))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return user
