# Freshservice Integration Research

> Research document for integrating Freshservice (ITSM) as a new app in ORKY.
> Created: 2026-03-05

---

## 1. Freshservice vs Freshdesk — Clarification

Both are Freshworks products, but they serve different purposes and have **separate APIs**:

| | Freshdesk | Freshservice |
|---|---|---|
| **Purpose** | Customer support / helpdesk | Internal IT Service Management (ITSM) |
| **API Domain** | `{domain}.freshdesk.com/api/v2` | `{domain}.freshservice.com/api/v2` |
| **Key Modules** | Tickets, contacts, companies | Tickets (incidents), changes, problems, releases, assets/CMDB, service catalog |
| **ITIL Alignment** | No | Yes (incident, problem, change, release, CMDB) |
| **Existing in ORKY** | Yes — `freshworks` slug in `backend/clients/freshworks.py` | **Not yet — this is what we're adding** |

The existing `freshworks` integration (slug `"freshworks"`, category `"Customer Support"`) targets **Freshdesk** with 3 actions: `create_ticket`, `update_ticket`, `list_tickets`. Freshservice requires a completely separate client, slug, and action set.

---

## 2. API Overview

### Base URL
```
https://{your-domain}.freshservice.com/api/v2/{resource}
```
All requests must use HTTPS. The API is RESTful and returns JSON.

### Authentication

**Primary: API Key (Basic Auth)**
- Use HTTP Basic Auth with the API key as the username and `X` as the password.
- Base64-encode `APIkey:X` and pass as `Authorization: Basic {encoded}` header.
- API keys are found in Freshservice under Profile Settings.

```bash
curl -u "YOUR_API_KEY:X" -H "Content-Type: application/json" \
  https://domain.freshservice.com/api/v2/tickets
```

**Secondary: OAuth 2.0** — Available for marketplace apps via the Freshworks Developer Portal (Authorization Code flow). Not needed for our server-side integration.

### Rate Limits (per minute, account-level)

| Plan | Requests/min |
|---|---|
| Starter | 100 |
| Growth | 200 |
| Pro | 400 |
| Enterprise | 500 |

Rate limit headers: `X-Ratelimit-Total`, `X-Ratelimit-Remaining`, `X-Ratelimit-Used-CurrentRequest`, `Retry-After`. HTTP 429 returned when exceeded. Using `?include=` parameters consumes additional credits (typically +2 per include).

### Pagination
- Offset-based: `?page=1&per_page=30` (default 30, max 100 per page, max page 500)
- Response `Link` header contains the next page URL when available.
- Ticket list endpoints return only last 30 days by default; use `?updated_since=` for older data.

### HTTP Status Codes
| Code | Meaning |
|---|---|
| 200 | Success (GET/PUT) |
| 201 | Created (POST) |
| 204 | No Content (DELETE) |
| 400 | Bad Request |
| 401 | Auth failed |
| 403 | Insufficient permissions |
| 404 | Not found |
| 429 | Rate limited |

---

## 3. Available API Endpoints

### 3.1 Tickets (Incidents)

| Operation | Method | Endpoint |
|---|---|---|
| Create | POST | `/api/v2/tickets` |
| View | GET | `/api/v2/tickets/{id}` |
| List All | GET | `/api/v2/tickets` |
| Update | PUT | `/api/v2/tickets/{id}` |
| Delete | DELETE | `/api/v2/tickets/{id}` |
| Restore | PUT | `/api/v2/tickets/{id}/restore` |
| Filter | GET | `/api/v2/tickets/filter?query="..."` |
| Activities | GET | `/api/v2/tickets/{id}/activities` |
| Ticket Fields | GET | `/api/v2/ticket_fields` |

**Filter query syntax:** `"(priority:4 OR priority:3) AND status:2"` — supports AND/OR, parentheses, up to 512 chars.

**Include parameter:** `?include=conversations,requester,problem,stats,assets,change,related_tickets`

