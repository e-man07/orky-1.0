import * as XLSX from 'xlsx'
import fs from 'fs'
import path from 'path'
import { prisma } from '../prisma'
import { generateAndStoreEmbeddings } from '../rag/embeddings'

interface ExcelRow {
  Number: string
  'Short description': string
  'Article body': string
  Category?: string
  Workflow?: string
  'Can Read'?: string // Designation band criteria names (e.g. "Band A - Senior Leadership")
}

export async function syncFromExcel(): Promise<{
  articles: number
  chunks: number
}> {
  const filePath = path.join(process.cwd(), 'kb_knowledge.xlsx')
  console.log('Reading Excel file from:', filePath)
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet)
  console.log(`Found ${rows.length} rows in sheet "${sheetName}"`)
  console.log('Column headers:', Object.keys(rows[0] || {}))

  let articlesCreated = 0
  let totalChunks = 0

  for (const row of rows) {
    if (!row.Number || !row['Article body']) continue

    // Upsert article
    const article = await prisma.knowledgeArticle.upsert({
      where: { number: row.Number },
      update: {
        shortDescription: row['Short description'] || '',
        articleBody: row['Article body'],
        category: row.Category || null,
        workflow: row.Workflow || null,
        source: 'excel',
        isActive: true,
      },
      create: {
        number: row.Number,
        shortDescription: row['Short description'] || '',
        articleBody: row['Article body'],
        category: row.Category || null,
        workflow: row.Workflow || null,
        source: 'excel',
        isActive: true,
      },
    })

    // Link criteria based on "Can Read" column
    if (row['Can Read']) {
      // Clear existing criteria links
      await prisma.articleCriteria.deleteMany({
        where: { articleId: article.id },
      })

      // Parse "Can Read" — could be comma-separated criteria names
      const criteriaNames = row['Can Read']
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

      for (const criteriaName of criteriaNames) {
        const criteria = await prisma.userCriteria.findUnique({
          where: { name: criteriaName },
        })
        if (criteria) {
          await prisma.articleCriteria.create({
            data: {
              articleId: article.id,
              criteriaId: criteria.id,
            },
          })
        }
      }
    }

    // Generate chunks and embeddings
    console.log(`Processing article ${row.Number}: "${row['Short description']}" (body length: ${row['Article body'].length})`)
    try {
      const embeddedCount = await generateAndStoreEmbeddings(article.id)
      totalChunks += embeddedCount
      console.log(`  -> ${embeddedCount} chunks embedded for ${row.Number}`)
    } catch (error) {
      console.error(
        `Failed to generate embeddings for ${row.Number}:`,
        error instanceof Error ? error.message : error
      )
    }

    articlesCreated++
  }

  return { articles: articlesCreated, chunks: totalChunks }
}
