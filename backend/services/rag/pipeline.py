from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, UserCriteria
from services.gemini import generate_chat_response
from services.rag.search import vector_search


def _build_system_prompt(title: str | None) -> str:
    designation_label = title or "employee"
    return f"""You are ORKY, an AI-powered knowledge assistant for enterprise employees. Your role is to answer questions based on the knowledge base articles provided as context.

The current user's designation is **{designation_label}**. When the context contains information for multiple designation bands, ONLY share the information relevant to this user's designation.

Rules:
1. ONLY answer based on the provided context. If the context doesn't contain relevant information, say "I don't have information about that in the knowledge base."
2. Be concise and helpful. Format your response with markdown where appropriate.
3. If multiple articles are relevant, synthesize the information.
4. Always maintain a professional, helpful tone.
5. Do NOT make up information not present in the context.
6. If the user's question is ambiguous, provide the most relevant answer from the context.
7. IMPORTANT: Filter your response to only include information applicable to the user's designation ({designation_label}). Do not mention policies or limits for other designation bands."""


def _build_context(results: list[dict]) -> str:
    if not results:
        return "No relevant knowledge base articles found."

    article_map: dict[str, dict] = {}
    for r in results:
        num = r["articleNumber"]
        if num in article_map:
            article_map[num]["chunks"].append(r["content"])
        else:
            article_map[num] = {
                "description": r["shortDescription"],
                "category": r.get("category") or "General",
                "chunks": [r["content"]],
            }

    context = "Relevant Knowledge Base Articles:\n\n"
    for number, article in article_map.items():
        context += f"--- Article {number}: {article['description']} ({article['category']}) ---\n"
        context += "\n\n".join(article["chunks"])
        context += "\n\n"
    return context


async def resolve_user_access(db: AsyncSession, user_id: int) -> dict | None:
    """Resolve user's access criteria based on title/designation."""
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        return None

    criteria_result = await db.execute(select(UserCriteria))
    all_criteria = criteria_result.scalars().all()

    matched = []
    for c in all_criteria:
        if c.match_type == "designation" and user.title:
            designations = [d.strip().lower() for d in c.match_value.split(",")]
            if user.title.lower() in designations:
                matched.append(c)

    return {
        "userId": user.id,
        "criteriaIds": [c.id for c in matched],
        "criteria": [{"id": c.id, "name": c.name} for c in matched],
        "title": user.title,
    }


async def run_rag_pipeline(
    db: AsyncSession,
    user_id: int,
    query: str,
    conversation_history: list[dict] | None = None,
) -> dict:
    """Full RAG pipeline: access -> search -> context -> generate -> sources."""
    access = await resolve_user_access(db, user_id)
    if not access:
        return {
            "response": "Unable to verify your access permissions. Please try again.",
            "sources": [],
            "status": "failed",
        }

    search_results = await vector_search(db, query, access["criteriaIds"])

    if not search_results:
        return {
            "response": "I couldn't find any relevant information in the knowledge base for your query. Could you try rephrasing your question?",
            "sources": [],
            "status": "success",
        }

    context = _build_context(search_results)
    system_prompt = _build_system_prompt(access.get("title"))
    full_prompt = f"{context}\n\nUser Question: {query}"
    response = await generate_chat_response(system_prompt, full_prompt, conversation_history)

    # Build source citations (deduplicated)
    sources_map: dict[str, dict] = {}
    for r in search_results:
        num = r["articleNumber"]
        if num not in sources_map:
            sources_map[num] = {
                "articleNumber": num,
                "shortDescription": r["shortDescription"],
                "category": r.get("category") or "General",
                "similarity": r["similarity"],
            }

    return {
        "response": response,
        "sources": list(sources_map.values()),
        "status": "success",
    }
