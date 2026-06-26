"""SLM client service for Qwen3-8B on Akash/vLLM.

Parallels gemini.py — uses the OpenAI-compatible API exposed by vLLM.
"""

import logging
import re
from openai import AsyncOpenAI
from config import get_settings

logger = logging.getLogger(__name__)

settings = get_settings()

slm_client: AsyncOpenAI | None = None
if settings.slm_base_url:
    slm_client = AsyncOpenAI(
        base_url=settings.slm_base_url,
        api_key=settings.slm_api_key,
    )


def _get_client() -> AsyncOpenAI:
    if slm_client is None:
        raise RuntimeError(
            "SLM client not configured. Set SLM_BASE_URL in your environment."
        )
    return slm_client


def strip_thinking(text: str) -> str:
    """Remove <think>...</think> tags from Qwen3 responses."""
    return re.sub(r'<think>.*?</think>', '', text, flags=re.DOTALL).strip()


async def slm_generate(
    system_prompt: str,
    user_prompt: str,
    response_format: dict | None = None,
    tools: list | None = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
) -> str:
    """Single-shot generation for planning/classification tasks.

    Returns the text content of the first choice.
    """
    client = _get_client()

    kwargs: dict = {
        "model": settings.slm_model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format is not None:
        kwargs["response_format"] = response_format
    if tools is not None:
        kwargs["tools"] = tools

    response = await client.chat.completions.create(**kwargs)
    message = response.choices[0].message

    # If tool calls were returned, serialize them as JSON for the caller
    if message.tool_calls:
        import json
        return json.dumps(
            [
                {
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    }
                }
                for tc in message.tool_calls
            ]
        )

    return message.content or ""


async def slm_chat(
    system_prompt: str,
    messages: list[dict],
    tools: list | None = None,
    temperature: float = 0.1,
    max_tokens: int = 4096,
):
    """Multi-turn chat with function calling support.

    Args:
        system_prompt: System-level instruction.
        messages: OpenAI-format message list (role/content dicts).
        tools: OpenAI-format tool declarations for function calling.
        temperature: Sampling temperature.
        max_tokens: Maximum tokens to generate.

    Returns:
        The full ChatCompletionMessage object (has .content and .tool_calls).
    """
    client = _get_client()

    all_messages = [{"role": "system", "content": system_prompt}] + messages

    kwargs: dict = {
        "model": settings.slm_model_name,
        "messages": all_messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if tools is not None:
        kwargs["tools"] = tools

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message


async def slm_health_check() -> dict:
    """Verify the vLLM endpoint is reachable and the model is loaded.

    Returns a dict with status, model name, and any error info.
    """
    try:
        client = _get_client()
        models = await client.models.list()
        model_ids = [m.id for m in models.data]
        return {
            "status": "healthy",
            "models": model_ids,
            "endpoint": settings.slm_base_url,
        }
    except RuntimeError as e:
        return {"status": "not_configured", "error": str(e)}
    except Exception as e:
        logger.warning("SLM health check failed: %s", e)
        return {
            "status": "unhealthy",
            "error": str(e),
            "endpoint": settings.slm_base_url,
        }
