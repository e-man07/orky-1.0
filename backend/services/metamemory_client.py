"""
MetaMemory Client — Lightweight Python client for ORKY ↔ MetaMemory integration.

MetaMemory runs as a sidecar service exposing its REST API on port 3001.
This client replaces ORKY's basic cosine-similarity chat history search
with MetaMemory's adaptive multi-vector retrieval.

Usage:
    from services.metamemory_client import MetaMemoryClient

    client = MetaMemoryClient()  # defaults to localhost:3001

    # Store a memory
    await client.store_memory(
        content="User asked about leave policy. Agent provided HR link.",
        user_id="user-123",
        metadata={"sessionId": "sess-1", "source": "orky-chat", "intent": "kb_query"},
    )

    # Search memories (replaces chat_history_search)
    results = await client.search_memories(
        query="What is the leave policy?",
        user_id="user-123",
        strategy="hybrid",
    )

    # Submit feedback
    await client.submit_feedback(pattern_id="pat-1", effectiveness=0.9)
"""

from __future__ import annotations

import httpx
from typing import Any


class MetaMemoryClient:
    """Async HTTP client for the MetaMemory sidecar API."""

    def __init__(
        self,
        base_url: str = "http://localhost:3001",
        timeout: float = 30.0,
        api_key: str | None = None,
    ):
        headers = {}
        if api_key:
            headers["X-API-Key"] = api_key
        self.client = httpx.AsyncClient(
            base_url=base_url,
            timeout=timeout,
            headers=headers,
        )

    # ── Memory Storage ──────────────────────────────────────────────────

    async def store_memory(
        self,
        content: str,
        user_id: str,
        metadata: dict[str, Any] | None = None,
        emotional_tags: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Store a memory in MetaMemory (replaces _embed_chat_messages)."""
        payload: dict[str, Any] = {
            "content": content,
            "userId": user_id,
        }
        if metadata:
            payload["metadata"] = metadata
        if emotional_tags:
            payload["emotionalTags"] = emotional_tags

        resp = await self.client.post("/memories", json=payload)
        resp.raise_for_status()
        return resp.json()

    # ── Memory Search ───────────────────────────────────────────────────

    async def search_memories(
        self,
        query: str,
        user_id: str,
        limit: int = 10,
        min_similarity: float = 0.3,
        strategy: str = "hybrid",
    ) -> list[dict[str, Any]]:
        """Search memories (replaces chat_history_search).

        Returns a list of results, each with:
          - memory: {id, content, timestamp, emotionalTags, metadata}
          - score: float (0-1)
          - explanation: str (optional)
        """
        resp = await self.client.post(
            "/memories/search",
            json={
                "query": query,
                "userId": user_id,
                "limit": limit,
                "minSimilarity": min_similarity,
                "strategy": strategy,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data.get("results", data if isinstance(data, list) else [])

    # ── Feedback ────────────────────────────────────────────────────────

    async def submit_feedback(
        self,
        pattern_id: str,
        effectiveness: float,
        relevance: float | None = None,
        feedback_type: str = "implicit",
    ) -> None:
        """Submit feedback after a chat response (enables learning loops)."""
        payload: dict[str, Any] = {
            "usagePatternId": pattern_id,
            "effectiveness": effectiveness,
            "type": feedback_type,
        }
        if relevance is not None:
            payload["relevance"] = relevance

        resp = await self.client.post("/feedback", json=payload)
        resp.raise_for_status()

    # ── Strategy Recommendation ─────────────────────────────────────────

    async def get_strategy_recommendation(
        self,
        query_type: str = "specific",
        domain: str | None = None,
        user_id: str | None = None,
    ) -> dict[str, Any]:
        """Get the recommended retrieval strategy for a query context."""
        params: dict[str, Any] = {"queryType": query_type}
        if domain:
            params["domain"] = domain
        if user_id:
            params["userId"] = user_id

        resp = await self.client.get("/strategy/recommendation", params=params)
        resp.raise_for_status()
        return resp.json()

    # ── Conversation Management ─────────────────────────────────────────

    async def create_conversation(
        self,
        user_id: str,
        title: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a new conversation for tracking chat sessions."""
        payload: dict[str, Any] = {"userId": user_id}
        if title:
            payload["title"] = title
        if metadata:
            payload["metadata"] = metadata

        resp = await self.client.post("/conversations", json=payload)
        resp.raise_for_status()
        return resp.json()

    async def add_message(
        self,
        conversation_id: str,
        role: str,
        content: str,
        emotional_state: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Add a message to a conversation."""
        payload: dict[str, Any] = {
            "conversationId": conversation_id,
            "role": role,
            "content": content,
        }
        if emotional_state:
            payload["emotionalState"] = emotional_state
        if metadata:
            payload["metadata"] = metadata

        resp = await self.client.post(
            f"/conversations/{conversation_id}/messages",
            json=payload,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Health ──────────────────────────────────────────────────────────

    async def health_check(self) -> bool:
        """Check if MetaMemory sidecar is reachable."""
        try:
            resp = await self.client.get("/health")
            return resp.status_code == 200
        except httpx.HTTPError:
            return False

    # ── Cleanup ─────────────────────────────────────────────────────────

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self.client.aclose()

    async def __aenter__(self) -> MetaMemoryClient:
        return self

    async def __aexit__(self, *args: Any) -> None:
        await self.close()
