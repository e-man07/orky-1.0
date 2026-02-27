from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from database import Base


class Agent(Base):
    __tablename__ = "agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    role = Column(Text, nullable=True)
    steps = Column(Text, nullable=True)
    model = Column(String, default="gemini-2.0-flash")
    icon = Column(String, nullable=True)
    color = Column(String, default="#3B82F6")
    status = Column(String, default="active")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="agents")
    actions = relationship("AgentAction", back_populates="agent", cascade="all, delete-orphan")
    workflow_agents = relationship("WorkflowAgent", back_populates="agent", cascade="all, delete-orphan")


class AgentAction(Base):
    __tablename__ = "agent_actions"

    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), primary_key=True)
    action_id = Column(Integer, ForeignKey("app_actions.id", ondelete="CASCADE"), primary_key=True)

    agent = relationship("Agent", back_populates="actions")
    action = relationship("AppAction", back_populates="agents")