**Nested resources under tickets:**
- Conversations: `GET/POST /api/v2/tickets/{id}/conversations`, `POST .../reply`, `POST .../notes`
- Tasks: CRUD at `/api/v2/tickets/{id}/tasks[/{task_id}]`
- Time Entries: CRUD at `/api/v2/tickets/{id}/time_entries[/{entry_id}]`
- Approvals: CRUD at `/api/v2/tickets/{id}/approvals[/{approval_id}]`

### 3.2 Service Catalog / Service Requests

| Operation | Method | Endpoint |
|---|---|---|
| List Catalog Items | GET | `/api/v2/service_catalog/items` |
| View Catalog Item | GET | `/api/v2/service_catalog/items/{id}` |
| List Categories | GET | `/api/v2/service_catalog/categories` |
| Place Service Request | POST | `/api/v2/service_catalog/items/{id}/place_request` |
| View Requested Items | GET | `/api/v2/tickets/{id}/requested_items` |

Service requests are managed as tickets (with `type` = "Service Request") once created.

### 3.3 Changes

| Operation | Method | Endpoint |
|---|---|---|
| Create | POST | `/api/v2/changes` |
| View | GET | `/api/v2/changes/{id}` |
| List All | GET | `/api/v2/changes` |
| Update | PUT | `/api/v2/changes/{id}` |
| Delete | DELETE | `/api/v2/changes/{id}` |
| Change Fields | GET | `/api/v2/change_fields` |

Nested: Notes, Tasks, Time Entries (same pattern as tickets).

### 3.4 Problems

| Operation | Method | Endpoint |
|---|---|---|
| Create | POST | `/api/v2/problems` |
| View | GET | `/api/v2/problems/{id}` |
| List All | GET | `/api/v2/problems` |
| Update | PUT | `/api/v2/problems/{id}` |
| Delete | DELETE | `/api/v2/problems/{id}` |

Nested: Notes, Tasks, Time Entries.

### 3.5 Releases

| Operation | Method | Endpoint |
|---|---|---|
| Create | POST | `/api/v2/releases` |
| View | GET | `/api/v2/releases/{id}` |
| List All | GET | `/api/v2/releases` |
| Update | PUT | `/api/v2/releases/{id}` |
| Delete | DELETE | `/api/v2/releases/{id}` |

Nested: Notes, Tasks, Time Entries.

### 3.6 Assets / CMDB

| Operation | Method | Endpoint |
|---|---|---|
| Create | POST | `/api/v2/assets` |
| View | GET | `/api/v2/assets/{display_id}` |
| List All | GET | `/api/v2/assets` |
| Filter | GET | `/api/v2/assets?filter=...` |
| Update | PUT | `/api/v2/assets/{display_id}` |
| Delete | DELETE | `/api/v2/assets/{display_id}` |
| Components | CRUD | `/api/v2/assets/{display_id}/components[/{id}]` |

**Note:** Assets use `display_id`, not the internal `id`.

Additional CMDB resources:
- Asset Types: CRUD at `/api/v2/asset_types[/{id}]`
- Relationships: `/api/v2/relationships` (bulk-create, delete, view)
- Software: CRUD at `/api/v2/applications[/{id}]`

### 3.7 Knowledge Base / Solutions

| Operation | Method | Endpoint |
|---|---|---|
| Categories | CRUD | `/api/v2/solutions/categories[/{id}]` |
| Folders | CRUD | `/api/v2/solutions/folders[/{id}]` |
| Articles | CRUD | `/api/v2/solutions/articles[/{id}]` |
| Articles in Folder | GET | `/api/v2/solutions/folders/{folder_id}/articles` |

### 3.8 Requesters & Agents

**Requesters:** CRUD + filter at `/api/v2/requesters[/{id}]`
- Requester Groups: CRUD at `/api/v2/requester_groups[/{id}]`
- GDPR: `DELETE /api/v2/requesters/{id}/forget`

**Agents:** CRUD + filter at `/api/v2/agents[/{id}]`
- Current agent: `GET /api/v2/agents/me`
- Agent Groups: CRUD at `/api/v2/groups[/{id}]`

