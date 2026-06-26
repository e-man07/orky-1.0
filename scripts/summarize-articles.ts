import { PrismaClient } from '@prisma/client'
import { GoogleGenerativeAI } from '@google/generative-ai'

const prisma = new PrismaClient()
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY || '')
const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

async function summarizeArticle(title: string, body: string): Promise<string> {
  const prompt = `You are a knowledge base summarizer. Given an article title and body, extract ONLY the key points as a concise bullet-point summary. Keep it short — max 5-8 bullet points. Strip all HTML tags. Only include factual information, no filler.

Title: ${title}

Article Body:
${body.substring(0, 5000)}

Respond with ONLY the bullet-point summary, nothing else. Use "- " for each point.`

  const result = await chatModel.generateContent(prompt)
  return result.response.text().trim()
}

async function main() {
  const articles = await prisma.knowledgeArticle.findMany({ where: { isActive: true } })
  console.log(`Found ${articles.length} articles to summarize\n`)

  for (const article of articles) {
    const bodyLen = article.articleBody.length
    // Skip if already summarized (short body starting with "- ")
    if (bodyLen < 500 && article.articleBody.startsWith('- ')) {
      console.log(`[${article.number}] Already summarized (${bodyLen} chars) — SKIP`)
      continue
    }

    console.log(`[${article.number}] "${article.shortDescription}" (${bodyLen} chars)`)
    try {
      const summary = await summarizeArticle(article.shortDescription, article.articleBody)
      await prisma.knowledgeArticle.update({
        where: { id: article.id },
        data: { articleBody: summary },
      })
      console.log(`  -> Summarized: ${bodyLen} -> ${summary.length} chars`)
      console.log(`  ${summary.substring(0, 120)}...`)
    } catch (e: any) {
      console.error(`  FAILED: ${e.message}`)
    }
    console.log()
  }

  console.log('Done!')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
