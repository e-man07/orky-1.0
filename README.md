# ORKY

> **AI-powered infrastructure orchestration across the tools enterprises already use.**

ORKY turns a natural-language infrastructure request into an executable, multi-step workflow across AWS, ServiceNow, Jira, Slack, and SharePoint.

Instead of generating instructions or Terraform and leaving the execution to a human, ORKY can **understand the request, coordinate multiple agents, execute real API actions, pause for human approval, validate the result, and document what happened.**

### Demo

**Live:** http://demo.orky.io/

**Demo video:** https://drive.google.com/file/d/1Qqa6J-YHDtdCU5-qABtZb9WbZS32xvat/view?usp=sharing

**Repository:** https://github.com/e-man07/orky-1.0

---

## What I built

ORKY started from a simple question:

> **What if you could ask for infrastructure the same way you ask a coworker?**

For example:

```text
Create a t2.micro EC2 instance for the staging API in us-east-1.
```

ORKY can turn that single request into a workflow:

```text
Natural language request
        ↓
Understand intent
        ↓
Create ServiceNow / Jira ticket
        ↓
Request approval through Slack
        ↓
Wait for human approval
        ↓
Provision resource in AWS
        ↓
Validate deployment
        ↓
Generate documentation in SharePoint
        ↓
Close ticket
        ↓
Notify the user
```

The interesting part isn't simply calling an LLM.

The system has to coordinate **multiple tools, agents, workflow state, approvals, credentials, failures, and real external side effects**.

---

## Why it's different from an LLM wrapper

A typical AI infrastructure tool might do this:

```text
User → LLM → Terraform / code → Human executes it
```

ORKY is designed more like:

```text
User
 ↓
Orchestrator Agent
 ↓
Specialized Agents
 ↓
Real external systems
 ↓
Workflow Engine
 ↓
Validation + audit trail
```

The model decides how to interpret and coordinate the request, while deterministic application logic handles workflow state, approvals, execution, and system integrations.

This lets an AI agent operate inside an actual enterprise workflow rather than just producing text.

---

## Architecture

```text
┌──────────────────────────────────────────────────────────────┐
│                         ORKY FRONTEND                        │
│                                                              │
│   Chat UI        Workflow Management       Settings          │
│                                                              │
│                    Next.js / React                           │
└──────────────────────────────┬───────────────────────────────┘
                               │
                         REST + WebSocket
                               │
┌──────────────────────────────▼───────────────────────────────┐
│                       FASTAPI BACKEND                        │
│                                                              │
│                  ┌────────────────────┐                      │
│                  │ Orchestrator Agent │                      │
│                  │                    │                      │
│                  │ Intent parsing     │                      │
│                  │ Agent delegation  │                      │
│                  │ Tool coordination │                      │
│                  └─────────┬──────────┘                      │
│                            │                                 │
│          ┌─────────────────┼──────────────────┐              │
│          │                 │                  │              │
│          ▼                 ▼                  ▼              │
│    Compliance          Execution          Monitoring        │
│      Agent               Agent               Agent           │
│          │                 │                  │              │
│     ServiceNow           AWS              Validation         │
│     Jira                 EC2              Checks             │
│                          S3                                  │
│                                                              │
│                  ┌────────────────────┐                      │
│                  │  Workflow Engine   │                      │
│                  │                    │                      │
│                  │ State management   │                      │
│                  │ Approval gates     │                      │
│                  │ Pause / resume     │                      │
│                  │ Sequential steps   │                      │
│                  │ Conditional logic  │                      │
│                  └────────────────────┘                      │
└──────────────────────────────┬───────────────────────────────┘
                               │
          ┌────────────────────┼─────────────────────┐
          │                    │                     │
          ▼                    ▼                     ▼
       AWS                ServiceNow              Slack
       Jira               SharePoint              Gemini
```

---

## Core capabilities

### 🤖 Agentic orchestration

ORKY uses a coordinator agent to interpret requests and delegate work to specialized agents.

- Natural-language intent parsing
- Multi-turn conversations
- Agent delegation
- Tool selection
- Context-aware execution
- Multi-step workflows

### 🔄 Workflow engine

Infrastructure operations rarely consist of a single API call.

ORKY supports:

- Sequential execution
- Conditional logic
- Approval gates
- Pause and resume
- Long-running workflows
- Workflow templates
- State management
- Execution history

### 👤 Human-in-the-loop

AI doesn't have to blindly execute every action.

ORKY can stop at critical points and wait for a human approval before continuing.

For example:

```text
AI creates ServiceNow request
        ↓
Slack approval request
        ↓
Human approves
        ↓
Workflow resumes
        ↓
AWS resource is provisioned
```

### ☁️ Real infrastructure actions

ORKY isn't limited to generating infrastructure code.

It can interact with real systems through APIs and MCP-based integrations.

**AWS**

- EC2
- S3
- Security groups
- Resource management
- Resource tagging

**ServiceNow**

- RITM creation
- Incident management
- Approval workflows
- Ticket closure

**Jira**

- Issue creation
- Project management
- Status transitions
- Comments

**Slack**

- Approval requests
- Interactive buttons
- Notifications
- Threaded messages

**SharePoint**

- Document upload/download
- Folder management
- Automatic infrastructure documentation

---

## Example workflow

A user asks:

```text
Create a t2.micro EC2 instance for the staging API in us-east-1.
```

ORKY can execute:

