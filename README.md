
# ORKY - Agentic AI Platform for the Enterprise

ORKY is an AI-powered enterprise assistant that unifies knowledge across HR, IT, CRM, and compliance systems into one conversational interface. It provides role-aware answers, executes multi-step agentic workflows, and connects 70+ SaaS applications with 500+ available actions — all with zero information leakage.

Built with Next.js, FastAPI, PostgreSQL (pgvector), and Google Gemini.

---

## Table of Contents

- [Architecture](#architecture)
- [Key Features](#key-features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Authentication](#authentication)
- [AI & RAG Pipeline](#ai--rag-pipeline)
- [Workflow System](#workflow-system)
- [Connected Applications](#connected-applications)
- [API Reference](#api-reference)
- [Scripts & Utilities](#scripts--utilities)

---

## Architecture

```
                          +-------------------+
                          |   Google OAuth    |
                          +--------+----------+
                                   |
                    +--------------v--------------+
                    |     Next.js Frontend        |
                    |     (port 3000)             |
                    |  NextAuth + JWT + SSE       |
                    +--------------+--------------+
                                   | Bearer JWT
                    +--------------v--------------+
                    |     FastAPI Backend          |
                    |     (port 8000)              |
                    |  Chat | Workflows | RAG      |
                    +-+----------+----------+------+
                      |          |          |
             +--------v--+  +---v----+  +--v-----------+
             | PostgreSQL |  | Gemini |  | 70+ App      |
             | + pgvector |  |  API   |  | Integrations |
             |  (Neon)    |  |        |  | (clients/)   |
             +------------+  +--------+  +--------------+
```

**Frontend** (Next.js 14) handles authentication, chat UI, and admin pages. It communicates with the backend via `apiFetch()` which attaches a JWT Bearer token to every request.

**Backend** (FastAPI) handles intent classification, RAG search, action execution, and workflow orchestration. It streams real-time progress to the frontend via Server-Sent Events (SSE).

**Database** (Neon PostgreSQL) stores users, knowledge articles, chat history, workflow definitions, and 768-dimensional vector embeddings for semantic search via pgvector.

---

## Key Features

**Context-Aware Q&A** - Every employee gets answers filtered by their role, department, and designation band. No information leakage.

**Multi-Step Agentic Workflows** - Chain multiple AI agents that execute real actions across connected apps, with real-time progress streaming, file upload support, and automatic email notifications on completion.

**70+ App Integrations** - ServiceNow, Jira, Slack, AWS, Salesforce, SAP, Snowflake, SharePoint, and many more. Each with multiple actions (create tickets, send messages, provision instances, etc.).

**RAG with Access Control** - Knowledge base articles are chunked, embedded, and filtered by user access criteria at query time. Only authorized content surfaces in responses.

**Conversation Memory** - Past chat messages are embedded and retrieved for context, allowing the assistant to recall previous interactions.

**Document Processing** - Upload invoices and documents for AI-powered extraction via AWS Textract, with validation and rejection handling.

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| Next.js 14 | React framework (App Router) |
| NextAuth v4 | Google OAuth + JWT sessions |
| Tailwind CSS | Utility-first styling |
| shadcn/ui (Radix) | Component library |
| Motion | Animations |
| Lucide React | Icons |
| react-markdown | Markdown rendering |

### Backend
| Technology | Purpose |
|---|---|
| FastAPI | Async Python web framework |
| SQLAlchemy 2.0 | Async ORM |
| pgvector | Vector similarity search |
| Google Generative AI | Gemini embeddings + chat |
| python-jose | JWT validation |
| httpx | Async HTTP client |
| boto3 | AWS SDK (S3, EC2, Textract) |
| snowflake-connector | Data warehouse queries |

### Infrastructure
| Technology | Purpose |
|---|---|
| PostgreSQL (Neon) | Serverless database |
| pgvector extension | 768-dim vector storage |
| Prisma | Schema management & migrations |
| Google Gemini | LLM (gemini-2.0-flash) + embeddings (gemini-embedding-001) |

---

## Project Structure

```
orky_hackathon/
├── backend/                    # FastAPI Python server
│   ├── main.py                 # App entry point, CORS, routers
│   ├── config.py               # Pydantic settings
│   ├── database.py             # SQLAlchemy async engine
│   ├── middleware/
│   │   └── auth.py             # JWT validation → User
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── user.py             # User, UserRole, UserCriteria
│   │   ├── knowledge.py        # KnowledgeArticle, ArticleChunk
│   │   ├── app.py              # App, AppAction
│   │   ├── agent.py            # Agent, AgentAction
│   │   ├── workflow.py         # Workflow, WorkflowExecution, StepExecution
│   │   └── chat.py             # ChatSession, ChatMessage
│   ├── routers/                # API route handlers
│   │   ├── chat.py             # /api/chat — messaging + SSE streaming
│   │   ├── agents.py           # /api/agents — CRUD
│   │   ├── workflows.py        # /api/workflows — CRUD + execution
│   │   ├── apps.py             # /api/apps — credentials management
│   │   ├── auth.py             # /api/auth — user profile
│   │   └── executions.py       # /api/executions — logs
│   ├── services/               # Core business logic
│   │   ├── gemini.py           # LLM: embeddings, chat, intent, function calling
│   │   ├── chat_orchestrator.py # Routes messages to KB/actions/workflows
│   │   ├── workflow_engine.py  # Sequential agent orchestration
│   │   ├── agent_executor.py   # Single agent function-calling loop
│   │   ├── action_executor.py  # Dispatches actions to app clients
│   │   └── rag/
│   │       ├── pipeline.py     # Full RAG: access → search → generate
│   │       └── search.py       # pgvector similarity search
│   ├── clients/                # External app integrations (17 clients)
│   │   ├── client_factory.py   # Factory pattern + caching
│   │   ├── servicenow.py       # ITSM: incidents, RITMs, users
│   │   ├── aws.py              # EC2, S3, Textract
│   │   ├── jira.py             # Issues, transitions, comments
│   │   ├── slack.py            # Messages, approvals
│   │   ├── sharepoint.py       # Documents via Microsoft Graph
│   │   ├── snowflake_client.py # SQL queries, table schemas
│   │   ├── salesforce.py       # Leads, cases, SOQL
│   │   ├── sap.py              # Purchase orders, financials
│   │   ├── azure.py            # VMs, Log Analytics
│   │   ├── workday.py          # Workers, positions, time off
│   │   ├── o365.py             # Email, calendar (Graph API)
│   │   ├── whatsapp.py         # Business API messaging
│   │   ├── confluence.py       # Wiki pages, search
│   │   ├── freshworks.py       # Ticketing
│   │   ├── docusign.py         # Envelope signing
│   │   ├── adp.py              # Payroll, worker management
│   │   └── tinyfish.py         # GST/tax compliance
│   └── requirements.txt
├── src/                        # Next.js frontend
│   ├── app/
│   │   ├── page.tsx            # Landing page
│   │   ├── chat/page.tsx       # Main chat interface
│   │   ├── workflows/page.tsx  # Workflow builder
│   │   ├── agents/page.tsx     # Agent management
│   │   ├── apps/page.tsx       # App integrations
│   │   ├── admin/page.tsx      # Admin dashboard
│   │   ├── layout.tsx          # Root layout + providers
│   │   └── api/auth/[...nextauth]/route.ts
│   ├── components/
│   │   ├── Sidebar.tsx         # Navigation + session list
│   │   ├── ChatMessage.tsx     # Message rendering (sources, actions)
│   │   ├── ChatInput.tsx       # Input with file attachment
│   │   ├── WorkflowProgress.tsx # Real-time step progress
│   │   ├── ExecutionMessage.tsx # Execution status display
│   │   ├── ui/                 # shadcn/ui primitives
│   │   ├── agents/             # AgentCard, AgentForm
│   │   ├── workflows/          # WorkflowCard, WorkflowForm, ExecutionTimeline
│   │   └── apps/               # App credential forms
│   ├── lib/
│   │   ├── api.ts              # apiFetch + SSE parser
│   │   ├── auth.ts             # NextAuth config (Google OAuth + JWT)
│   │   └── prisma.ts           # Prisma client singleton
│   ├── data/
│   │   └── apps.ts             # 70+ app definitions with logos
│   └── types/
│       └── index.ts            # TypeScript interfaces
├── prisma/
│   ├── schema.prisma           # Database schema (28 models)
│   └── migrations/             # SQL migration files
├── scripts/                    # Data sync & seeding utilities
├── public/logos/               # App integration logos
└── package.json
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- PostgreSQL with pgvector extension (or a Neon account)
- Google Cloud project with OAuth credentials + Gemini API key

### 1. Clone & install dependencies

```bash
git clone https://github.com/e-man07/orky-1.0.git
cd orky-1.0

# Frontend
npm install

# Backend
cd backend
pip install -r requirements.txt
cd ..
```

### 2. Configure environment variables

Create `.env.local` in the project root and `backend/.env` (see [Environment Variables](#environment-variables) below).

### 3. Set up the database

```bash
# Push schema to database
npx prisma db push

# Generate Prisma client
npx prisma generate

# Seed app integrations (run once)
npx tsx scripts/seed-apps.ts
```

### 4. Start the servers

```bash
# Terminal 1 — Frontend (port 3000)
npm run dev

# Terminal 2 — Backend (port 8000)
cd backend
uvicorn main:app --reload
```

Open http://localhost:3000 and sign in with Google.

---

## Environment Variables

### Frontend (`.env.local`)

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<32+ character random string>
GOOGLE_CLIENT_ID=<Google OAuth client ID>
GOOGLE_CLIENT_SECRET=<Google OAuth client secret>
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Backend (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require

# AI
GOOGLE_API_KEY=<Gemini API key>

# Auth (must match frontend)
NEXTAUTH_SECRET=<same secret as frontend>

# ServiceNow (optional)
SERVICENOW_BASE_URL=https://instance.service-now.com
SERVICENOW_USER_ID=<username>
SERVICENOW_PASSWORD=<password>

# SharePoint (optional)
SHAREPOINT_TENANT_ID=<Azure AD tenant>
SHAREPOINT_CLIENT_ID=<App registration ID>
SHAREPOINT_CLIENT_SECRET=<App secret>
SHAREPOINT_SITE=tenant.sharepoint.com/sites/SiteName

# Email notifications (optional)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=<gmail address>
SMTP_PASSWORD=<gmail app password>
FROM_EMAIL=<gmail address>

# CORS
FRONTEND_URL=http://localhost:3000
```

App-specific credentials (AWS, Jira, Slack, Snowflake, etc.) are stored per-app in the database via the Apps admin page, not as environment variables.

---

## Database

PostgreSQL with the **pgvector** extension for vector similarity search.

### Key Tables

| Table | Purpose |
|---|---|
| `users` | Employees with department, location, title |
| `user_roles` | Role assignments per user |
| `user_criteria` | Access control rules (e.g., designation bands) |
| `knowledge_articles` | KB articles from ServiceNow/SharePoint/Excel |
| `article_chunks` | Chunked article content with 768-dim embeddings |
| `article_criteria` | Maps articles to access criteria |
| `chat_sessions` | Per-user conversation sessions |
| `chat_messages` | Messages with embeddings for memory retrieval |
| `apps` | 70+ app definitions with credentials (JSON) |
| `app_actions` | Actions per app with input schemas |
| `agents` | AI agents with role, steps, model config |
| `workflows` | Multi-step workflow definitions |
| `workflow_executions` | Execution instances with state tracking |
| `step_executions` | Per-step results (thinking, actions, output) |

### Migrations

```bash
npx prisma migrate dev --name <name>   # Create migration
npx prisma db push                     # Push schema (no migration)
npx prisma generate                    # Regenerate client
```

---

## Authentication

```
User → Google OAuth → NextAuth → JWT (HS256) → apiFetch → FastAPI → python-jose validates
```

1. User signs in via Google OAuth on the landing page
2. NextAuth creates/finds the user in PostgreSQL via Prisma
3. A JWT is signed with `NEXTAUTH_SECRET` (HS256, 30-day expiry)
4. The frontend's `apiFetch()` attaches the JWT as a Bearer token on every API call
5. FastAPI's `get_current_user()` middleware validates the JWT via python-jose and returns the User object with roles

Role-based access filtering is applied in the RAG pipeline and workflow trigger matching.

---

## AI & RAG Pipeline

### Models

| Model | Purpose | Dimensions |
|---|---|---|
| `gemini-embedding-001` | Text embeddings | 768 |
| `gemini-2.0-flash` | Chat, intent classification, function calling | — |

### How RAG Works

1. **Offline**: Knowledge articles are chunked (~1500 chars), embedded, and stored with pgvector
2. **Query time**: User message is embedded and compared via cosine similarity (threshold 0.5, top 5)
3. **Access filtering**: Only articles matching the user's designation criteria are returned
4. **Context assembly**: Relevant chunks + past chat messages are assembled into a prompt
5. **Generation**: Gemini generates a grounded response with source citations

### Intent Classification

Every user message is classified into one of three intents:

- **kb_query** - Answerable from the knowledge base (triggers RAG)
- **workflow** - Action request like "create an incident" (triggers function calling or workflow)
- **conversational** - Small talk, greetings (direct LLM response)

### Function Calling

For action intents, available app actions are converted to Gemini FunctionDeclarations. The model decides which actions to call, with what parameters, and the system executes them against real APIs in a loop (up to 5 rounds).

---

## Workflow System

Workflows chain multiple AI agents that execute sequentially, passing results between steps.

### Definition

```
Workflow
├── name, description, trigger_roles[]
└── WorkflowAgents[] (ordered by step_order)
    ├── Agent (name, role, steps, model)
    ├── step_order (1, 2, 3...)
    └── taskPrompt (instruction override)
```

### Execution Flow

```
User message matched → Create execution → Run agents sequentially
                                            │
                         ┌──────────────────┼────────────────┐
                         │                  │                │
                    Step started      Step completed     Step failed
                    (SSE event)       (SSE event)       (SSE event)
                                          │                │
                                    Next step...     Execution fails
                                          │
                                   All steps done
                                          │
                              ┌────────────┴──────────┐
                              │                       │
                       Mark completed           Send email
                       (SSE: response)     (SSE: notification_sent)
```

### Features

- **Real-time streaming** - SSE events for each step start/complete/fail
- **Variable passing** - Step N output available to Step N+1 via shared variables
- **File upload pause** - Workflow pauses if a step needs a file; resumes after upload
- **Document rejection** - Agent can reject invalid documents and request re-upload
- **Email notification** - Automatic completion email via Gmail SMTP (silent skip if unconfigured)
- **AI workflow generation** - Describe what you want and Gemini generates the workflow definition

---

## Connected Applications

### Fully Integrated (17 clients with live API support)

| App | Category | Key Actions |
|---|---|---|
| **ServiceNow** | ITSM/HR | Create/update/close incidents, RITMs, user records |
| **AWS** | Cloud | EC2 instances, S3 buckets, Textract document extraction |
| **Jira** | Project Management | Create/update/transition issues, comments, search |
| **Slack** | Communication | Send messages, approval requests |
| **SharePoint** | Collaboration | List/upload/search files (Microsoft Graph) |
| **Snowflake** | Data Warehouse | Execute queries, describe tables |
| **Salesforce** | CRM | Leads, cases, opportunities, SOQL queries |
| **SAP** | ERP | Purchase orders, material stock, financials |
| **Azure** | Cloud | VMs, Log Analytics queries |
| **Workday** | HR | Worker info, positions, time off |
| **Office 365** | Productivity | Email, calendar events |
| **WhatsApp** | Communication | Business API messaging |
| **Confluence** | Collaboration | Wiki pages, content search |
| **Freshworks** | Support | Ticket management |
| **DocuSign** | Legal | Envelope signing, status checks |
| **ADP** | Payroll | Worker details, payroll summaries |
| **Tinyfish** | Compliance | GSTIN verification, tax validation |

### Pro Tier (30+ additional apps)

Google Workspace, GitHub, GitLab, Datadog, PagerDuty, Splunk, Terraform, Jenkins, Zendesk, HubSpot, Tableau, Power BI, MongoDB, Redis, Okta, CrowdStrike, Twilio, Stripe, Microsoft Teams, Notion, Asana, and more.

---

## API Reference

### Chat

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat/stream` | Send message with SSE streaming response |
| POST | `/api/chat/upload` | Upload file to S3 |
| GET | `/api/chat/sessions` | List user's chat sessions |
| GET | `/api/chat/sessions/{id}/messages` | Load session messages |

### Agents

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/agents` | List user's agents |
| POST | `/api/agents` | Create agent with actions |
| GET | `/api/agents/{id}` | Get agent details |
| PATCH | `/api/agents/{id}` | Update agent |
| DELETE | `/api/agents/{id}` | Delete agent |

### Workflows

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/workflows` | List user's workflows |
| POST | `/api/workflows` | Create workflow |
| POST | `/api/workflows/{id}/execute` | Start workflow execution |
| POST | `/api/workflows/generate` | AI-generate workflow from description |
| PATCH | `/api/workflows/{id}` | Update workflow |
| DELETE | `/api/workflows/{id}` | Delete workflow |

### Apps

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/apps` | List all apps with action counts |
| GET | `/api/apps/{id}` | Get app + actions |
| POST | `/api/apps/{id}/credentials` | Save app credentials |

### Auth

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/auth/me` | Current user profile + roles + criteria |

---

## Scripts & Utilities

| Script | Command | Purpose |
|---|---|---|
| `seed-apps.ts` | `npx tsx scripts/seed-apps.ts` | Create 70+ app definitions with actions |
| `run-servicenow-sync.ts` | `npx tsx scripts/run-servicenow-sync.ts` | Import KB articles from ServiceNow |
| `run-sharepoint-sync.ts` | `npx tsx scripts/run-sharepoint-sync.ts` | Import documents from SharePoint |
| `sync-roles-criteria.ts` | `npx tsx scripts/sync-roles-criteria.ts` | Create designation-based access criteria |
| `assign-roles.ts` | `npx tsx scripts/assign-roles.ts` | Sync user roles from ServiceNow |
| `summarize-articles.ts` | `npx tsx scripts/summarize-articles.ts` | Clean/summarize raw article HTML |

---