### 3.9 Other Resources

| Resource | Endpoint |
|---|---|
| Departments | `/api/v2/departments[/{id}]` |
| Locations | `/api/v2/locations[/{id}]` |
| Vendors | `/api/v2/vendors[/{id}]` |
| Products | `/api/v2/products[/{id}]` |
| Contracts | `/api/v2/contracts[/{id}]` |
| Purchase Orders | `/api/v2/purchase_orders[/{id}]` |
| Roles | `/api/v2/roles[/{id}]` (read-only) |
| Workspaces | `/api/v2/workspaces[/{id}]` (read-only) |
| Business Hours | `/api/v2/business_hours[/{id}]` |
| Onboarding | `/api/v2/onboarding_requests` |
| Projects | `/api/v2/projects[/{id}]` |
| Custom Objects | `/api/v2/objects[/{name}]/records[/{id}]` |

### 3.10 Webhooks (Outbound)

Freshservice supports outbound webhooks via the **Workflow Automator** (admin panel, not API):
- Triggers: Ticket Created/Updated, Change, Problem, Release, Asset events
- Actions: HTTP GET/POST/PUT/PATCH/DELETE to external URLs
- Auth: Username/Password or API Key
- Content: JSON or XML, with dynamic placeholders (`{{ticket.id}}`, `{{requestor.email}}`)
- Limits: 1,000 webhook calls/hour, 15-second timeout, 4 retries

---

## 4. MCP Server Ecosystem

### 4.1 effytech/freshservice_mcp (Recommended)

