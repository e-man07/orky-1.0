import { resolveUserAccessById } from '../access-control'
import { vectorSearch } from './search'
import { generateChatResponse } from '../gemini'
import { prisma } from '../prisma'
import type { SearchResult, SourceCitation, AgentResult } from '@/types'

function buildSystemPrompt(title: string | null): string {
  const designationLabel = title || 'employee'

  return `You are ORKY, an AI-powered knowledge assistant for enterprise employees. Your role is to answer questions based on the knowledge base articles provided as context.

The current user's designation is **${designationLabel}**.

Designation bands for reference:
- Band A (Senior Leadership): Director, Senior Director, Vice President, CXO
- Band B (Mid-Level Management): Manager, Senior Manager, Lead Architect, Program Manager
- Band C (Individual Contributors): Engineer, Analyst, Associate, Executive

Rules:
1. ONLY answer based on the provided context. If the context doesn't contain relevant information, say "I don't have information about that in the knowledge base."
2. Be concise and helpful. Format your response with markdown where appropriate.
3. Always maintain a professional, helpful tone.
4. Do NOT make up information not present in the context.
5. When the user asks about their own benefits/limits, respond with the information for their designation band (${designationLabel}).
6. IMPORTANT: If the user asks about a DIFFERENT designation band's benefits or limits (e.g., they are an Analyst asking about Director limits), respond ONLY with: "You don't have access to that designation band's information. Based on your designation (${designationLabel}), here is what applies to you:" followed by the user's own band information from the context.
7. If the user asks a general question like "what is the policy?", share only the info for their band.`
}

function buildContext(results: SearchResult[]): string {
  if (results.length === 0) return 'No relevant knowledge base articles found.'

  // Deduplicate by article number
  const articleMap = new Map<
    string,
    { description: string; category: string; chunks: string[] }
  >()

  for (const result of results) {
    const existing = articleMap.get(result.articleNumber)
    if (existing) {
      existing.chunks.push(result.content)
    } else {
      articleMap.set(result.articleNumber, {
        description: result.shortDescription,
        category: result.category || 'General',
        chunks: [result.content],
      })
    }
  }

  let context = 'Relevant Knowledge Base Articles:\n\n'
  for (const [number, article] of articleMap) {
    context += `--- Article ${number}: ${article.description} (${article.category}) ---\n`
    context += article.chunks.join('\n\n')
    context += '\n\n'
  }

  return context
}

export async function runRAGPipeline(
  userId: number,
  query: string,
  conversationHistory: { role: 'user' | 'model'; content: string }[] = []
): Promise<AgentResult> {
  // Step 1: Resolve access
  const access = await resolveUserAccessById(userId)
  if (!access) {
    return {
      response: 'Unable to verify your access permissions. Please try again.',
      sources: [],
      status: 'failed',
    }
  }

  // Get user's title for LLM filtering
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  // Step 2+3: Vector search with access control
  const searchResults = await vectorSearch(query, access.criteriaIds)

  if (searchResults.length === 0) {
    return {
      response:
        "I couldn't find any relevant information in the knowledge base for your query. Could you try rephrasing your question?",
      sources: [],
      status: 'success',
    }
  }

  // Step 4: Build context
  const context = buildContext(searchResults)

  // Step 5: Generate response with designation-aware prompt
  const systemPrompt = buildSystemPrompt(user?.title || null)
  const fullPrompt = `${context}\n\nUser Question: ${query}`
  const response = await generateChatResponse(
    systemPrompt,
    fullPrompt,
    conversationHistory
  )

  // Step 6: Build source citations
  const sourcesMap = new Map<string, SourceCitation>()
  for (const result of searchResults) {
    if (!sourcesMap.has(result.articleNumber)) {
      sourcesMap.set(result.articleNumber, {
        articleNumber: result.articleNumber,
        shortDescription: result.shortDescription,
        category: result.category || 'General',
        similarity: result.similarity,
      })
    }
  }

  return {
    response,
    sources: Array.from(sourcesMap.values()),
    status: 'success',
  }
}
