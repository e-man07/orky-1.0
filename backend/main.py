from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from routers import agents, workflows, apps, chat, executions, webhooks, auth

settings = get_settings()

app = FastAPI(
    title="Orky Backend API",
    description="AI-Powered Workflow Orchestration Backend",
    version="1.0.0",
)

# CORS — allow Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router)
app.include_router(agents.router)
app.include_router(workflows.router)
app.include_router(apps.router)
app.include_router(chat.router)
app.include_router(executions.router)
app.include_router(webhooks.router)


@app.get("/")
async def root():
    return {"message": "Orky Backend API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
