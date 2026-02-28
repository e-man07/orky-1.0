from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, ForeignKey, ARRAY, func
from sqlalchemy.orm import relationship
from database import Base


def _utcnow():
    return datetime.now(timezone.utc)


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    steps = Column(Text, nullable=True)
    trigger_roles = Column(ARRAY(String), default=[])
    status = Column(String, default="draft")
    created_at = Column(DateTime(timezone=True), default=_utcnow)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, onupdate=_utcnow)

    user = relationship("User", back_populates="workflows")
    agents = relationship("WorkflowAgent", back_populates="workflow", cascade="all, delete-orphan")
    executions = relationship("WorkflowExecution", back_populates="workflow")


class WorkflowAgent(Base):
    __tablename__ = "workflow_agents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    agent_id = Column(Integer, ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    step_order = Column(Integer, nullable=False)
    task_prompt = Column(Text, nullable=True)
    running_description = Column(Text, nullable=True)
    completed_description = Column(Text, nullable=True)

    workflow = relationship("Workflow", back_populates="agents")
    agent = relationship("Agent", back_populates="workflow_agents")
    step_executions = relationship("StepExecution", back_populates="workflow_agent")


class WorkflowExecution(Base):
    __tablename__ = "workflow_executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending")
    current_step = Column(Integer, nullable=True)
    variables = Column(JSON, nullable=True)
    trigger_input = Column(Text, nullable=True)
    error_message = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), default=_utcnow)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    workflow = relationship("Workflow", back_populates="executions")
    user = relationship("User", back_populates="workflow_executions")
    steps = relationship("StepExecution", back_populates="workflow_execution", cascade="all, delete-orphan")


class StepExecution(Base):
    __tablename__ = "step_executions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    workflow_execution_id = Column(Integer, ForeignKey("workflow_executions.id", ondelete="CASCADE"), nullable=False)
    workflow_agent_id = Column(Integer, ForeignKey("workflow_agents.id"), nullable=False)
    step_order = Column(Integer, nullable=False)
    status = Column(String, default="pending")
    agent_thinking = Column(Text, nullable=True)
    actions_invoked = Column(JSON, nullable=True)
    result = Column(JSON, nullable=True)
    error_message = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    workflow_execution = relationship("WorkflowExecution", back_populates="steps")
    workflow_agent = relationship("WorkflowAgent", back_populates="step_executions")
