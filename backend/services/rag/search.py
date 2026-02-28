import json
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from services.gemini import generate_embedding

DEFAULT_SIMILARITY_THRESHOLD = 0.5
DEFAULT_TOP_K = 5


async def vector_search(
    db: AsyncSession,
    query: str,
    criteria_ids: list[int],
    similarity_threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    top_k: int = DEFAULT_TOP_K,
    query_embedding: list[float] | None = None,
) -> list[dict]:
    """Vector search with access control filtering."""
    if query_embedding is None:
        query_embedding = await generate_embedding(query, "RETRIEVAL_QUERY")
    embedding_str = json.dumps(query_embedding)

    result = await db.execute(
        text("""
            SELECT
                ac.id as "chunkId",
                ac.content,
                ac.preceding_context as "precedingContext",
                ac.following_context as "followingContext",
                ka.number as "articleNumber",
                ka.short_description as "shortDescription",
                ka.category,
                1 - (ac.embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM article_chunks ac
            JOIN knowledge_articles ka ON ac.article_id = ka.id
            WHERE ka.is_active = true
                AND ac.embedding IS NOT NULL
                AND (
                    NOT EXISTS (
                        SELECT 1 FROM article_criteria acr WHERE acr.article_id = ka.id
                    )
                    OR EXISTS (
                        SELECT 1 FROM article_criteria acr
                        WHERE acr.article_id = ka.id AND acr.criteria_id = ANY(:criteria_ids)
                    )
                )
                AND 1 - (ac.embedding <=> CAST(:embedding AS vector)) >= :threshold
            ORDER BY similarity DESC
            LIMIT :top_k
        """),
        {
            "embedding": embedding_str,
            "criteria_ids": criteria_ids,
            "threshold": similarity_threshold,
            "top_k": top_k,
        },
    )

    rows = result.mappings().all()
    return [dict(row) for row in rows]


async def chat_history_search(
    db: AsyncSession,
    user_id: int,
    query_embedding: list[float],
    similarity_threshold: float = 0.45,
    top_k: int = 5,
) -> list[dict]:
    """Search user's past chat messages by embedding similarity."""
    embedding_str = json.dumps(query_embedding)

    result = await db.execute(
        text("""
            SELECT
                cm.id,
                cm.role,
                cm.content,
                cs.title AS "sessionTitle",
                1 - (cm.embedding <=> CAST(:embedding AS vector)) AS similarity
            FROM chat_messages cm
            JOIN chat_sessions cs ON cm.session_id = cs.id
            WHERE cs.user_id = :user_id
                AND cm.embedding IS NOT NULL
                AND 1 - (cm.embedding <=> CAST(:embedding AS vector)) >= :threshold
            ORDER BY similarity DESC
            LIMIT :top_k
        """),
        {
            "embedding": embedding_str,
            "user_id": user_id,
            "threshold": similarity_threshold,
            "top_k": top_k,
        },
    )

    rows = result.mappings().all()
    return [dict(row) for row in rows]
