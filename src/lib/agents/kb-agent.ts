import { BaseAgent } from './base'
import { resolveUserAccessById } from '../access-control'
import { vectorSearch, vectorSearchUnfiltered } from '../rag/search'
import { generateChatResponse, checkQueryAccess } from '../gemini'
import { prisma } from '../prisma'
import type { AgentResult, SearchResult, SourceCitation } from '@/types'

function buildSystemPrompt(title: string | null): string {
  const designationLabel = title || 'employee'

  return `You are ORKY, an AI-powered knowledge assistant for enterprise employees. Your role is to answer questions based on the knowledge base articles provided as context.

The current user's designation is **${designationLabel}**. When the context contains information for multiple designation bands (e.g., Band A - Senior Leadership, Band B - Mid Management, Band C - Individual Contributors), ONLY share the information that is relevant to this specific user's designation band. Do NOT share information meant for other designation bands.

Designation bands for reference:
- Band A (Senior Leadership): Director, Senior Director, Vice President, CXO
- Band B (Mid-Level Management): Manager, Senior Manager, Lead Architect, Program Manager
- Band C (Individual Contributors): Engineer, Analyst, Associate, Executive

Rules:
1. ONLY answer based on the provided context. If the context doesn't contain relevant information, say "I don't have information about that in the knowledge base."
2. Be concise and helpful. Format your response with markdown where appropriate.
3. If multiple articles are relevant, synthesize the information.
4. Always maintain a professional, helpful tone.
5. Do NOT make up information not present in the context.
6. If the user's question is ambiguous, provide the most relevant answer from the context.
7. IMPORTANT: Filter your response to only include information applicable to the user's designation (${designationLabel}). Do not mention policies or limits for other designation bands.`
}

function buildContext(results: SearchResult[]): string {
  if (results.length === 0) return 'No relevant knowledge base articles found.'

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

export class KnowledgeBaseAgent extends BaseAgent {
  constructor(executionId: number) {
    super('kb_agent', executionId)
  }

  async execute(
    userId: number,
    query: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[] = []
  ): Promise<AgentResult> {
    try {
      // Step 1: Resolve access
      await this.updateStatus('searching_kb')
      await this.logAction('Resolving user access permissions')

      const access = await resolveUserAccessById(userId)
      if (!access) {
        await this.updateStatus('failed')
        return {
          response:
            'Unable to verify your access permissions. Please try again.',
          sources: [],
          status: 'failed',
        }
      }

      await this.logAction('Access resolved', {
        criteriaCount: access.criteriaIds.length,
        criteria: access.criteria.map((c) => c.name),
      })

      // Step 1.5: Pre-search access check
      const user = await prisma.user.findUnique({
        where: { id: userId },
      })
      const userTitle = user?.title || 'employee'

      await this.logAction('Checking query access permissions')
      const accessCheck = await checkQueryAccess(query, userTitle)
      if (!accessCheck.allowed) {
        await this.logAction('Access denied', { reason: accessCheck.reason })
        await this.updateStatus('success')
        return {
          response: accessCheck.reason || "You don't have access to that information.",
          sources: [],
          status: 'success',
        }
      }
      await this.logAction('Access check passed')

      // Step 2: Vector search (with access control)
      await this.logAction('Searching knowledge base')
      const searchResults = await vectorSearch(query, access.criteriaIds)
      const embeddingStr = (searchResults as any)._embeddingStr

      await this.logAction('Search complete', {
        resultsFound: searchResults.length,
        topArticles: searchResults
          .slice(0, 3)
          .map((r) => `${r.articleNumber}: ${r.shortDescription}`),
      })

      // Step 2.5: Check if restricted articles exist that the user can't access
      if (embeddingStr) {
        const unfilteredResults = await vectorSearchUnfiltered(embeddingStr, 0.5, 5)
        const filteredArticles = new Set(searchResults.map((r) => r.articleNumber))
        const restrictedMatches = unfilteredResults.filter(
          (r) => !filteredArticles.has(r.articleNumber)
        )

        console.log('[KB_AGENT] Filtered top:', searchResults.slice(0, 3).map((r) => `${r.articleNumber}=${r.similarity.toFixed(3)}`))
        console.log('[KB_AGENT] Unfiltered top:', unfilteredResults.slice(0, 3).map((r) => `${r.articleNumber}=${r.similarity.toFixed(3)}`))
        console.log('[KB_AGENT] Restricted matches:', restrictedMatches.map((r) => `${r.articleNumber}=${r.similarity.toFixed(3)}`))

        if (restrictedMatches.length > 0) {
          const topRestricted = restrictedMatches[0]
          const topFiltered = searchResults.length > 0 ? searchResults[0].similarity : 0

          // If the best restricted result is more relevant than the best filtered result,
          // the user is asking about something they can't access
          if (topRestricted.similarity > topFiltered + 0.05) {
            await this.logAction('Access restricted', {
              restrictedArticle: `${topRestricted.articleNumber}: ${topRestricted.shortDescription}`,
              restrictedSimilarity: topRestricted.similarity,
              topFilteredSimilarity: topFiltered,
            })
            await this.updateStatus('success')
            return {
              response: `You don't have access to the information you're looking for. The relevant knowledge base article "${topRestricted.shortDescription}" is restricted based on your current designation (${userTitle}).`,
              sources: [],
              status: 'success',
            }
          }
        }
      }

      if (searchResults.length === 0) {
        await this.updateStatus('success')
        return {
          response:
            "I couldn't find any relevant information in the knowledge base for your query. Could you try rephrasing your question?",
          sources: [],
          status: 'success',
        }
      }

      // Step 3: Generate response
      await this.updateStatus('generating')
      await this.logAction('Generating response from context')

      const systemPrompt = buildSystemPrompt(userTitle)

      const context = buildContext(searchResults)
      const fullPrompt = `${context}\n\nUser Question: ${query}`
      const response = await generateChatResponse(
        systemPrompt,
        fullPrompt,
        conversationHistory
      )

      // Build source citations — only include high-relevance sources with snippet
      const sourcesMap = new Map<string, SourceCitation>()
      for (const result of searchResults) {
        if (!sourcesMap.has(result.articleNumber) && result.similarity > 0.5) {
          // Extract a short snippet (first 150 chars of the best matching chunk)
          const snippet = result.content
            .replace(/<[^>]*>/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 150)
          sourcesMap.set(result.articleNumber, {
            articleNumber: result.articleNumber,
            shortDescription: result.shortDescription,
            category: result.category || 'General',
            similarity: result.similarity,
            snippet: snippet + (result.content.length > 150 ? '...' : ''),
          })
        }
      }

      const sources = Array.from(sourcesMap.values())

      await this.logAction('Response generated', {
        sourcesUsed: sources.length,
      })
      await this.updateStatus('success')

      return { response, sources, status: 'success' }
    } catch (error) {
      console.error('[KB_AGENT ERROR]', error)
      await this.updateStatus('failed')
      await this.logAction('Error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        response:
          'An error occurred while processing your query. Please try again.',
        sources: [],
        status: 'failed',
      }
    }
  }
}
