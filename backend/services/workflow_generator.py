import json
import logging
from services.gemini import generate_chat_response
from services.slm import slm_generate, strip_thinking
from schemas.workflow import GeneratedWorkflowPlan, GeneratedAgentPlan

logger = logging.getLogger(__name__)


def _build_toon_catalog(apps_with_actions: list[dict]) -> str:
    """Build a TOON tabular catalog of apps and actions for token-efficient SLM prompts."""
    lines = ["@@app_slug|action_name|description|parameters"]
    for app in apps_with_actions:
        for action in app.get("actions", []):
            params = ""
            if action.get("input_schema"):
                props = action["input_schema"].get("properties", {})
                if props:
                    params = ", ".join(f"{k} ({v.get('type', 'string')})" for k, v in props.items())
            desc = action.get("description", action.get("display_name", ""))
            lines.append(f"{app['slug']}|{action['name']}|{desc}|{params}")
    return "\n".join(lines)


def _build_text_catalog(apps_with_actions: list[dict]) -> str:
    """Build verbose text catalog for Gemini prompts."""
    catalog = ""
    for app in apps_with_actions:
        catalog += f"\n## App: {app['name']} (slug: {app['slug']})\n"
        catalog += f"Description: {app.get('description', 'N/A')}\n"
        catalog += "Available Actions:\n"
        for action in app.get("actions", []):
            catalog += f"  - {action['name']}: {action.get('description', action.get('display_name', ''))}\n"
            if action.get("input_schema"):
                schema = action["input_schema"]
                props = schema.get("properties", {})
                if props:
                    param_strs = [f"{k} ({v.get('type', 'string')})" for k, v in props.items()]
                    catalog += f"    Parameters: {', '.join(param_strs)}\n"
    return catalog


async def generate_workflow_plan(
    description: str,
    apps_with_actions: list[dict],
) -> GeneratedWorkflowPlan:
    """
    Takes a workflow description + available apps catalog.
    Calls SLM (with TOON catalog) to generate a structured plan with steps + agent suggestions.
    Falls back to Gemini if SLM fails.
    """
    system_prompt = """You are an AI workflow architect. Given a natural language description of a workflow, you design a structured automation plan.

You must output valid JSON matching this exact schema:
{
  "name": "Short workflow name",
  "description": "One-line description of the workflow",
  "steps": "Step-by-step text description of the workflow",
  "agents": [
    {
      "name": "Agent Name",
      "description": "What this agent does",
      "role": "Detailed system prompt role for the agent",
      "steps": "Step-by-step instructions for the agent",
      "actions": ["action_name_1", "action_name_2"],
      "taskPrompt": "Specific task instruction for this agent in the workflow"
    }
  ]
}

Rules:
1. Each agent should have a focused, single responsibility
2. Agents execute SEQUENTIALLY — each agent can use context from previous agents
3. Only use actions from the available apps catalog provided
4. The "actions" list for each agent should contain action names that exist in the catalog
5. Write clear, specific taskPrompts that tell each agent exactly what to do
6. The "role" field should define the agent's persona and capabilities
7. The "steps" field for each agent should list concrete steps (e.g., "1. Create incident with severity P1\n2. Set assignment group to...")
8. Create the minimum number of agents needed — don't over-split simple workflows
9. If the workflow mentions a service not available in the catalog, still create the agent but note the limitation

File upload awareness:
- These workflows are triggered from a chat interface where users can attach files (images, PDFs).
- When a user attaches a file, it is uploaded to S3 and the S3 path (s3_bucket, s3_key) is included in the trigger input context.
- Some actions require files from S3 — look at their input parameters. Any action that takes "s3_bucket" and "s3_key" parameters is a file-dependent action (e.g., extract_invoice, detect_document_text).
- When a workflow uses file-dependent actions, the agent's taskPrompt MUST instruct it to read the s3_bucket and s3_key from the trigger input context (available in the _triggerInput variable).
- Example taskPrompt for a file-dependent agent: "Extract invoice data from the uploaded file. Use the s3_bucket and s3_key provided in the trigger input context to call extract_invoice."

Respond with ONLY the JSON object. No markdown fences, no explanations."""

    # Try SLM first with TOON catalog (token-efficient)
    try:
        toon_catalog = _build_toon_catalog(apps_with_actions)
        slm_user_prompt = f"""Design a workflow for the following description:

"{description}"

Available Apps & Actions (TOON format — @@header row, then pipe-delimited data rows):
{toon_catalog}

Generate the workflow plan as JSON."""

        response = await slm_generate(system_prompt, slm_user_prompt, response_format={"type": "json_object"}, temperature=0.1, max_tokens=4096)
        response = strip_thinking(response)
    except Exception as e:
        logger.warning("SLM generate_workflow_plan failed, falling back to Gemini: %s", e)
        text_catalog = _build_text_catalog(apps_with_actions)
        gemini_user_prompt = f"""Design a workflow for the following description:

"{description}"

Available Apps & Actions:
{text_catalog}

Generate the workflow plan as JSON."""
        response = await generate_chat_response(system_prompt, gemini_user_prompt)

    # Parse the JSON response
    # Strip markdown fences if present
    text = response.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1] if "\n" in text else text[3:]
    if text.startswith("json"):
        text = text[4:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()

    plan_data = json.loads(text)

    # Validate and convert to schema
    agents = []
    for agent_data in plan_data.get("agents", []):
        # SLM may return steps as a list; coerce to string
        agent_steps = agent_data.get("steps", "")
        if isinstance(agent_steps, list):
            agent_steps = "\n".join(agent_steps)
        agents.append(GeneratedAgentPlan(
            name=agent_data["name"],
            description=agent_data.get("description", ""),
            role=agent_data.get("role", ""),
            steps=agent_steps,
            actions=agent_data.get("actions", []),
            taskPrompt=agent_data.get("taskPrompt", ""),
        ))

    # Top-level steps may also be a list
    plan_steps = plan_data.get("steps", "")
    if isinstance(plan_steps, list):
        plan_steps = "\n".join(plan_steps)

    return GeneratedWorkflowPlan(
        name=plan_data.get("name", "Generated Workflow"),
        description=plan_data.get("description", description),
        steps=plan_steps,
        agents=agents,
    )
