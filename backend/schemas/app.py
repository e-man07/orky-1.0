from pydantic import BaseModel
from datetime import datetime
from typing import Any


class AppActionResponse(BaseModel):
    id: int
    name: str
    display_name: str
    description: str | None = None
    action_type: str
    input_schema: dict | None = None
    is_enabled: bool = True

    model_config = {"from_attributes": True}


class AppResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: str | None = None
    icon: str | None = None
    logo_url: str | None = None
    category: str | None = None
    is_configured: bool = False
    created_at: datetime
    actions: list[AppActionResponse] = []
    action_count: int = 0

    model_config = {"from_attributes": True}


class ChatInput(BaseModel):
    message: str
    sessionId: int | None = None
    conversationHistory: list[dict] | None = None
    fileAttachment: dict | None = None  # {s3_bucket, s3_key, filename}


class ActionTakenResponse(BaseModel):
    app: str
    action: str
    input: dict = {}
    output: Any = None
    success: bool = True
    error: str | None = None


class ChatResponse(BaseModel):
    response: str
    sources: list[dict] | None = None
    status: str
    executionId: int
    sessionId: int
    actionsTaken: list[ActionTakenResponse] | None = None
