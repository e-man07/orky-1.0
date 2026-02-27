import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'
import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

// --- Chunker ---
function chunkText(text: string): { content: string; chunkIndex: number; chunkSize: number; precedingContext: string | null; followingContext: string | null }[] {
  const CHUNK_SIZE = 500
  const OVERLAP = 50
  if (!text || text.trim().length === 0) return []
  const cleanText = text.replace(/\s+/g, ' ').trim()

  if (cleanText.length <= CHUNK_SIZE) {
    return [{ content: cleanText, chunkIndex: 0, chunkSize: cleanText.length, precedingContext: null, followingContext: null }]
  }

  const chunks: any[] = []
  let start = 0
  let chunkIndex = 0

  while (start < cleanText.length) {
    let end = Math.min(start + CHUNK_SIZE, cleanText.length)
    if (end < cleanText.length) {
      const searchStart = Math.max(end - 100, start)
      const window = cleanText.substring(searchStart, end)
      const lastBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('.\n'), window.lastIndexOf('! '), window.lastIndexOf('? '), window.lastIndexOf('\n'))
      if (lastBreak > 0) end = searchStart + lastBreak + 1
    }

    const content = cleanText.substring(start, end).trim()
    if (content.length > 0) {
      const precStart = Math.max(0, start - OVERLAP)
      const precedingContext = start > 0 ? cleanText.substring(precStart, start).trim() : null
      const folEnd = Math.min(cleanText.length, end + OVERLAP)
      const followingContext = end < cleanText.length ? cleanText.substring(end, folEnd).trim() : null
      chunks.push({ content, chunkIndex, chunkSize: content.length, precedingContext, followingContext })
      chunkIndex++
    }
    start = end
  }
  return chunks
}

// --- Embedding ---
async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })
  return result.embedding.values
}

async function generateAndStoreEmbeddings(articleId: number): Promise<number> {
  const article = await prisma.knowledgeArticle.findUnique({ where: { id: articleId } })
  if (!article) throw new Error(`Article ${articleId} not found`)

  await prisma.articleChunk.deleteMany({ where: { articleId } })

  const textToChunk = `${article.shortDescription}\n\n${article.articleBody}`
  const chunks = chunkText(textToChunk)
  if (chunks.length === 0) return 0

  for (const chunk of chunks) {
    await prisma.articleChunk.create({
      data: { articleId, content: chunk.content, chunkIndex: chunk.chunkIndex, chunkSize: chunk.chunkSize, precedingContext: chunk.precedingContext, followingContext: chunk.followingContext },
    })
  }

  const dbChunks = await prisma.articleChunk.findMany({ where: { articleId }, orderBy: { chunkIndex: 'asc' } })

  let embeddedCount = 0
  for (const chunk of dbChunks) {
    try {
      const embedding = await generateEmbedding(chunk.content)
      const embeddingStr = `[${embedding.join(',')}]`
      await prisma.$executeRawUnsafe(
        `UPDATE article_chunks SET embedding = $1::vector WHERE id = $2`,
        embeddingStr,
        chunk.id
      )
      embeddedCount++
      console.log(`    Chunk ${chunk.chunkIndex} embedded (${chunk.chunkSize} chars)`)
    } catch (error: any) {
      console.error(`    FAILED chunk ${chunk.chunkIndex}:`, error.message)
    }
  }

  return embeddedCount
}

// --- Main ---
async function main() {
  console.log('=== Excel Sync + Embedding Pipeline ===\n')

  const filePath = path.join(process.cwd(), 'kb_knowledge.xlsx')
  console.log('Reading:', filePath)
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const rows: any[] = XLSX.utils.sheet_to_json(sheet)
  console.log(`Found ${rows.length} rows`)
  console.log('Columns:', Object.keys(rows[0] || {}))
  console.log()

  let totalArticles = 0
  let totalChunks = 0

  for (const row of rows) {
    if (!row.Number || !row['Article body']) {
      console.log(`Skipping row (no Number or Article body):`, Object.keys(row))
      continue
    }

    console.log(`[${row.Number}] "${row['Short description']}" (${row['Article body'].length} chars)`)

    const article = await prisma.knowledgeArticle.upsert({
      where: { number: row.Number },
      update: { shortDescription: row['Short description'] || '', articleBody: row['Article body'], category: row.Category || null, workflow: row.Workflow || null, source: 'excel', isActive: true },
      create: { number: row.Number, shortDescription: row['Short description'] || '', articleBody: row['Article body'], category: row.Category || null, workflow: row.Workflow || null, source: 'excel', isActive: true },
    })

    // Link criteria
    if (row['Can Read']) {
      await prisma.articleCriteria.deleteMany({ where: { articleId: article.id } })
      const criteriaNames = String(row['Can Read']).split(',').map((s: string) => s.trim()).filter(Boolean)
      console.log(`  Can Read: [${criteriaNames.join(', ')}]`)

      for (const name of criteriaNames) {
        const criteria = await prisma.userCriteria.findUnique({ where: { name } })
        if (criteria) {
          await prisma.articleCriteria.create({ data: { articleId: article.id, criteriaId: criteria.id } })
          console.log(`    Linked criteria: ${name} (id=${criteria.id})`)
        } else {
          console.log(`    WARNING: criteria "${name}" not found in DB`)
        }
      }
    } else {
      console.log(`  Can Read: (open/unrestricted)`)
    }

    // Chunk + embed
    const embeddedCount = await generateAndStoreEmbeddings(article.id)
    totalChunks += embeddedCount
    totalArticles++
    console.log(`  -> ${embeddedCount} chunks embedded\n`)
  }

  console.log(`\n=== Done ===`)
  console.log(`Articles: ${totalArticles}`)
  console.log(`Chunks embedded: ${totalChunks}`)

  // Verify
  const chunkCount = await prisma.articleChunk.count()
  const embeddedChunkCount: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM article_chunks WHERE embedding IS NOT NULL`)
  console.log(`\nDB verification:`)
  console.log(`  Total chunks in DB: ${chunkCount}`)
  console.log(`  Chunks with embeddings: ${embeddedChunkCount[0]?.cnt}`)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
