from pydantic import BaseModel
from datetime import datetime


class AgentCreate(BaseModel):
    name: str
    description: str | None = None
    role: str | None = None
    steps: str | None = None
    model: str = "gemini-2.0-flash"
    icon: str | None = None
    color: str | None = "#3B82F6"
    status: str = "active"
    actionIds: list[int] | None = None


class AgentUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    role: str | None = None
    steps: str | None = None
    model: str | None = None
    icon: str | None = None
    color: str | None = None
    status: str | None = None
    actionIds: list[int] | None = None


class AppInfo(BaseModel):
    name: str
    slug: str
    icon: str | None = None

    model_config = {"from_attributes": True}


class ActionInfo(BaseModel):
    id: int
    name: str
    display_name: str
    description: str | None = None
    action_type: str
    input_schema: dict | None = None
    app: AppInfo | None = None

    model_config = {"from_attributes": True}


class AgentActionInfo(BaseModel):
    action: ActionInfo

    model_config = {"from_attributes": True}


class AgentResponse(BaseModel):
    id: int
    user_id: int
    name: str
    description: str | None = None
    role: str | None = None
    steps: str | None = None
    model: str
    icon: str | None = None
    color: str | None = None
    status: str
    created_at: datetime
    updated_at: datetime
    actions: list[AgentActionInfo] = []

    model_config = {"from_attributes": True}


class AgentSummary(BaseModel):
    id: int
    name: str
    icon: str | None = None
    color: str | None = None

    model_config = {"from_attributes": True}
