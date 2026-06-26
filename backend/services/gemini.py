import asyncio
import json
import logging
from google import genai
from google.genai import types
from config import get_settings
from services.slm import slm_generate, strip_thinking

logger = logging.getLogger(__name__)

settings = get_settings()
client = genai.Client(api_key=settings.google_api_key)

EMBEDDING_MODEL = "gemini-embedding-001"
# gemini-2.5-flash-lite has a higher free-tier daily quota than gemini-2.5-flash,
# which makes the multi-call agentic workflows usable without a paid key.
CHAT_MODEL = "gemini-2.5-flash-lite"


async def with_retry(fn, max_retries: int = 3):
    """Retry wrapper for Gemini 429 rate limits."""
    for attempt in range(max_retries):
        try:
            return await fn()
        except Exception as e:
            status = getattr(e, "status", None) or getattr(e, "code", None)
            if status == 429 and attempt < max_retries - 1:
                delay = (attempt + 1) * 5
                await asyncio.sleep(delay)
                continue
            raise
    raise Exception("Max retries exceeded")


async def generate_embedding(
    text: str,
    task_type: str = "RETRIEVAL_DOCUMENT",
) -> list[float]:
    """Generate a 3072-dim embedding for text."""
    async def _call():
        result = await asyncio.to_thread(
            client.models.embed_content,
            model=EMBEDDING_MODEL,
            contents=text,
            config=types.EmbedContentConfig(task_type=task_type),
        )
        return result.embeddings[0].values

    return await with_retry(_call)


async def generate_chat_response(
    system_prompt: str,
    user_message: str,
    conversation_history: list[dict] | None = None,
) -> str:
    """Generate a chat response with optional conversation history."""
    async def _call():
        contents = []
        if conversation_history:
            for msg in conversation_history:
                role = "user" if msg["role"] == "user" else "model"
                contents.append(types.Content(role=role, parts=[types.Part(text=msg["content"])]))
        contents.append(types.Content(role="user", parts=[types.Part(text=user_message)]))

        response = await asyncio.to_thread(
            client.models.generate_content,
            model=CHAT_MODEL,
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
            ),
        )
        return response.text

    return await with_retry(_call)


async def generate_with_tools(
    system_prompt: str,
    user_message: str,
    tools: list[types.Tool],
    model_name: str = CHAT_MODEL,
) -> types.GenerateContentResponse:
    """Generate content with function calling tools."""
    async def _call():
        return await asyncio.to_thread(
            client.models.generate_content,
            model=model_name,
            contents=user_message,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=tools,
            ),
        )

    return await with_retry(_call)


async def generate_with_tools_chat(
    system_prompt: str,
    messages: list[types.Content],
    tools: list[types.Tool],
    model_name: str = CHAT_MODEL,
) -> types.GenerateContentResponse:
    """Generate content with tools using chat history."""
    async def _call():
        return await asyncio.to_thread(
            client.models.generate_content,
            model=model_name,
            contents=messages,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                tools=tools,
            ),
        )

    return await with_retry(_call)


async def classify_intent(user_message: str) -> str:
    """Classify user intent: kb_query, conversational, or workflow."""
    prompt = f"""You are an intent classifier for an enterprise AI assistant. Classify the following user message into exactly one category:

1. "kb_query" - The user is asking a question that can be answered from a knowledge base (policies, procedures, FAQs, how-to guides, holiday calendars, leave policies, hardware procurement, performance reviews, company info, etc.)
2. "conversational" - The user is making small talk, greetings, thank you, or asking something generic that doesn't require knowledge base lookup or any action
3. "workflow" - The user wants to perform an action or trigger a workflow. Examples:
   - Create/update/close a ServiceNow incident or ticket
   - Create/update a Jira issue or ticket
   - Send a Slack message or notification
   - Manage AWS resources (EC2 instances, S3 buckets)
   - Upload/search files in SharePoint
   - Run a database query in Snowflake
   - Any request that involves doing something, creating something, sending something, or modifying external systems

User message: "{user_message}"

Respond with ONLY the category name, nothing else."""

    # Try SLM first (fast, local classification)
    try:
        slm_prompt = f"/no_think\n{prompt}"
        response = await slm_generate(
            "You are an intent classifier. Respond with only one word.",
            slm_prompt,
            temperature=0.1,
            max_tokens=20,
        )
        text = strip_thinking(response).strip().lower()
        if "kb_query" in text:
            return "kb_query"
        if "workflow" in text:
            return "workflow"
        return "conversational"
    except Exception as e:
        logger.warning("SLM classify_intent failed, falling back to Gemini: %s", e)

    # Gemini fallback
    async def _call():
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=CHAT_MODEL,
            contents=prompt,
        )
        text = response.text.strip().lower()
        if "kb_query" in text:
            return "kb_query"
        if "workflow" in text:
            return "workflow"
        return "conversational"

    return await with_retry(_call)


async def summarize_article(title: str, body: str) -> str:
    """Summarize a knowledge base article."""
    prompt = f"""You are an enterprise knowledge base article processor. Given a raw article (often with HTML markup), produce a clean, well-structured summary that preserves ALL important information.

Title: {title}

Raw Article:
{body[:10000]}

Rules:
- Do NOT lose any factual information
- Use clean markdown formatting
- Remove HTML tags
- Keep designation/role-specific info clearly separated

Respond with ONLY the processed article content. No preamble."""

    async def _call():
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=CHAT_MODEL,
            contents=prompt,
        )
        return response.text.strip()

    return await with_retry(_call)
