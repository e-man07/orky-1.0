import time

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User, UserCriteria
from services.gemini import generate_chat_response
from services.rag.search import vector_search


def _build_system_prompt(title: str | None) -> str:
    designation_label = title or "employee"
    return f"""You are ORKY, an AI-powered knowledge assistant for enterprise employees. Your role is to answer questions based on the knowledge base articles provided as context.

The current user's designation is **{designation_label}**.

Designation bands for reference:
- Band A (Senior Leadership): Director, Senior Director, Vice President, CXO
- Band B (Mid-Level Management): Manager, Senior Manager, Lead Architect, Program Manager
- Band C (Individual Contributors): Engineer, Analyst, Associate, Executive

Rules:
1. ONLY answer based on the provided context. If the context doesn't contain relevant information, say "I don't have information about that in the knowledge base."
2. Be concise and helpful. Format your response with markdown where appropriate.
3. Always maintain a professional, helpful tone.
4. Do NOT make up information not present in the context.
5. When the user asks about their own benefits/limits, respond with the information for their designation band ({designation_label}).
6. IMPORTANT: If the user asks about a DIFFERENT designation band's benefits or limits (e.g., they are an Analyst asking about Director limits), respond ONLY with: "You don't have access to that designation band's information. Based on your designation ({designation_label}), here is what applies to you:" followed by the user's own band information from the context.
7. If the user asks a general question like "what is the policy?", share only the info for their band."""


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
    query_embedding: list[float] | None = None,
) -> dict:
    """Full RAG pipeline: access -> search -> context -> generate -> sources."""
    access = await resolve_user_access(db, user_id)
    if not access:
        return {
            "response": "Unable to verify your access permissions. Please try again.",
            "sources": [],
            "status": "failed",
        }

    t0 = time.time()
    search_results = await vector_search(db, query, access["criteriaIds"], query_embedding=query_embedding)
    print(f"[RAG] Vector search: {time.time() - t0:.1f}s, results: {len(search_results)}")

    if not search_results:
        return {
            "response": "I couldn't find any relevant information in the knowledge base for your query. Could you try rephrasing your question?",
            "sources": [],
            "status": "success",
        }

    context = _build_context(search_results)
    system_prompt = _build_system_prompt(access.get("title"))
    full_prompt = f"{context}\n\nUser Question: {query}"
    t1 = time.time()
    response = await generate_chat_response(system_prompt, full_prompt, conversation_history)
    print(f"[RAG] LLM response: {time.time() - t1:.1f}s")

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
