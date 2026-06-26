# SLM for Reasoning & Planning in ORKY

**Research Document — March 2026**

---

## Table of Contents

1. [Problem Statement: Where Gemini 2.0 Flash Falls Short](#1-problem-statement-where-gemini-20-flash-falls-short)
2. [Why an SLM for Reasoning Is a Strong Idea](#2-why-an-slm-for-reasoning-is-a-strong-idea)
3. [Model Candidates & Benchmarks](#3-model-candidates--benchmarks)
4. [Architecture Proposals: Hybrid SLM + LLM](#4-architecture-proposals-hybrid-slm--llm)
5. [Deployment Options for FastAPI Integration](#5-deployment-options-for-fastapi-integration)
   - 5.5 [TOON Format for Token-Efficient Data Serialization](#55-toon-format-for-token-efficient-data-serialization)
   - 5.6 [Akash Network Deployment](#56-akash-network-deployment)
6. [Fine-Tuning Strategy](#6-fine-tuning-strategy)
7. [Challenges & Pitfalls](#7-challenges--pitfalls)
8. [Recommendation & Next Steps](#8-recommendation--next-steps)
9. [Sources & References](#9-sources--references)

---

## 1. Problem Statement: Where Gemini 2.0 Flash Falls Short

ORKY currently uses **Gemini 2.0 Flash** as its sole LLM for every cognitive task: intent classification, workflow generation, agent planning, function calling, and summarization. While Flash is fast and cheap, we've observed recurring quality issues in the reasoning-heavy parts of the pipeline.

### 1.1 Observed Failure Modes

| Failure Mode | Where It Happens | Code Evidence |
|---|---|---|
| **Non-compliant output format** | Intent classifier returns full sentences instead of a single category label | `backend/services/gemini.py:141-145` — fallback keyword matching exists because Gemini ignores "Respond with ONLY the category name" |
| **JSON wrapped in markdown** | Workflow generator receives `` ```json ... ``` `` despite explicit "no markdown" instructions | `backend/services/workflow_generator.py:79-88` — 10 lines of defensive stripping |
| **Missing or wrong steps** | Generated workflows omit necessary agents or pick wrong actions from the catalog | Observed at runtime; the 9-rule prompt in `workflow_generator.py:48-58` is an attempt to constrain this |
| **Poor multi-step planning** | Agent executor hits the 5-round function calling limit without completing the task | `backend/services/agent_executor.py:124` — hard cap of 5 rounds with no graceful handling |
| **Action name collisions** | Gemini selects the wrong action when multiple apps share similar action names | `backend/services/chat_orchestrator.py:94` — workaround: prefix with `{app_slug}__` |
| **Hallucinated parameters** | Function calls include invented parameter names or values not in the schema | Observed in agent execution logs |

### 1.2 Root Cause Analysis

These are not prompt engineering failures — the prompts are already well-structured with role definitions, explicit schemas, numbered rules, and output constraints. The root cause is that **Gemini 2.0 Flash is optimized for speed and cost, not for structured reasoning**. It is a general-purpose model that treats planning as a text generation task rather than a logical decomposition task.

The pipeline requires two fundamentally different cognitive capabilities:
- **Reasoning/Planning**: Decomposing a user request into ordered steps, selecting correct tools from a catalog, managing dependencies between steps — this demands *precision and logic*.
- **Generation/Conversation**: Writing friendly summaries, composing emails, answering KB questions — this demands *fluency and creativity*.

Using one model for both is a known anti-pattern in modern agentic AI. The industry is moving toward **specialized model routing** where different models handle different cognitive tasks.

---

## 2. Why an SLM for Reasoning Is a Strong Idea

### 2.1 The Research Consensus

Recent research strongly supports using Small Language Models (1B–8B parameters) for agentic tasks:

- **"Small Language Models for Efficient Agentic Tool Calling"** (Dec 2025) demonstrated that fine-tuned SLMs achieve a **77.55% pass rate** on ToolBench evaluation, outperforming ChatGPT-CoT (26.00%) and ToolLLaMA variants by 3–4x.

- **"Small Language Models are the Future of Agentic AI"** (Belcak & Heinrich, Jun 2025) found that **80–90% of agentic tasks** fall into the "SLM is good enough" category, with SLMs retaining **80–87% of LLM performance** at 10–30x lower cost.

- **Berkeley's TinyAgent** project showed that models as small as 1B parameters can be trained to reliably call tools, going from **10% to 79% success** in just 15 minutes of fine-tuning on a MacBook.

- **MIT's collaborative approach** (Dec 2025) demonstrated that an LLM doing high-level planning with SLMs handling execution can approach the precision of top reasoning systems like o1, while being far more efficient.

### 2.2 Why SLMs Excel at Structured Tasks

SLMs are not "dumber LLMs" — they are **focused models** that trade breadth of knowledge for depth of skill in specific domains:

| Property | Why It Helps ORKY |
|---|---|
| **Deterministic structured output** | SLMs fine-tuned on JSON/function-calling schemas produce valid output far more reliably than general-purpose models. No more markdown-fence stripping. |
| **Lower latency** | A 7B model on a single GPU generates tokens 5–10x faster than a cloud API call to a 100B+ model. Critical for the agent executor's multi-round function calling loop. |
| **Schema adherence** | Small models with constrained decoding (grammar-based sampling) can be forced to produce valid JSON matching a specific schema — impossible with cloud API models. |
| **Cost at scale** | Self-hosted SLMs eliminate per-token API costs. At ORKY's volume, this matters for the function calling loop which makes 3–5 Gemini calls per agent step. |
| **Reproducibility** | Same model, same quantization, same temperature = same output. Cloud models can change behavior with silent updates. |

### 2.3 The "Right Tool for the Right Job" Principle

ORKY doesn't need a model that can write poetry to decide that a reimbursement workflow needs 4 agents in a specific order. It needs a model that can:

1. Parse a user intent against a catalog of available actions
2. Decompose the intent into ordered, dependency-aware steps
3. Select the correct action + parameters for each step
4. Produce valid JSON that matches the expected schema every time

These are **constrained reasoning tasks** — exactly what fine-tuned SLMs excel at.

---

## 3. Model Candidates & Benchmarks

### 3.1 Top Candidates for ORKY

Based on reasoning benchmarks, function calling ability, and deployment practicality, here are the strongest candidates:

| Model | Params | MATH-500 | MMLU | BFCL (Tool Use) | Context Window | License |
|---|---|---|---|---|---|---|
| **Qwen3-8B** | 8.2B | ~95+ | 85.0+ | Strong (native FC) | 128K | Apache 2.0 |
| **Qwen3-4B** | 4B | 97.0 | 83.7 | Good (via Qwen-Agent) | 128K | Apache 2.0 |
| **DeepSeek-R1-Distill-Qwen-7B** | 7B | 92.8 | ~75 | Needs fine-tuning | 128K | MIT |
| **Phi-4-mini** | 3.8B | ~85 | ~80 | Native FC support | 128K | MIT |
| **Qwen2.5-7B-Instruct** | 7B | ~85 | 74.2 | Native FC + JSON mode | 128K | Apache 2.0 |
| **Llama-3.2-8B-Instruct** | 8B | ~75 | ~73 | Basic FC support | 128K | Llama 3.2 |
| **DeepSeek-R1-Distill-Llama-8B** | 8B | ~88 | ~72 | Needs fine-tuning | 128K | MIT |

### 3.2 Detailed Analysis of Top 3

#### Qwen3-8B (Recommended for Reasoning + Planning)

**Strengths:**
- Outperforms Qwen2.5-14B on STEM and coding benchmarks despite being half the size
- Hybrid thinking mode: can toggle between step-by-step chain-of-thought and fast direct responses
- Native function calling with structured output support via Qwen-Agent
- 4-stage training pipeline including reasoning-based reinforcement learning
- 128K context window handles large action catalogs and multi-step variable contexts
- Apache 2.0 license — full commercial use

**Weaknesses:**
- At 8B parameters, needs ~6GB VRAM (Q4 quantized) or ~16GB (FP16)
- Newer model, less battle-tested in production than Qwen2.5

**Why for ORKY:** The hybrid thinking mode is ideal — use thinking mode for workflow generation (complex planning) and non-thinking mode for intent classification (fast routing). Native function calling means less custom prompt engineering for the agent executor.

#### DeepSeek-R1-Distill-Qwen-7B (Best Pure Reasoning)

**Strengths:**
- 92.8% on MATH-500 — exceptional mathematical/logical reasoning for a 7B model
- Distilled from DeepSeek-R1 (one of the best reasoning models ever created)
- Excels at chain-of-thought decomposition
- MIT license

**Weaknesses:**
- No native function calling — would need fine-tuning or a wrapper
- Verbose chain-of-thought output requires parsing
- Reasoning mode adds latency (thinks before answering)

**Why for ORKY:** If the goal is *planning quality above all else*, this model's reasoning is unmatched at this size. The lack of native FC is a solvable problem with fine-tuning or by using it only for the planning step (workflow generation) and a different model for execution.

#### Phi-4-mini (Best for Resource-Constrained Deployment)

**Strengths:**
- Only 3.8B parameters — runs on consumer hardware, even CPU
- Native function calling via `<|tool|>` tokens
- Strong multilingual and reasoning for its size
- MIT license

**Weaknesses:**
- Smaller capacity means less robust on complex multi-step plans
- 3.8B may struggle with large action catalogs (20+ tools)

**Why for ORKY:** If deployment cost and latency are top priorities, Phi-4-mini punches well above its weight. Best suited for intent classification and simple tool selection, less so for complex workflow generation.

### 3.3 Benchmark Context: What These Numbers Mean for ORKY

ORKY's reasoning tasks are *structured planning tasks*, not math problems. But math benchmarks are the best proxy we have for logical reasoning capability:

- **MATH-500 > 90%** → Model can handle multi-step logical decomposition. Critical for workflow generation.
- **MMLU > 80%** → Model has broad knowledge needed for intent classification and understanding enterprise domains.
- **BFCL (Berkeley Function Calling)** → Direct measure of tool-use ability. Models with native FC support score significantly higher.

---

## 4. Architecture Proposals: Hybrid SLM + LLM

### 4.1 Architecture A: "SLM Planner + LLM Executor" (Recommended)

```
User Message
    │
    ▼
┌─────────────────────────┐
│   SLM (Qwen3-8B)        │  ← Self-hosted, GPU
│   - Intent classification│
│   - Workflow generation  │
│   - Action selection     │
│   - Parameter extraction │
└──────────┬──────────────┘
           │ Structured JSON plan
           ▼
┌─────────────────────────┐
│   LLM (Gemini Flash)    │  ← Cloud API
│   - User-facing summaries│
│   - Email composition    │
│   - KB question answering│
│   - Conversational chat  │
└─────────────────────────┘
```

**How it maps to ORKY's current code:**

| Current Function | Current Model | Proposed Model | Why |
|---|---|---|---|
| `classify_intent()` | Gemini Flash | **SLM** | Deterministic classification — SLM with constrained decoding guarantees valid output |
| `generate_workflow_plan()` | Gemini Flash | **SLM** | Core planning task — SLM fine-tuned on ORKY's workflow schema |
| `execute_workflow_agent()` function calling loop | Gemini Flash | **SLM** | Tool selection + parameter extraction — SLM's strength |
| `match_workflow()` | Gemini Flash | **SLM** | Pattern matching against catalog — deterministic task |
| `generate_chat_response()` | Gemini Flash | **Gemini Flash** | Conversational fluency — Flash's strength |
| `_send_completion_email()` | Gemini Flash | **Gemini Flash** | Creative writing — Flash's strength |
| `generate_workflow_summary()` | Gemini Flash | **Gemini Flash** | User-facing prose — Flash's strength |
| RAG response generation | Gemini Flash | **Gemini Flash** | Knowledge synthesis — Flash's strength |

**Benefits:**
- Planning quality dramatically improves (fine-tuned for ORKY's exact schemas)
- Latency improves for the function calling loop (local inference vs API round-trips)
- Cloud API costs drop ~60% (most calls are planning/tool-selection)
- Gemini Flash is freed to do what it's good at (fluent text generation)

**Risks:**
- Operational complexity of running a GPU server
- Need to maintain the SLM (updates, fine-tuning pipeline)

### 4.2 Architecture B: "SLM Router + LLM Fallback"

```
User Message
    │
    ▼
┌─────────────────────────┐
│   SLM (Phi-4-mini)      │  ← Lightweight, even CPU
│   - Intent classification│
│   - Confidence scoring   │
└──────────┬──────────────┘
           │
     ┌─────┴─────┐
     │ Confident? │
     └─────┬─────┘
       Yes │       No
       ▼         ▼
┌──────────┐ ┌──────────────┐
│ SLM      │ │ Gemini Flash │
│ handles  │ │ handles      │
│ planning │ │ everything   │
└──────────┘ └──────────────┘
```

**Benefits:**
- Graceful degradation — if SLM is unsure, fall back to the current system
- Lower risk for initial deployment
- Can gradually increase SLM coverage as confidence grows

**Risks:**
- Confidence scoring adds complexity
- Two code paths to maintain

### 4.3 Architecture C: "AgentCollab" (Research-Backed)

Based on the **"Towards Efficient Agents: A Co-Design of Inference Architecture and System"** paper:

```
┌─────────────────────────────────────────┐
│           Agent Orchestrator             │
│                                          │
│  SLM handles:          LLM rescues:      │
│  - Routine tool calls  - Stalled plans   │
│  - Known patterns      - Novel requests  │
│  - Schema validation   - Complex chains  │
│                                          │
│  ┌──────────────────────────────────┐   │
│  │    Progress Check Signals         │   │
│  │    SLM self-evaluates after each  │   │
│  │    step — escalates to LLM if     │   │
│  │    stuck or uncertain              │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Benefits:**
- Self-healing: the system detects and recovers from SLM failures
- Research-validated approach (AgentCollab paper)
- Best of both worlds

**Risks:**
- Most complex to implement
- Self-evaluation adds latency

### 4.4 Recommendation

**Start with Architecture A** (SLM Planner + LLM Executor). It's the cleanest separation of concerns, maps directly to ORKY's existing code structure, and delivers the highest impact with the least complexity. Architecture B's fallback mechanism can be layered on later.

---

## 5. Deployment Options for FastAPI Integration

### 5.1 Inference Engines Comparison

| Engine | Best For | GPU Required | Throughput | Latency (P50) | Production Ready |
|---|---|---|---|---|---|
| **vLLM** | High-concurrency production | Yes (CUDA) | ~793 TPS (A100) | ~80ms | Yes |
| **Ollama** | Development & prototyping | Optional | ~41 TPS | ~200ms | Limited |
| **llama.cpp** | CPU/edge deployment | No | ~20 TPS (CPU) | ~150ms | Yes |
| **TensorRT-LLM** | Max performance (NVIDIA) | Yes (CUDA) | ~1000+ TPS | ~50ms | Yes (complex setup) |
| **MLX** | Apple Silicon (M1/M2/M3) | No (Metal) | ~60 TPS | ~100ms | Dev only |

### 5.2 Recommended Stack: vLLM + OpenAI-Compatible API

vLLM is the strongest choice for ORKY's FastAPI backend because:

1. **OpenAI-compatible API** — Drop-in replacement. ORKY's backend can call the SLM with the same HTTP interface it would use for any cloud API.
2. **Continuous batching** — Handles concurrent requests from multiple workflow executions efficiently.
3. **Structured output** — Supports guided decoding with JSON schemas, ensuring valid output.
4. **Quantization support** — AWQ/GPTQ quantized models run on smaller GPUs.

**Integration pattern:**

```python
# backend/services/slm.py — New service alongside gemini.py

from openai import AsyncOpenAI

slm_client = AsyncOpenAI(
    base_url="http://localhost:8080/v1",  # vLLM server
    api_key="not-needed",                 # Local server
)

async def slm_generate(
    system_prompt: str,
    user_prompt: str,
    response_format: dict | None = None,  # JSON schema for structured output
    tools: list | None = None,            # Function declarations
) -> str:
    response = await slm_client.chat.completions.create(
        model="Qwen/Qwen3-8B",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        response_format=response_format,
        tools=tools,
        temperature=0.1,  # Low temp for deterministic planning
    )
    return response.choices[0].message
```

### 5.3 GPU Requirements

| Model | Quantization | VRAM Required | Recommended GPU | Monthly Cloud Cost |
|---|---|---|---|---|
| Qwen3-8B | FP16 | ~16 GB | A10G (24GB) | ~$400/mo |
| Qwen3-8B | Q4_K_M (GGUF) | ~6 GB | T4 (16GB) | ~$150/mo |
| Qwen3-4B | FP16 | ~8 GB | T4 (16GB) | ~$150/mo |
| Qwen3-4B | Q4_K_M (GGUF) | ~3 GB | T4 (16GB) | ~$150/mo |
| Phi-4-mini | FP16 | ~8 GB | T4 (16GB) | ~$150/mo |
| Phi-4-mini | Q4_K_M (GGUF) | ~3 GB | L4 (24GB) | ~$200/mo |

**Note on quantization:** For reasoning tasks, **Q4_K_M or Q5_K_M quantization** retains 95%+ of reasoning quality while halving VRAM requirements. Research from Red Hat (2025) showed that quantized DeepSeek-R1 distilled models maintain their reasoning capabilities even at 4-bit quantization.

### 5.4 Deployment Architecture

```
┌─────────────────────────────────────────────┐
│              AWS / Cloud Provider             │
│                                               │
│  ┌─────────────┐      ┌──────────────────┐  │
│  │ FastAPI App  │─────▶│ vLLM Server      │  │
│  │ (CPU/small)  │ HTTP │ Qwen3-8B (Q4)   │  │
│  │ port 8000    │      │ port 8080        │  │
│  │              │      │ GPU: T4/A10G     │  │
│  └──────┬───────┘      └──────────────────┘  │
│         │                                     │
│         │ HTTPS (for generation tasks only)   │
│         ▼                                     │
│  ┌──────────────┐                            │
│  │ Gemini Flash │                            │
│  │ (Cloud API)  │                            │
│  └──────────────┘                            │
└───────────────────────────────────────────────┘
```

### 5.5 TOON Format for Token-Efficient Data Serialization

When running an SLM with a tighter context window, every token matters. **TOON (Token-Oriented Object Notation)** is a serialization format designed specifically for LLM workloads. It combines YAML-like indentation for objects with CSV-style tabular syntax for arrays of objects — the exact data shape that dominates ORKY's prompts.

#### What TOON Is

TOON replaces JSON's verbose bracket-and-quote syntax with a compact, whitespace-structured format. Simple objects use indentation (no braces or quotes on keys), and uniform arrays of objects collapse into a **tabular** form with a header row and pipe-delimited values.

**JSON (87 tokens):**
```json
[
  {
    "name": "create_incident",
    "description": "Create a new ServiceNow incident",
    "parameters": "short_description (string), urgency (string)"
  },
  {
    "name": "get_issue",
    "description": "Retrieve a Jira issue by key",
    "parameters": "issue_key (string)"
  }
]
```

**TOON equivalent (~50 tokens):**
```
@@name|description|parameters
create_incident|Create a new ServiceNow incident|short_description (string), urgency (string)
get_issue|Retrieve a Jira issue by key|issue_key (string)
```

The `@@` prefix declares a tabular array with named columns; each subsequent line is a row. No quotes, no braces, no repeated key names.

#### Benchmark Data

Published benchmarks across four LLMs show consistent gains:

| Metric | JSON Baseline | TOON | Delta |
|---|---|---|---|
| Token count (avg across payloads) | 100% | **~60%** | **-40%** |
| Task accuracy (Claude Haiku) | 78.2% | 82.1% | +3.9% |
| Task accuracy (Gemini 2.5 Flash) | 80.5% | 84.0% | +3.5% |
| Task accuracy (GPT-5 Nano) | 76.9% | 81.3% | +4.4% |
| Task accuracy (Grok-4) | 79.1% | 82.8% | +3.7% |

The accuracy improvement likely comes from reduced noise — models spend fewer tokens parsing syntax and more on reasoning about content.

#### Where TOON Applies in ORKY's Pipeline

ORKY injects structured data into LLM prompts in several places. The ones with the highest token savings potential are **uniform arrays of objects** — exactly TOON's tabular sweet spot:

| Injection Point | Code Location | Data Shape | Est. Token Savings |
|---|---|---|---|
| **Action catalog** | `workflow_generator.py:16-27` | Array of apps, each with array of actions + parameters | 40–60% |
| **Variable context** | `agent_executor.py:48` | `json.dumps(variables, indent=2)` — nested key-value pairs from prior steps | 20–30% |
| **Workflow plan output** | `workflow_generator.py:32-46` | Structured JSON with agents array | 30–40% |
| **Function declarations** | `agent_executor.py:59-67` | Array of tool schemas passed to the model | 30–40% |

The action catalog is the biggest win. In a typical ORKY deployment with 6 apps and 20+ actions, the catalog alone can consume 1,500–2,000 JSON tokens. TOON's tabular format would reduce this to ~900–1,200 tokens — freeing context window budget for the SLM's reasoning.

#### Concrete Before/After: ORKY Action Catalog

**Current format** (built in `workflow_generator.py:16-27`, injected as text):
```
## App: servicenow (slug: servicenow)
Description: ServiceNow IT Service Management
Available Actions:
  - create_incident: Create a new ServiceNow incident
    Parameters: short_description (string), urgency (string), assignment_group (string)
  - create_ritm: Create a catalog request item
    Parameters: short_description (string), catalog_item_id (string)
  - close_incident: Close an existing incident
    Parameters: incident_number (string), close_notes (string)

## App: jira (slug: jira)
Description: Jira Project Management
Available Actions:
  - create_issue: Create a new Jira issue
    Parameters: project_key (string), summary (string), issue_type (string)
  - get_issue: Retrieve an existing Jira issue
    Parameters: issue_key (string)
```

**TOON tabular format:**
```
@@app_slug|action_name|description|parameters
servicenow|create_incident|Create a new ServiceNow incident|short_description (string), urgency (string), assignment_group (string)
servicenow|create_ritm|Create a catalog request item|short_description (string), catalog_item_id (string)
servicenow|close_incident|Close an existing incident|incident_number (string), close_notes (string)
jira|create_issue|Create a new Jira issue|project_key (string), summary (string), issue_type (string)
jira|get_issue|Retrieve an existing Jira issue|issue_key (string)
```

The TOON version is denser, eliminates repeated structural markers, and keeps all action metadata scannable in a single flat table. For an SLM with a 32K effective context window, this compression directly translates to fitting more actions or more reasoning steps.

#### Python Integration

TOON has a stable Python SDK:

```bash
pip install toon-python
```

```python
# backend/services/toon_utils.py
import toon

def actions_to_toon(apps_with_actions: list[dict]) -> str:
    """Convert ORKY's action catalog to TOON tabular format."""
    rows = []
    for app in apps_with_actions:
        for action in app.get("actions", []):
            params = ""
            if action.get("input_schema"):
                props = action["input_schema"].get("properties", {})
                params = ", ".join(
                    f"{k} ({v.get('type', 'string')})" for k, v in props.items()
                )
            rows.append({
                "app_slug": app["slug"],
                "action_name": action["name"],
                "description": action.get("description", ""),
                "parameters": params,
            })
    return toon.dumps(rows)

def variables_to_toon(variables: dict) -> str:
    """Convert step variables to TOON for injection into agent prompts."""
    return toon.dumps(variables)
```

This integrates into the existing pipeline with minimal changes — swap `json.dumps()` calls in `workflow_generator.py` and `agent_executor.py` with the TOON equivalents when routing to the SLM. The Gemini Flash path can continue using JSON since it has ample context window.

#### Caveats

| Caveat | Detail |
|---|---|
| **Deeply nested structures** | TOON's tabular syntax works best for flat or one-level-deep arrays of objects. Deeply nested JSON (e.g., recursive schemas) doesn't benefit and may be harder to read in TOON. |
| **Model familiarity** | LLMs are trained overwhelmingly on JSON. A less-common format may cause parsing confusion in some models. Benchmarks suggest this is offset by the reduced noise, but it should be validated per-model. |
| **Output parsing** | If the SLM outputs TOON-formatted responses, the backend needs `toon.loads()` to deserialize. For structured output tasks (workflow plans), JSON with constrained decoding may still be preferable for the *output* side. |
| **Ecosystem maturity** | TOON is newer than JSON/YAML. The Python SDK is stable, but tooling (schema validation, IDE support) is less developed. |

**Recommended approach:** Use TOON for **input** serialization (injecting data into prompts) where token savings are highest, and keep JSON for **output** schemas where constrained decoding and validation tooling are more mature.

### 5.6 Akash Network Deployment

ORKY's SLM inference runs on **Akash Network** — a decentralized GPU marketplace where providers compete on price, delivering **50–85% cost savings** compared to hyperscaler equivalents.

#### Why Akash for ORKY

| Factor | AWS/GCP | Akash Network |
|---|---|---|
| A100 80GB (hourly) | $3.50–$4.00/hr | $0.50–$1.50/hr |
| A10 24GB (hourly) | $1.00–$1.50/hr | $0.20–$0.50/hr |
| RTX 4090 24GB (hourly) | N/A (not offered) | $0.30–$0.60/hr |
| Monthly cost (Qwen3-8B AWQ, 24/7) | ~$750–$1,100/mo | ~$150–$400/mo |
| Commitment | Reserved instances or on-demand | Lease-based, cancel anytime |
| Setup complexity | Moderate (EC2/GKE + Docker) | SDL file → deploy via Akash CLI |

Akash uses a **reverse-auction model**: you specify your resource requirements and budget in an SDL (Stack Definition Language) file, and providers bid to host your workload. The cheapest qualifying provider wins.

#### SDL Configuration

ORKY ships two Akash SDL deployment files in `deploy/`:

| File | Model | VRAM | Use Case |
|---|---|---|---|
| `akash-vllm-qwen3-8b.yaml` | `Qwen/Qwen3-8B-AWQ` (4-bit) | ~6 GB | **Primary** — runs on any 24GB+ GPU |
| `akash-vllm-qwen3-8b-fp16.yaml` | `Qwen/Qwen3-8B` (FP16) | ~16 GB | Full precision — A100/H100 only |

Both use the official `vllm/vllm-openai:v0.16.0` image with:
- Pre-download step (`huggingface-cli download`) to avoid timeout during model pull
- `--max-model-len 32768` for ORKY's planning context
- `--enable-auto-tool-choice --tool-call-parser hermes --reasoning-parser qwen3` for native function calling
- API key authentication via `VLLM_API_KEY` env var

#### Deploying to Akash

```bash
# 1. Install Akash CLI
curl -sSfL https://raw.githubusercontent.com/akash-network/provider/main/install.sh | sh

# 2. Fund your Akash wallet with AKT tokens

# 3. Deploy the AWQ variant
akash tx deployment create deploy/akash-vllm-qwen3-8b.yaml --from wallet --chain-id akashnet-2

# 4. Accept a provider bid
akash tx market lease create --from wallet --dseq <deployment-seq> --provider <provider-addr>

# 5. Get the provider URI (this becomes SLM_BASE_URL)
akash provider lease-status --from wallet --dseq <deployment-seq> --provider <provider-addr>
```

The provider URI + `/v1` becomes the `SLM_BASE_URL` in ORKY's backend `.env`.

#### Connecting ORKY Backend to Akash

Once deployed, the vLLM server exposes an OpenAI-compatible API. ORKY's backend connects via three environment variables:

```env
SLM_BASE_URL=https://<akash-provider-uri>/v1
SLM_API_KEY=<your-vllm-api-key>
SLM_MODEL_NAME=Qwen/Qwen3-8B-AWQ
```

The `backend/services/slm.py` service uses `openai.AsyncOpenAI` to call the endpoint, providing `slm_generate()` for single-shot planning, `slm_chat()` for multi-turn function calling, and `slm_health_check()` for monitoring.

#### Updated Architecture with Akash

```
┌─────────────────────────────────────────────────────────┐
│              ORKY Backend (FastAPI)                       │
│                                                           │
│  ┌──────────────────┐      ┌────────────────────────┐   │
│  │ gemini.py         │      │ slm.py                  │   │
│  │ (Cloud API)       │      │ (OpenAI-compat client)  │   │
│  └────────┬─────────┘      └──────────┬─────────────┘   │
└───────────┼────────────────────────────┼─────────────────┘
            │                            │
            ▼                            ▼
┌───────────────────┐      ┌──────────────────────────────┐
│   Google Gemini    │      │   Akash Network               │
│   2.0 Flash        │      │   ┌────────────────────────┐ │
│   (Summaries,      │      │   │ vLLM + Qwen3-8B-AWQ    │ │
│    Chat, KB Q&A)   │      │   │ GPU: A100/A10/RTX4090  │ │
│                    │      │   │ OpenAI-compat API       │ │
└───────────────────┘      │   └────────────────────────┘ │
                            │   50–85% cheaper than AWS    │
                            └──────────────────────────────┘
```

---

## 6. Fine-Tuning Strategy

### 6.1 Why Fine-Tuning Matters

Off-the-shelf SLMs are good at general reasoning, but fine-tuning on ORKY-specific data transforms them from "good" to "production-ready":

- Learn ORKY's exact workflow JSON schema
- Learn the action catalog (ServiceNow, Jira, Slack, AWS, SharePoint, Snowflake)
- Learn the variable passing conventions (`_triggerInput`, `step_{order}`, `_file_attachment`)
- Learn to decompose enterprise requests into the right number of agents

### 6.2 Training Data Sources

| Source | What It Provides | How to Collect |
|---|---|---|
| **ORKY's existing workflow database** | Real workflow plans that worked | Export from `workflows` + `workflow_agents` tables |
| **Execution logs** | Successful function calling sequences | Export from `step_executions` + `agent_logs` |
| **Synthetic generation** | Scale up training data | Use Gemini Pro/Ultra to generate workflow plans, human-verify |
| **ToolBench / Glaive datasets** | General function calling patterns | Public datasets, filter for relevant patterns |
| **Failure cases** | What NOT to do | Export failed executions, label the errors |

### 6.3 Fine-Tuning Approach: QLoRA

**QLoRA** (Quantized Low-Rank Adaptation) is the recommended approach:

- Fine-tunes only ~1–2% of model parameters via low-rank adapter matrices
- Base model stays quantized (4-bit) during training — fits on a single consumer GPU
- Training time: ~2–4 hours on a single A10G for a 7B model with 10K examples
- No catastrophic forgetting of base capabilities

**Recommended tools:**
- **Unsloth** — 2x faster QLoRA training, memory efficient
- **Axolotl** — YAML-based training config, supports many model architectures
- **Hugging Face TRL** — Reinforcement learning from human feedback (RLHF) support

**Training recipe:**

```yaml
# axolotl config example
base_model: Qwen/Qwen3-8B
adapter: qlora
lora_r: 16
lora_alpha: 32
dataset:
  - path: ./data/orky_workflows.jsonl
    type: sharegpt  # conversation format
  - path: ./data/orky_function_calls.jsonl
    type: sharegpt
num_epochs: 3
learning_rate: 2e-4
bf16: true
gradient_accumulation_steps: 4
```

### 6.4 Evaluation Pipeline

Before deploying a fine-tuned model, evaluate on:

1. **Schema compliance rate** — % of outputs that parse as valid JSON matching ORKY's schemas
2. **Action selection accuracy** — Does it pick the right actions from the catalog?
3. **Plan completeness** — Does the workflow plan cover all necessary steps?
4. **Parameter correctness** — Are function call parameters valid and complete?
5. **Regression testing** — Run against the last 100 real workflow executions

---

## 7. Challenges & Pitfalls

### 7.1 Technical Challenges

| Challenge | Severity | Mitigation |
|---|---|---|
| **Hallucinated tool names** | High | Constrained decoding — force output to match valid action names from catalog |
| **Context window limits** | Medium | Qwen3-8B supports 128K tokens, but quality degrades after ~32K. Keep action catalogs pruned per-request. |
| **Quantization quality loss** | Low | Use Q5_K_M or higher for reasoning tasks. Benchmark before deploying. |
| **Cold start latency** | Medium | vLLM keeps model loaded in GPU memory. First request after deploy may be slow (~5s). |
| **Catastrophic forgetting** | Medium | Use QLoRA (not full fine-tune) to preserve base capabilities. Evaluate on general benchmarks after training. |
| **Training data quality** | High | Garbage in, garbage out. Human-review training examples. Use synthetic data sparingly. |

### 7.2 Operational Challenges

| Challenge | Severity | Mitigation |
|---|---|---|
| **GPU cost** | Medium | Start with a T4 ($150/mo). A quantized 8B model fits easily. Scale to A10G only if needed. |
| **Model updates** | Medium | Pin to specific model versions. Test new versions in staging before promoting. |
| **Monitoring** | High | Log every SLM call with input/output. Track schema compliance rate, latency P50/P99, and fallback rate. |
| **Fallback strategy** | High | If SLM fails (invalid output, timeout), fall back to Gemini Flash. Never let the SLM be a single point of failure. |

### 7.3 What Could Go Wrong

1. **Over-optimization on training data** — The SLM becomes great at known workflow patterns but fails on novel requests. Mitigation: Keep 20% of training data as hold-out, test on unseen workflow types.

2. **Latency regression** — If the SLM's chain-of-thought is verbose, parsing and generation could actually be slower than a Gemini API call. Mitigation: Use non-thinking mode for simple tasks, benchmark end-to-end latency.

3. **Maintenance burden** — A self-hosted model requires ops work (GPU monitoring, model reloading, version management). Mitigation: Use managed ML platforms (AWS SageMaker, RunPod, Modal) to reduce ops burden.

4. **Diminishing returns** — If the real problem is prompt quality rather than model capability, switching models won't help. Mitigation: First try improving prompts with the current model before committing to SLM integration.

---

## 8. Recommendation & Next Steps

### 8.1 Recommended Path

| Phase | Timeline | Action |
|---|---|---|
| **Phase 0: Baseline** | Week 1 | Instrument current Gemini calls with logging. Measure schema compliance rate, planning accuracy, and latency for each function. Establish quantitative baselines. |
| **Phase 1: Prototype** | Week 2–3 | Deploy **Qwen3-8B** (Q4 quantized) via vLLM on a T4 instance. Replace `classify_intent()` and `generate_workflow_plan()` with SLM calls. Compare quality against baselines. |
| **Phase 2: Fine-Tune** | Week 3–4 | Collect training data from ORKY's workflow database. QLoRA fine-tune Qwen3-8B on ORKY-specific schemas and action catalogs. Evaluate on hold-out set. |
| **Phase 3: Expand** | Week 5–6 | Replace the agent executor's function calling loop with the fine-tuned SLM. Add fallback to Gemini Flash for failures. Monitor in production. |
| **Phase 4: Optimize** | Ongoing | Continuous fine-tuning with new workflow data. Experiment with Qwen3-4B if 8B is overkill. Add Architecture C (self-evaluation) for robustness. |

### 8.2 Success Metrics

| Metric | Current (Estimated) | Target |
|---|---|---|
| Schema compliance (valid JSON output) | ~85% | >99% |
| Workflow plan accuracy (correct steps + order) | ~70% | >90% |
| Intent classification accuracy | ~90% | >98% |
| Function calling loop — avg rounds to completion | ~3.5 | <2.5 |
| Planning latency (workflow generation) | ~2s (API) | <500ms (local) |
| Monthly LLM API cost | Baseline | -50% or more |

### 8.3 Model Recommendation Summary

**Primary: Qwen3-8B** — Best balance of reasoning quality, function calling support, and deployment practicality. Apache 2.0 license. Hybrid thinking mode is uniquely suited to ORKY's mixed workload.

**Fallback/Alternative: DeepSeek-R1-Distill-Qwen-7B** — If pure reasoning quality is paramount and you're willing to invest in function-calling fine-tuning.

**Lightweight Option: Phi-4-mini (3.8B)** — If GPU budget is very constrained. Good enough for intent classification and simple tool routing, but may struggle with complex multi-agent workflow generation.

---

## 9. Sources & References

### Research Papers & Technical Reports

- [Small Language Models for Efficient Agentic Tool Calling: Outperforming Large Models with Targeted Fine-tuning](https://arxiv.org/abs/2512.15943) — Dec 2025. Fine-tuned SLMs achieve 77.55% on ToolBench, outperforming ChatGPT-CoT.
- [Small Language Models for Agentic Systems: A Survey](https://arxiv.org/pdf/2510.03847) — Survey of SLM capabilities in agentic settings.
- [Small Language Models are the Future of Agentic AI](https://arxiv.org/pdf/2506.02153) — Belcak & Heinrich, Jun 2025. 80–90% of agentic tasks suited for SLMs.
- [TinyAgent: Function Calling at the Edge](https://arxiv.org/html/2409.00608v1) — Berkeley. 1B model fine-tuned for tool calling in 15 minutes.
- [Towards Efficient Agents: A Co-Design of Inference Architecture and System](https://arxiv.org/html/2512.18337) — AgentCollab dual-model mechanism.
- [DeepSeek-R1: Incentivizing Reasoning Capability in LLMs via Reinforcement Learning](https://arxiv.org/html/2501.12948v1) — Distillation methodology for R1-Distill models.
- [Qwen3 Technical Report](https://arxiv.org/html/2505.09388v1) — Benchmark data for Qwen3 model family.
- [Enabling Small Language Models to Solve Complex Reasoning Tasks](https://news.mit.edu/2025/enabling-small-language-models-solve-complex-reasoning-tasks-1212) — MIT, Dec 2025.
- [Berkeley Function Calling Leaderboard (BFCL)](https://gorilla.cs.berkeley.edu/leaderboard.html) — Standard benchmark for function calling evaluation.

### Deployment & Infrastructure

- [vLLM vs Ollama vs llama.cpp vs TGI vs TensorRT-LLM: 2025 Guide](https://itecsonline.com/post/vllm-vs-ollama-vs-llama.cpp-vs-tgi-vs-tensort)
- [Ollama vs. vLLM: A Deep Dive into Performance Benchmarking](https://developers.redhat.com/articles/2025/08/08/ollama-vs-vllm-deep-dive-performance-benchmarking) — Red Hat, Aug 2025.
- [vLLM or llama.cpp: Choosing the Right Inference Engine](https://developers.redhat.com/articles/2025/09/30/vllm-or-llamacpp-choosing-right-llm-inference-engine-your-use-case) — Red Hat, Sep 2025.
- [Deployment-Ready Reasoning with Quantized DeepSeek-R1 Models](https://developers.redhat.com/articles/2025/03/03/deployment-ready-reasoning-quantized-deepseek-r1-models) — Red Hat, Mar 2025.

### Model Cards & Documentation

- [Qwen/Qwen3-8B on Hugging Face](https://huggingface.co/Qwen/Qwen3-8B)
- [Qwen Function Calling Documentation](https://qwen.readthedocs.io/en/latest/framework/function_call.html)
- [microsoft/Phi-4-mini-instruct on Hugging Face](https://huggingface.co/microsoft/Phi-4-mini-instruct)
- [deepseek-ai/DeepSeek-R1-Distill-Qwen-7B on Hugging Face](https://huggingface.co/deepseek-ai/DeepSeek-R1-Distill-Qwen-7B)
- [Qwen2.5-7B-Instruct on Hugging Face](https://huggingface.co/Qwen/Qwen2.5-7B-Instruct)

### Fine-Tuning Resources

- [Fine-Tuning Small Language Models for Function Calling: A Comprehensive Guide](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/fine-tuning-small-language-models-for-function-calling-a-comprehensive-guide/4362539) — Microsoft, 2025.
- [Fine Tuning SLMs on Agentic Tool Calling: An Experiment](https://medium.com/@dataenthusiast.io/fine-tuning-slms-on-agentic-tool-calling-an-experiment-ccbef62ac5c7)
- [ToolBench: Open Platform for Training and Evaluating LLMs for Tool Learning](https://github.com/OpenBMB/ToolBench) — ICLR 2024 Spotlight.

### Data Serialization for LLM Workloads

- [TOON Format Specification & Python SDK](https://github.com/toon-format/toon-python) — GitHub repository for the `toon-python` package.
- [TOON Format Overview](https://toonformat.dev) — Official specification and interactive examples.
- [TOON Benchmark: Token Reduction and Accuracy Across LLMs](https://toonformat.dev/benchmarks) — Benchmark data showing ~40% token reduction and +4% accuracy across Claude Haiku, Gemini 2.5 Flash, GPT-5 Nano, and Grok-4.

### Decentralized GPU Infrastructure

- [Akash Network Documentation](https://akash.network/docs/) — Official docs for SDL specification, deployment, and provider management.
- [Akash GPU Marketplace](https://akash.network/gpu/) — Live GPU availability and pricing on Akash Network.
- [Deploying AI Models on Akash: A Practical Guide](https://akash.network/blog/deploying-ai-models-on-akash/) — Step-by-step deployment walkthrough.
- [Akash Network vs AWS/GCP for AI Inference](https://akash.network/blog/akash-vs-cloud/) — Cost comparison for GPU workloads.

### Industry Analysis

- [SLM Agents: Why Small Language Models are the Future of AI](https://aisera.com/blog/small-language-model-agents/) — Aisera, 2025.
- [Why Small Language Models Are Revolutionising Agentic Workflows](https://cobusgreyling.medium.com/why-small-language-models-slms-are-revolutionising-agentic-workflows-209e265d5a12) — Cobus Greyling, 2025.
- [Top 15 Small Language Models for 2026](https://www.datacamp.com/blog/top-small-language-models) — DataCamp.
- [Best Open Source LLMs in 2025](https://www.koyeb.com/blog/best-open-source-llms-in-2025) — Koyeb.