| Attribute | Value |
|---|---|
| **Repository** | [github.com/effytech/freshservice_mcp](https://github.com/effytech/freshservice_mcp) |
| **PyPI** | `freshservice-mcp` v1.0.0 |
| **License** | MIT |
| **Stars** | 18 |
| **Forks** | 26 |
| **Contributors** | 7 |
| **Last Commit** | December 1, 2025 |
| **Language** | Python (99.5%) |

**Configuration:**
```json
{
  "mcpServers": {
    "freshservice_mcp": {
      "command": "uvx",
      "args": ["freshservice-mcp"],
      "env": {
        "FRESHSERVICE_APIKEY": "<your_api_key>",
        "FRESHSERVICE_DOMAIN": "<your_domain>"
      }
    }
  }
}
```

**Tools (92 total):**
- **Tickets (7):** get, create, update, delete, filter, list, get by ID
- **Conversations & Notes (4):** reply, create note, update, list
- **Changes (9):** full CRUD + filter + close + move + list fields
- **Change Approvals (9):** create/update/cancel approval groups, view/list approvals, send reminders
- **Change Notes (5):** CRUD
- **Change Tasks (5):** CRUD
- **Change Time Entries (5):** CRUD
- **Service Catalog (3):** list items, get requested items, create service request
- **Products (4):** CRUD
- **Requesters (6):** CRUD + filter + list fields
- **Agents (6):** CRUD + filter + get fields
- **Agent Groups (5):** CRUD + add members
- **Requester Groups (5):** CRUD + list members
- **Canned Responses (4):** get/list responses and folders
- **Workspaces (2):** list + get
- **Knowledge Base (12):** Categories, Folders, Articles — CRUD + publish

**Known Limitations:**
- No Asset/CMDB management tools (open issue #25)
- No Problem management tools
- No Release management tools
- Filter queries must be wrapped in double quotes or 500 errors occur (partially fixed in PRs #18, #20)
- Monolithic `server.py` (~2000+ lines) — issue #25 proposes modular rewrite

### 4.2 Zapier MCP (Commercial)

- 5 actions only: Add Notes, Create Ticket, Create Requester, Request Approval, Raw API Request
- Hosted SaaS — 1 MCP call = 2 Zapier tasks
- No change/asset/KB management
- **Not recommended** for ORKY due to limited scope and cost

### 4.3 Arcade Freshservice API

- 214 auto-generated tools from OpenAPI spec
- Most comprehensive coverage (tickets, changes, problems, assets, projects, etc.)
- Marked "Unoptimized" by Arcade — tool descriptions less human-friendly
- Requires Arcade platform dependency
- **Potential reference** for understanding full API surface

### 4.4 Comparison

| Feature | effytech (Recommended) | Zapier | Arcade |
|---|---|---|---|
| Tools | 92 | 5 | 214 |
| Self-hosted | Yes | No | Yes (with Arcade) |
| Tickets | Full CRUD + filter | Create + notes | Full CRUD |
| Changes | Full lifecycle | None | Full |
| Assets/CMDB | None | None | Yes |
| Problems | None | None | Yes |
| Knowledge Base | Yes | None | Yes |
| Service Catalog | Yes | None | Yes |
| Cost | Free (MIT) | $0.05-0.10/call | Free (MIT) + platform |

---

## 5. Recommended Actions for ORKY

Based on the ServiceNow integration pattern (9 actions) and Freshservice's ITSM capabilities, here are the recommended actions to implement:

### Tier 1 — Core (MVP, mirrors ServiceNow)

| Action Name | Display Name | Description | Maps To |
|---|---|---|---|
| `create_ticket` | Create Ticket | Create a new incident/ticket | `POST /api/v2/tickets` |
| `update_ticket` | Update Ticket | Update an existing ticket | `PUT /api/v2/tickets/{id}` |
| `get_ticket` | Get Ticket | Retrieve a ticket by ID | `GET /api/v2/tickets/{id}` |
| `list_tickets` | List Tickets | List tickets with optional filters | `GET /api/v2/tickets` |
| `close_ticket` | Close Ticket | Close/resolve a ticket | `PUT /api/v2/tickets/{id}` (status=5) |
| `create_service_request` | Create Service Request | Place a service catalog request | `POST /api/v2/service_catalog/items/{id}/place_request` |
| `add_ticket_note` | Add Ticket Note | Add a note/comment to a ticket | `POST /api/v2/tickets/{id}/notes` |

### Tier 2 — Extended ITSM

| Action Name | Display Name | Description | Maps To |
|---|---|---|---|
| `create_change` | Create Change | Create a change request | `POST /api/v2/changes` |
| `update_change` | Update Change | Update a change request | `PUT /api/v2/changes/{id}` |
| `get_change` | Get Change | Retrieve a change by ID | `GET /api/v2/changes/{id}` |
| `create_problem` | Create Problem | Create a problem record | `POST /api/v2/problems` |
| `get_asset` | Get Asset | Retrieve an asset by display ID | `GET /api/v2/assets/{display_id}` |
| `list_assets` | List Assets | List assets with optional filters | `GET /api/v2/assets` |
| `search_articles` | Search Articles | Search knowledge base articles | `GET /api/v2/solutions/articles` |

### Input Schemas (Tier 1)

**create_ticket:**
```json
{
  "type": "object",
  "properties": {
    "subject": { "type": "string", "description": "Ticket subject/title" },
    "description": { "type": "string", "description": "HTML description of the ticket" },
    "email": { "type": "string", "description": "Email of the requester" },
    "priority": { "type": "integer", "enum": [1, 2, 3, 4], "description": "1=Low, 2=Medium, 3=High, 4=Urgent" },
    "status": { "type": "integer", "enum": [2, 3, 4, 5], "description": "2=Open, 3=Pending, 4=Resolved, 5=Closed" },
    "urgency": { "type": "integer", "enum": [1, 2, 3], "description": "1=Low, 2=Medium, 3=High" },
    "impact": { "type": "integer", "enum": [1, 2, 3], "description": "1=Low, 2=Medium, 3=High" },
    "category": { "type": "string", "description": "Ticket category" },
    "group_id": { "type": "integer", "description": "ID of the agent group to assign" },
    "responder_id": { "type": "integer", "description": "ID of the agent to assign" }
  },
  "required": ["subject", "description", "email", "priority", "status"]
}
```

**update_ticket:**
```json
{
  "type": "object",
  "properties": {
    "ticket_id": { "type": "integer", "description": "ID of the ticket to update" },
    "status": { "type": "integer", "description": "2=Open, 3=Pending, 4=Resolved, 5=Closed" },
    "priority": { "type": "integer", "description": "1=Low, 2=Medium, 3=High, 4=Urgent" },
    "category": { "type": "string" },
    "group_id": { "type": "integer" },
    "responder_id": { "type": "integer" }
  },
  "required": ["ticket_id"]
}
```

**get_ticket:**
```json
{
  "type": "object",
  "properties": {
    "ticket_id": { "type": "integer", "description": "ID of the ticket to retrieve" }
  },
  "required": ["ticket_id"]
}
```

**list_tickets:**
```json
{
  "type": "object",
  "properties": {
    "filter": { "type": "string", "description": "Filter query, e.g. \"priority:3 AND status:2\"" },
    "per_page": { "type": "integer", "description": "Results per page (max 100)", "default": 30 },
    "page": { "type": "integer", "description": "Page number", "default": 1 }
  }
}
```

**close_ticket:**
```json
{
  "type": "object",
  "properties": {
    "ticket_id": { "type": "integer", "description": "ID of the ticket to close" },
    "close_notes": { "type": "string", "description": "Resolution notes" }
  },
  "required": ["ticket_id"]
}
```

**create_service_request:**
```json
{
  "type": "object",
  "properties": {
    "catalog_item_id": { "type": "integer", "description": "Service catalog item ID" },
    "email": { "type": "string", "description": "Email of the requester" },
    "quantity": { "type": "integer", "default": 1 },
    "custom_fields": { "type": "object", "description": "Custom field values for the catalog item" }
  },
  "required": ["catalog_item_id", "email"]
}
```

**add_ticket_note:**
```json
{
  "type": "object",
  "properties": {
    "ticket_id": { "type": "integer", "description": "ID of the ticket" },
    "body": { "type": "string", "description": "Note content (HTML supported)" },
    "private": { "type": "boolean", "description": "Whether the note is private", "default": true }
  },
  "required": ["ticket_id", "body"]
}
```

---

## 6. Implementation Plan

### Files to Create

**`backend/clients/freshservice.py`** — Async client class

```
class FreshserviceClient:
    __init__(self, domain: str, api_key: str)
        - base_url = f"https://{domain}/api/v2"
        - auth header: Basic base64(api_key:X)

    _request(self, method, endpoint, json_data, params, max_attempts=3)
        - httpx.AsyncClient, 30s timeout
        - Retry on [429, 500, 502, 503, 504] with exponential backoff
        - Respect Retry-After header on 429

    _ticket_url(self, ticket_id) -> str
        - Returns browser URL: https://{domain}/a/tickets/{ticket_id}

    # Tier 1 actions
    create_ticket(data: dict) -> dict
    update_ticket(ticket_id: int, data: dict) -> dict
    get_ticket(ticket_id: int) -> dict
    list_tickets(params: dict) -> list
    close_ticket(ticket_id: int, close_notes: str) -> dict
    create_service_request(catalog_item_id: int, data: dict) -> dict
    add_ticket_note(ticket_id: int, body: str, private: bool) -> dict

    # Tier 2 actions (add later)
    create_change(data: dict) -> dict
    update_change(change_id: int, data: dict) -> dict
    get_change(change_id: int) -> dict
    create_problem(data: dict) -> dict
    get_asset(display_id: int) -> dict
    list_assets(params: dict) -> list
    search_articles(query: str) -> list
```

### Files to Modify

**`backend/clients/client_factory.py`**
```python
# Add import
from clients.freshservice import FreshserviceClient

# Add elif branch
elif app_slug == "freshservice":
    client = FreshserviceClient(
        credentials["domain"],
        credentials["api_key"],
    )
```

**`backend/services/action_executor.py`**
```python
# Add elif block for freshservice
elif app_slug == "freshservice":
    if action_name == "create_ticket":
        result = await client.create_ticket(params)
    elif action_name == "update_ticket":
        result = await client.update_ticket(params["ticket_id"], params)
    elif action_name == "get_ticket":
        result = await client.get_ticket(params["ticket_id"])
    elif action_name == "list_tickets":
        result = await client.list_tickets(params)
    elif action_name == "close_ticket":
        result = await client.close_ticket(params["ticket_id"], params.get("close_notes", ""))
    elif action_name == "create_service_request":
        result = await client.create_service_request(params["catalog_item_id"], params)
    elif action_name == "add_ticket_note":
        result = await client.add_ticket_note(params["ticket_id"], params["body"], params.get("private", True))
    else:
        raise ValueError(f"Unknown Freshservice action: {action_name}")
```

**`scripts/seed-apps.ts`**
```typescript
// Add to apps array
{
  name: 'Freshservice',
  slug: 'freshservice',
  description: 'IT Service Management platform for incident, change, and asset management',
  icon: 'Headset',
  logoUrl: '/logos/freshservice.png',
  category: 'ITSM',
  actions: [
    { name: 'create_ticket', displayName: 'Create Ticket', ... },
    { name: 'update_ticket', displayName: 'Update Ticket', ... },
    { name: 'get_ticket', displayName: 'Get Ticket', ... },
    { name: 'list_tickets', displayName: 'List Tickets', ... },
    { name: 'close_ticket', displayName: 'Close Ticket', ... },
    { name: 'create_service_request', displayName: 'Create Service Request', ... },
    { name: 'add_ticket_note', displayName: 'Add Ticket Note', ... },
  ],
}
```

**`src/data/apps.ts`**
```typescript
// Add to APP_CATALOG
{
  name: 'Freshservice',
  slug: 'freshservice',
  description: 'IT Service Management platform for incident, change, and asset management',
  icon: 'Headset',
  logoUrl: '/logos/freshservice.png',
  category: 'ITSM',
  credentialFields: [
    { key: 'domain', label: 'Domain', placeholder: 'yourcompany.freshservice.com' },
    { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Freshservice API key' },
  ],
  actions: [ ... ],
}

// Add to CONFIGURABLE_SLUGS
CONFIGURABLE_SLUGS = ['servicenow', 'aws', 'snowflake', 'slack', 'sharepoint', 'tinyfish', 'freshservice']
```

### Credential Fields

| Key | Label | Type | Placeholder | Notes |
|---|---|---|---|---|
| `domain` | Domain | text | `yourcompany.freshservice.com` | Full domain, no protocol prefix |
| `api_key` | API Key | password | `Your Freshservice API key` | Found in Freshservice > Profile > API Settings |

### Key Differences from ServiceNow Pattern

| Aspect | ServiceNow | Freshservice |
|---|---|---|
| Auth | Username + Password (Basic) | API Key + `X` (Basic) |
| Base URL | `{instance}/api/now/table/{table}` | `{domain}/api/v2/{resource}` |
| Record IDs | `sys_id` (string/UUID) | Integer IDs |
| Asset IDs | N/A in current integration | `display_id` (not internal `id`) |
| Service Requests | `sc_req_item` table | Service Catalog API with `place_request` |
| Ticket statuses | Numeric but different values | 2=Open, 3=Pending, 4=Resolved, 5=Closed |

---

## References

- [Freshservice API v2 Documentation](https://api.freshservice.com/)
- [effytech/freshservice_mcp GitHub](https://github.com/effytech/freshservice_mcp)
- [Freshservice Rate Limits](https://support.freshservice.com/support/solutions/articles/50000000293)
- [Freshservice Webhook Automator](https://support.freshservice.com/support/solutions/articles/157143)
- [Arcade Freshservice MCP](https://docs.arcade.dev/en/mcp-servers/customer-support/freshservice-api)
- [Zapier Freshservice MCP](https://zapier.com/mcp/freshservice)