**1. Parse the request**

Gemini extracts the required infrastructure parameters.

**2. Create a compliance request**

A ServiceNow or Jira ticket is created.

**3. Request approval**

The request is sent to Slack with approval controls.

**4. Wait**

The workflow pauses until an authorized user approves it.

**5. Provision**

The execution agent provisions the EC2 instance through AWS.

**6. Validate**

The monitoring agent verifies that the deployment is healthy.

**7. Document**

ORKY generates the infrastructure documentation and stores it in SharePoint.

**8. Close**

The original ticket is updated and closed.

**9. Notify**

The user receives the final result.

---

## Project scale

The current implementation includes:

- **~10,000 lines of Python**
- **6 specialized agents**
- **30+ REST API endpoints**
- **6 external integrations**
- Multi-step workflow engine
- Human approval gates
- Real-time execution updates
- OAuth authentication
- Encrypted credential storage
- Execution and agent logs
- PostgreSQL persistence
- Redis-based realtime infrastructure

---

## Security

Because ORKY interacts with infrastructure and enterprise systems, credential handling is a core part of the architecture.

### Authentication

- Google OAuth 2.0
- NextAuth.js
- HTTP-only session cookies
- JWT-based sessions

### Credential storage

- Fernet encryption
- Per-user credential isolation
- Environment-specific encryption keys
- Credentials excluded from logs and error output

### Network security

- HTTPS in production
- TLS database connections
- Restricted CORS origins
- Secure WebSocket connections

### Auditability

- Execution history
- Agent activity logs
- Infrastructure change records
- Approval workflows
- Workflow state tracking

---

## Tech stack

### Backend

| Component | Technology |
|---|---|
| Framework | FastAPI |
| Language | Python 3.11+ |
| Database | PostgreSQL / Neon |
| ORM | SQLModel |
| Cache / PubSub | Redis |
| AI | Google Gemini |
| AWS | Boto3 + MCP |
| Migrations | Alembic |

### Frontend

| Component | Technology |
|---|---|
| Framework | Next.js 14 |
| Language | TypeScript |
| UI | React |
| Styling | Tailwind CSS |
| Components | Radix UI / shadcn/ui |
| State | Zustand |
| Data fetching | TanStack Query |
| Authentication | NextAuth.js |

### Infrastructure

| Component | Technology |
|---|---|
| Frontend hosting | Vercel |
| Backend hosting | Render |
| Database | Neon PostgreSQL |
| Cache | Redis Cloud |
| CI/CD | GitHub Actions |

---

## Repository structure

```text
orky-1.0/
│
├── backend/
│   ├── src/
│   │   ├── agents/
│   │   ├── api/
│   │   ├── workflows/
│   │   ├── integrations/
│   │   ├── models/
│   │   └── services/
│   │
│   ├── tests/
│   └── requirements.txt
│
├── frontend/
│   ├── app/
│   ├── components/
│   ├── hooks/
│   ├── lib/
│   └── package.json
│
└── documentation/
```

---

## Running locally

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL
- Redis
- Google Gemini API key
- AWS account

Optional:

- ServiceNow
- Slack
- Jira
- SharePoint

### Clone

```bash
git clone https://github.com/e-man07/orky-1.0.git
cd orky-1.0
```

### Backend

```bash
cd backend

python -m venv venv
source venv/bin/activate

pip install -r requirements.txt
```

Create your environment file:

```env
DATABASE_URL=your_database_url
REDIS_URL=your_redis_url
GOOGLE_API_KEY=your_google_api_key

AWS_REGION=us-east-1

SECRET_KEY=your_secret_key

FRONTEND_URL=http://localhost:3000
```

Run migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn src.api.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

npm install
npm run dev
```

The frontend will be available at:

```text
http://localhost:3000
```

---

## Documentation

For deeper technical details:

- `TECHNICAL_DOCUMENTATION.md` — technical implementation details
- `TECHNICAL_OVERVIEW.md` — architecture overview
- `PROJECT_REPORT.md` — project status and progress
- `SECURITY_COMPLIANCE_ALIGNMENT_REPORT.md` — security architecture
- `WORKFLOW_SYSTEM_DESIGN.md` — workflow engine design
- `CONVERSATIONAL_AGENT_RESEARCH.md` — conversational agent design
- `JIRA_INTEGRATION_RESEARCH.md` — Jira integration
- `SHAREPOINT_INTEGRATION_RESEARCH.md` — SharePoint integration

---

## Status

ORKY is an experimental enterprise orchestration platform with a working deployed demo.

The current implementation covers:

- [x] Natural-language intent parsing
- [x] Multi-agent orchestration
- [x] AWS EC2 provisioning
- [x] AWS S3 management
- [x] ServiceNow integration
- [x] Jira integration
- [x] Slack approval workflows
- [x] SharePoint integration
- [x] Real-time execution updates
- [x] Execution history
- [x] Multi-turn conversations
- [x] Workflow engine
- [x] Workflow templates
- [x] Google OAuth
- [x] Encrypted credential storage
- [x] Agent logging
- [x] Production deployment

---

## Demo

**Live application:**  
http://demo.orky.io/

**Demo video:**  
https://drive.google.com/file/d/1Qqa6J-YHDtdCU5-qABtZb9WbZS32xvat/view?usp=sharing

**GitHub:**  
https://github.com/e-man07/orky-1.0

---

## License

Proprietary.
