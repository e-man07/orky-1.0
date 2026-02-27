import { prisma } from '../prisma'
import { generateEmbedding } from '../gemini'
import type { SearchResult } from '@/types'

const DEFAULT_SIMILARITY_THRESHOLD = 0.5
const DEFAULT_TOP_K = 5

export async function vectorSearch(
  query: string,
  criteriaIds: number[],
  options?: {
    similarityThreshold?: number
    topK?: number
  }
): Promise<SearchResult[] & { _embeddingStr?: string }> {
  const threshold = options?.similarityThreshold ?? DEFAULT_SIMILARITY_THRESHOLD
  const topK = options?.topK ?? DEFAULT_TOP_K

  // Generate query embedding
  const queryEmbedding = await generateEmbedding(query, 'retrieval_query')
  const embeddingStr = JSON.stringify(queryEmbedding)

  // Vector search with access control
  const results: SearchResult[] = await prisma.$queryRawUnsafe(
    `
    SELECT
      ac.id as "chunkId",
      ac.content,
      ac.preceding_context as "precedingContext",
      ac.following_context as "followingContext",
      ka.number as "articleNumber",
      ka.short_description as "shortDescription",
      ka.category,
      1 - (ac.embedding <=> $1::vector) AS similarity
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
          WHERE acr.article_id = ka.id AND acr.criteria_id = ANY($2::int[])
        )
      )
      AND 1 - (ac.embedding <=> $1::vector) >= $3
    ORDER BY similarity DESC
    LIMIT $4
    `,
    embeddingStr,
    criteriaIds,
    threshold,
    topK
  )

  // Attach embedding string for potential reuse in unfiltered search
  ;(results as any)._embeddingStr = embeddingStr
  return results
}

// Unfiltered search — used to check if restricted articles would have matched
export async function vectorSearchUnfiltered(
  queryEmbeddingStr: string,
  threshold: number = DEFAULT_SIMILARITY_THRESHOLD,
  topK: number = 3
): Promise<SearchResult[]> {
  const results: SearchResult[] = await prisma.$queryRawUnsafe(
    `
    SELECT
      ac.id as "chunkId",
      ac.content,
      ac.preceding_context as "precedingContext",
      ac.following_context as "followingContext",
      ka.number as "articleNumber",
      ka.short_description as "shortDescription",
      ka.category,
      1 - (ac.embedding <=> $1::vector) AS similarity
    FROM article_chunks ac
    JOIN knowledge_articles ka ON ac.article_id = ka.id
    WHERE ka.is_active = true
      AND ac.embedding IS NOT NULL
      AND 1 - (ac.embedding <=> $1::vector) >= $2
    ORDER BY similarity DESC
    LIMIT $3
    `,
    queryEmbeddingStr,
    threshold,
    topK
  )
  return results
}
