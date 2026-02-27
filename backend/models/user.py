from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sys_id = Column(String, unique=True, nullable=True)
    orky_id = Column(String, unique=True, nullable=True)
    user_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False)
    active = Column(Boolean, default=True)
    department = Column(String, nullable=True)
    location = Column(String, nullable=True)
    gender = Column(String, nullable=True)
    company = Column(String, nullable=True)
    title = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    roles = relationship("UserRole", back_populates="user", cascade="all, delete-orphan")
    executions = relationship("Execution", back_populates="user")
    chat_sessions = relationship("ChatSession", back_populates="user")
    agents = relationship("Agent", back_populates="user")
    workflows = relationship("Workflow", back_populates="user")
    workflow_executions = relationship("WorkflowExecution", back_populates="user")


class UserRole(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_name = Column(String, nullable=False)

    user = relationship("User", back_populates="roles")


class UserCriteria(Base):
    __tablename__ = "user_criteria"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, unique=True, nullable=False)
    match_type = Column(String, nullable=False)
    match_value = Column(String, nullable=False)

    articles = relationship("ArticleCriteria", back_populates="criteria")
