import { prisma } from '../prisma'
import { generateEmbedding, summarizeArticle } from '../gemini'
import { chunkText } from '../chunker'

const BATCH_SIZE = 10

export async function generateAndStoreEmbeddings(
  articleId: number
): Promise<number> {
  const article = await prisma.knowledgeArticle.findUnique({
    where: { id: articleId },
  })

  if (!article) throw new Error(`Article ${articleId} not found`)

  // Delete existing chunks for this article
  await prisma.articleChunk.deleteMany({ where: { articleId } })

  // Step 1: Summarize the raw article with Gemini (strip HTML, keep all facts)
  let processedBody = article.articleBody
  try {
    const summary = await summarizeArticle(article.shortDescription, article.articleBody)
    console.log(`  Summarized article ${article.number} (${article.articleBody.length} -> ${summary.length} chars)`)

    // Store the summarized version in DB
    await prisma.knowledgeArticle.update({
      where: { id: articleId },
      data: { articleBody: summary },
    })
    processedBody = summary
  } catch (e) {
    console.error(`  Failed to summarize article ${article.number}, using raw body:`, e instanceof Error ? e.message : e)
  }

  // Step 2: Chunk the summarized article (not raw HTML)
  const textToChunk = `${article.shortDescription}\n\n${processedBody}`
  const chunks = chunkText(textToChunk)

  if (chunks.length === 0) return 0

  // Step 3: Create chunks in DB
  for (const chunk of chunks) {
    await prisma.articleChunk.create({
      data: {
        articleId,
        content: chunk.content,
        chunkIndex: chunk.chunkIndex,
        chunkSize: chunk.chunkSize,
        precedingContext: chunk.precedingContext,
        followingContext: chunk.followingContext,
      },
    })
  }

  // Step 4: Generate embeddings from summarized chunks
  const dbChunks = await prisma.articleChunk.findMany({
    where: { articleId },
    orderBy: { chunkIndex: 'asc' },
  })

  let embeddedCount = 0
  for (let i = 0; i < dbChunks.length; i += BATCH_SIZE) {
    const batch = dbChunks.slice(i, i + BATCH_SIZE)

    const embedPromises = batch.map(async (chunk) => {
      try {
        const embedding = await generateEmbedding(
          chunk.content,
          'retrieval_document'
        )
        const embeddingStr = `[${embedding.join(',')}]`
        await prisma.$executeRawUnsafe(
          `UPDATE article_chunks SET embedding = $1::vector WHERE id = $2`,
          embeddingStr,
          chunk.id
        )
        embeddedCount++
        console.log(`  Embedded chunk ${chunk.id} (${chunk.chunkIndex})`)
      } catch (error) {
        console.error(
          `Failed to embed chunk ${chunk.id}:`,
          error instanceof Error ? error.message : error
        )
      }
    })

    await Promise.all(embedPromises)
  }

  return embeddedCount
}

export async function generateAllEmbeddings(): Promise<{
  total: number
  embedded: number
}> {
  const articles = await prisma.knowledgeArticle.findMany({
    where: { isActive: true },
  })

  let totalEmbedded = 0
  for (const article of articles) {
    const count = await generateAndStoreEmbeddings(article.id)
    totalEmbedded += count
    console.log(
      `Article ${article.number}: ${count} chunks embedded`
    )
  }

  return { total: articles.length, embedded: totalEmbedded }
}
