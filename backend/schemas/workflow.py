from pydantic import BaseModel
from datetime import datetime
from typing import Any


class WorkflowAgentInput(BaseModel):
    agentId: int
    stepOrder: int
    taskPrompt: str | None = None


class WorkflowCreate(BaseModel):
    name: str
    description: str | None = None
    steps: str | None = None
    triggerRoles: list[str] | None = None
    status: str = "draft"
    agents: list[WorkflowAgentInput] | None = None


class WorkflowUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    steps: str | None = None
    triggerRoles: list[str] | None = None
    status: str | None = None
    agents: list[WorkflowAgentInput] | None = None


class WorkflowExecuteInput(BaseModel):
    triggerInput: str | None = None
    variables: dict | None = None


class WorkflowGenerateInput(BaseModel):
    description: str


# Response schemas
class WorkflowAgentResponse(BaseModel):
    id: int
    agent_id: int
    step_order: int
    task_prompt: str | None = None
    agent: Any = None

    model_config = {"from_attributes": True}


class WorkflowResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None = None
    steps: str | None = None
    trigger_roles: list[str] = []
    status: str
    created_at: datetime
    updated_at: datetime
    agents: list[WorkflowAgentResponse] = []

    model_config = {"from_attributes": True}


class StepExecutionResponse(BaseModel):
    id: int
    workflow_agent_id: int
    step_order: int
    status: str
    agent_thinking: str | None = None
    actions_invoked: Any = None
    result: Any = None
    error_message: str | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None
    workflow_agent: Any = None

    model_config = {"from_attributes": True}


class WorkflowExecutionResponse(BaseModel):
    id: int
    workflow_id: int
    user_id: int
    status: str
    current_step: int | None = None
    variables: Any = None
    trigger_input: str | None = None
    error_message: str | None = None
    started_at: datetime
    completed_at: datetime | None = None
    workflow: Any = None
    steps: list[StepExecutionResponse] = []

    model_config = {"from_attributes": True}


# AI Generation response
class GeneratedAgentPlan(BaseModel):
    name: str
    description: str
    role: str
    steps: str
    actions: list[str]  # Action names from the apps catalog
    taskPrompt: str


class GeneratedWorkflowPlan(BaseModel):
    name: str
    description: str
    steps: str
    agents: list[GeneratedAgentPlan]
