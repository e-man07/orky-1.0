import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI, TaskType } from '@google/generative-ai'

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
const embeddingModel = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

const BASE_URL = process.env.SERVICENOW_BASE_URL || 'https://dev285187.service-now.com'
const SN_USER = process.env.SERVICENOW_USER_ID!
const SN_PASS = process.env.SERVICENOW_PASSWORD!

// --- Helpers ---

async function fetchTable(table: string, query?: string): Promise<any[]> {
  const url = new URL(`${BASE_URL}/api/now/table/${table}`)
  url.searchParams.set('sysparm_display_value', 'true')
  if (query) url.searchParams.set('sysparm_query', query)
  const auth = Buffer.from(`${SN_USER}:${SN_PASS}`).toString('base64')
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`SN ${table}: ${res.status} ${res.statusText}`)
  const data = await res.json()
  return data.result || []
}

async function generateEmbedding(text: string): Promise<number[]> {
  const result = await embeddingModel.embedContent({
    content: { parts: [{ text }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })
  return result.embedding.values
}

async function summarizeArticle(title: string, body: string): Promise<string> {
  const prompt = `You are an enterprise knowledge base article processor. Given a raw article (often with HTML markup), produce a clean, well-structured summary that preserves ALL important information.

Think step by step:
1. Strip all HTML tags and formatting noise
2. Identify every factual detail, number, policy rule, eligibility criteria, deadline, limit, exception, and condition
3. Organize the information logically with clear sections
4. Preserve all specific values (amounts, dates, percentages, band/tier details, designation-specific rules)
5. Keep role/designation-specific distinctions clear

Title: ${title}

Raw Article:
${body.substring(0, 10000)}

Rules:
- Do NOT lose any factual information
- Use clean markdown formatting (headers, bullet points, sub-bullets)
- Remove HTML tags, redundant whitespace, and formatting artifacts
- Keep the language professional and concise but complete
- If the article has designation/role/band-specific info, keep each band's details clearly separated

Respond with ONLY the processed article content. No preamble.`

  const result = await chatModel.generateContent(prompt)
  return result.response.text().trim()
}

function chunkText(text: string) {
  const CHUNK_SIZE = 500, OVERLAP = 50
  if (!text?.trim()) return []
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= CHUNK_SIZE) {
    return [{ content: clean, chunkIndex: 0, chunkSize: clean.length, precedingContext: null, followingContext: null }]
  }
  const chunks: any[] = []
  let start = 0, idx = 0
  while (start < clean.length) {
    let end = Math.min(start + CHUNK_SIZE, clean.length)
    if (end < clean.length) {
      const s = Math.max(end - 100, start)
      const w = clean.substring(s, end)
      const lb = Math.max(w.lastIndexOf('. '), w.lastIndexOf('\n'))
      if (lb > 0) end = s + lb + 1
    }
    const content = clean.substring(start, end).trim()
    if (content.length > 0) {
      const ps = Math.max(0, start - OVERLAP)
      chunks.push({
        content, chunkIndex: idx, chunkSize: content.length,
        precedingContext: start > 0 ? clean.substring(ps, start).trim() : null,
        followingContext: end < clean.length ? clean.substring(end, Math.min(clean.length, end + OVERLAP)).trim() : null,
      })
      idx++
    }
    start = end
  }
  return chunks
}

// --- Sync Steps ---

async function syncUsers(): Promise<number> {
  console.log('--- Syncing Users ---')
  const records = await fetchTable('sys_user', 'company.nameLIKEMarTech^active=true')
  console.log(`  Fetched ${records.length} users`)
  let count = 0
  for (const r of records) {
    if (!r.email) continue
    await prisma.user.upsert({
      where: { email: r.email },
      update: {
        sysId: r.sys_id, userId: r.user_name,
        name: r.name || r.user_name,
        department: r.department?.display_value || r.department || null,
        location: r.location?.display_value || r.location || null,
        gender: r.gender || null,
        company: r.company?.display_value || r.company || null,
        title: r.title || null,
        active: r.active === 'true',
      },
      create: {
        sysId: r.sys_id, userId: r.user_name,
        name: r.name || r.user_name, email: r.email,
        department: r.department?.display_value || r.department || null,
        location: r.location?.display_value || r.location || null,
        gender: r.gender || null,
        company: r.company?.display_value || r.company || null,
        title: r.title || null,
        active: r.active === 'true',
      },
    })
    console.log(`  ${r.name} (${r.title || 'no title'})`)
    count++
  }
  return count
}

async function syncCriteria(): Promise<number> {
  console.log('--- Syncing Designation Criteria ---')
  const criteria = [
    { name: 'Band A - Senior Leadership', matchType: 'designation', matchValue: 'Director,Senior Director,Vice President,CXO' },
    { name: 'Band B - Mid Management', matchType: 'designation', matchValue: 'Manager,Senior Manager,Lead Architect,Program Manager' },
    { name: 'Band C - Individual Contributors', matchType: 'designation', matchValue: 'Engineer,Analyst,Associate,Executive' },
  ]
  for (const c of criteria) {
    await prisma.userCriteria.upsert({ where: { name: c.name }, update: c, create: c })
    console.log(`  ${c.name}`)
  }
  return criteria.length
}

async function syncArticles(): Promise<number> {
  console.log('--- Syncing Articles ---')
  const records = await fetchTable('kb_knowledge', 'workflow_state=Published')
  console.log(`  Fetched ${records.length} articles`)
  let count = 0

  for (const r of records) {
    if (!r.number) continue
    const rawBody = r.text || r.article_body || ''
    console.log(`\n  [${r.number}] "${r.short_description}" (${rawBody.length} chars)`)

    // Step 1: Summarize with Gemini
    let processedBody = rawBody
    try {
      console.log(`    Summarizing...`)
      processedBody = await summarizeArticle(r.short_description, rawBody)
      console.log(`    Summarized (${rawBody.length} -> ${processedBody.length} chars)`)
    } catch (e: any) {
      console.log(`    Summarize failed: ${e.message}, using raw body`)
    }

    // Step 2: Store article
    const article = await prisma.knowledgeArticle.upsert({
      where: { number: r.number },
      update: {
        shortDescription: r.short_description || '',
        articleBody: processedBody,
        category: r.kb_category?.display_value || r.category || null,
        workflow: r.workflow_state || null,
        source: 'servicenow', isActive: true,
      },
      create: {
        number: r.number,
        shortDescription: r.short_description || '',
        articleBody: processedBody,
        category: r.kb_category?.display_value || r.category || null,
        workflow: r.workflow_state || null,
        source: 'servicenow', isActive: true,
      },
    })

    // Step 3: Link criteria
    if (r.can_read_user_criteria) {
      const names = String(r.can_read_user_criteria).split(',').map((s: string) => s.trim()).filter(Boolean)
      await prisma.articleCriteria.deleteMany({ where: { articleId: article.id } })
      for (const name of names) {
        const c = await prisma.userCriteria.findUnique({ where: { name } })
        if (c) await prisma.articleCriteria.create({ data: { articleId: article.id, criteriaId: c.id } })
      }
      console.log(`    Criteria: [${names.join(', ')}]`)
    }

    // Step 4: Chunk + embed the summarized text
    await prisma.articleChunk.deleteMany({ where: { articleId: article.id } })
    const chunks = chunkText(`${r.short_description}\n\n${processedBody}`)
    for (const chunk of chunks) {
      await prisma.articleChunk.create({
        data: { articleId: article.id, content: chunk.content, chunkIndex: chunk.chunkIndex, chunkSize: chunk.chunkSize, precedingContext: chunk.precedingContext, followingContext: chunk.followingContext },
      })
    }
    const dbChunks = await prisma.articleChunk.findMany({ where: { articleId: article.id }, orderBy: { chunkIndex: 'asc' } })
    let embedded = 0
    for (const chunk of dbChunks) {
      try {
        const emb = await generateEmbedding(chunk.content)
        await prisma.$executeRawUnsafe(`UPDATE article_chunks SET embedding = $1::vector WHERE id = $2`, `[${emb.join(',')}]`, chunk.id)
        embedded++
      } catch (e: any) {
        console.log(`    Embed fail chunk ${chunk.chunkIndex}: ${e.message}`)
      }
    }
    console.log(`    ${embedded}/${chunks.length} chunks embedded`)
    count++
  }
  return count
}

// --- Main ---

async function main() {
  console.log('=== ServiceNow Sync ===\n')
  console.log(`SN: ${BASE_URL} | User: ${SN_USER}\n`)

  const users = await syncUsers()
  const criteria = await syncCriteria()
  const articles = await syncArticles()

  console.log('\n=== Summary ===')
  console.log(`Users: ${users} | Criteria: ${criteria} | Articles: ${articles}`)

  const totalChunks = await prisma.articleChunk.count()
  const embeddedChunks: any[] = await prisma.$queryRawUnsafe(`SELECT count(*) as cnt FROM article_chunks WHERE embedding IS NOT NULL`)
  console.log(`DB: ${totalChunks} chunks, ${embeddedChunks[0]?.cnt} with embeddings`)
}

main()
  .catch((e) => { console.error('FAILED:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
