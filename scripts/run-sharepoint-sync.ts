import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })

const TENANT_ID = process.env.SHAREPOINT_TENANT_ID || ''
const CLIENT_ID = process.env.SHAREPOINT_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SHAREPOINT_CLIENT_SECRET || ''
const SITE = process.env.SHAREPOINT_SITE || ''

// --- Chunker ---
function chunkText(text: string) {
  const CHUNK_SIZE = 500
  if (!text || text.trim().length === 0) return []
  const cleanText = text.replace(/\s+/g, ' ').trim()
  if (cleanText.length <= CHUNK_SIZE) {
    return [{ content: cleanText, chunkIndex: 0, chunkSize: cleanText.length, precedingContext: null, followingContext: null }]
  }
  const chunks: any[] = []
  let start = 0, chunkIndex = 0
  while (start < cleanText.length) {
    let end = Math.min(start + CHUNK_SIZE, cleanText.length)
    if (end < cleanText.length) {
      const searchStart = Math.max(end - 100, start)
      const window = cleanText.substring(searchStart, end)
      const lastBreak = Math.max(window.lastIndexOf('. '), window.lastIndexOf('\n'))
      if (lastBreak > 0) end = searchStart + lastBreak + 1
    }
    const content = cleanText.substring(start, end).trim()
    if (content.length > 0) {
      chunks.push({ content, chunkIndex, chunkSize: content.length, precedingContext: null, followingContext: null })
      chunkIndex++
    }
    start = end
  }
  return chunks
}

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })
  return result.embedding.values
}

async function getAccessToken(): Promise<string> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })
  const res = await fetch(`https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Auth failed: ${JSON.stringify(data)}`)
  return data.access_token
}

async function main() {
  console.log('=== SharePoint Sync ===\n')

  const token = await getAccessToken()
  console.log('Got access token\n')

  // Get site ID
  const [host, ...pathParts] = SITE.split('/')
  const sitePath = pathParts.join('/')
  console.log(`Looking up site: ${host}:/${sitePath}`)

  const siteRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${host}:/${sitePath}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!siteRes.ok) {
    const err = await siteRes.text()
    console.error(`Failed to get site (${siteRes.status}):`, err)
    return
  }
  const site = await siteRes.json()
  console.log(`Site ID: ${site.id}\n`)

  // List drive items
  const driveRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive/root/children`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!driveRes.ok) {
    const err = await driveRes.text()
    console.error(`Failed to list drive (${driveRes.status}):`, err)
    return
  }
  const driveData = await driveRes.json()
  const items = driveData.value || []
  console.log(`Found ${items.length} items in drive root:\n`)

  let synced = 0
  for (const item of items) {
    console.log(`  ${item.name} (${item.file ? 'file' : 'folder'}, ${item.size} bytes)`)

    if (!item.file) {
      // If it's a folder, list its children
      const folderRes = await fetch(`https://graph.microsoft.com/v1.0/sites/${site.id}/drive/items/${item.id}/children`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (folderRes.ok) {
        const folderData = await folderRes.json()
        const subItems = folderData.value || []
        console.log(`    -> ${subItems.length} items inside`)
        for (const sub of subItems) {
          console.log(`      ${sub.name} (${sub.file ? 'file' : 'folder'}, ${sub.size} bytes)`)
          if (sub.file && sub['@microsoft.graph.downloadUrl']) {
            await syncDocument(token, sub, site.id)
            synced++
          }
        }
      }
      continue
    }

    if (item['@microsoft.graph.downloadUrl']) {
      await syncDocument(token, item, site.id)
      synced++
    }
  }

  console.log(`\n=== Done: ${synced} documents synced ===`)
}

async function syncDocument(token: string, doc: any, siteId: string) {
  try {
    const downloadUrl = doc['@microsoft.graph.downloadUrl']
    const res = await fetch(downloadUrl)
    if (!res.ok) {
      console.log(`    SKIP: download failed (${res.status})`)
      return
    }
    const content = await res.text()
    if (!content || content.length < 10) {
      console.log(`    SKIP: empty content`)
      return
    }

    const articleNumber = `SP-${doc.id.substring(0, 12)}`
    console.log(`    Syncing as ${articleNumber} (${content.length} chars)`)

    const article = await prisma.knowledgeArticle.upsert({
      where: { number: articleNumber },
      update: { shortDescription: doc.name, articleBody: content, source: 'sharepoint', isActive: true },
      create: { number: articleNumber, shortDescription: doc.name, articleBody: content, source: 'sharepoint', isActive: true },
    })

    // Chunk + embed
    await prisma.articleChunk.deleteMany({ where: { articleId: article.id } })
    const chunks = chunkText(content)
    for (const chunk of chunks) {
      await prisma.articleChunk.create({
        data: { articleId: article.id, content: chunk.content, chunkIndex: chunk.chunkIndex, chunkSize: chunk.chunkSize, precedingContext: chunk.precedingContext, followingContext: chunk.followingContext },
      })
    }
    const dbChunks = await prisma.articleChunk.findMany({ where: { articleId: article.id }, orderBy: { chunkIndex: 'asc' } })
    let embedded = 0
    for (const chunk of dbChunks) {
      try {
        const embedding = await generateEmbedding(chunk.content)
        const embeddingStr = `[${embedding.join(',')}]`
        await prisma.$executeRawUnsafe(`UPDATE article_chunks SET embedding = $1::vector WHERE id = $2`, embeddingStr, chunk.id)
        embedded++
      } catch (e: any) {
        console.log(`    EMBED FAIL chunk ${chunk.chunkIndex}: ${e.message}`)
      }
    }
    console.log(`    -> ${embedded}/${chunks.length} chunks embedded`)
  } catch (e: any) {
    console.error(`    ERROR: ${e.message}`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
