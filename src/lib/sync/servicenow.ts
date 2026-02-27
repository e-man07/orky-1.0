import { prisma } from '../prisma'
import { generateAndStoreEmbeddings } from '../rag/embeddings'

function getConfig() {
  return {
    baseUrl: process.env.SERVICENOW_BASE_URL || 'https://dev285187.service-now.com',
    user: process.env.SERVICENOW_USER_ID || '',
    pass: process.env.SERVICENOW_PASSWORD || '',
  }
}

async function fetchTable(table: string, query?: string): Promise<any[]> {
  const { baseUrl, user, pass } = getConfig()
  const url = new URL(`${baseUrl}/api/now/table/${table}`)
  url.searchParams.set('sysparm_display_value', 'true')
  if (query) url.searchParams.set('sysparm_query', query)

  const basicAuth = Buffer.from(`${user}:${pass}`).toString('base64')
  const response = await fetch(url.toString(), {
    headers: {
      'Authorization': `Basic ${basicAuth}`,
      'Accept': 'application/json',
    },
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`ServiceNow API error: ${response.status} ${response.statusText} - ${body}`)
  }

  const data = await response.json()
  return data.result || []
}

async function syncUsers(): Promise<number> {
  // Fetch users from MarTech Mate company
  const records = await fetchTable('sys_user', 'company.nameLIKEMarTech^active=true')
  let count = 0

  for (const record of records) {
    if (!record.email) continue

    await prisma.user.upsert({
      where: { email: record.email },
      update: {
        sysId: record.sys_id,
        userId: record.user_name,
        name: record.name || record.user_name,
        department: record.department?.display_value || record.department || null,
        location: record.location?.display_value || record.location || null,
        gender: record.gender || null,
        company: record.company?.display_value || record.company || null,
        title: record.title || null,
        active: record.active === 'true',
      },
      create: {
        sysId: record.sys_id,
        userId: record.user_name,
        name: record.name || record.user_name,
        email: record.email,
        department: record.department?.display_value || record.department || null,
        location: record.location?.display_value || record.location || null,
        gender: record.gender || null,
        company: record.company?.display_value || record.company || null,
        title: record.title || null,
        active: record.active === 'true',
      },
    })
    count++
  }

  return count
}

async function syncCriteria(): Promise<number> {
  // Create designation-based criteria (Band A, B, C)
  const designationCriteria = [
    {
      name: 'Band A - Senior Leadership',
      matchType: 'designation',
      matchValue: 'Director,Senior Director,Vice President,CXO',
    },
    {
      name: 'Band B - Mid Management',
      matchType: 'designation',
      matchValue: 'Manager,Senior Manager,Lead Architect,Program Manager',
    },
    {
      name: 'Band C - Individual Contributors',
      matchType: 'designation',
      matchValue: 'Engineer,Analyst,Associate,Executive',
    },
  ]

  let count = 0
  for (const c of designationCriteria) {
    await prisma.userCriteria.upsert({
      where: { name: c.name },
      update: { matchType: c.matchType, matchValue: c.matchValue },
      create: c,
    })
    count++
  }

  return count
}

async function syncArticles(): Promise<number> {
  // Fetch all published KB articles
  const records = await fetchTable('kb_knowledge', 'workflow_state=Published')
  let count = 0

  for (const record of records) {
    if (!record.number) continue

    const article = await prisma.knowledgeArticle.upsert({
      where: { number: record.number },
      update: {
        shortDescription: record.short_description || '',
        articleBody: record.text || record.article_body || '',
        category: record.kb_category?.display_value || record.category || null,
        workflow: record.workflow_state || null,
        source: 'servicenow',
        isActive: true,
      },
      create: {
        number: record.number,
        shortDescription: record.short_description || '',
        articleBody: record.text || record.article_body || '',
        category: record.kb_category?.display_value || record.category || null,
        workflow: record.workflow_state || null,
        source: 'servicenow',
        isActive: true,
      },
    })

    // Sync "can_read" criteria if available
    if (record.can_read_user_criteria) {
      const criteriaNames = (record.can_read_user_criteria as string)
        .split(',')
        .map((s: string) => s.trim())
        .filter(Boolean)

      await prisma.articleCriteria.deleteMany({
        where: { articleId: article.id },
      })

      for (const name of criteriaNames) {
        const criteria = await prisma.userCriteria.findUnique({
          where: { name },
        })
        if (criteria) {
          await prisma.articleCriteria.create({
            data: { articleId: article.id, criteriaId: criteria.id },
          })
        }
      }
    }

    // Generate embeddings
    try {
      await generateAndStoreEmbeddings(article.id)
    } catch (error) {
      console.error(`Failed to embed article ${record.number}:`, error)
    }

    count++
  }

  return count
}

export async function syncServiceNow(): Promise<{
  users: number
  criteria: number
  articles: number
  total: number
}> {
  const { user, pass } = getConfig()
  if (!user || !pass) {
    throw new Error('SERVICENOW_USER_ID and SERVICENOW_PASSWORD must be configured')
  }

  const users = await syncUsers()
  const criteria = await syncCriteria()
  const articles = await syncArticles()

  return {
    users,
    criteria,
    articles,
    total: users + criteria + articles,
  }
}
