import { prisma } from '../prisma'
import { generateAndStoreEmbeddings } from '../rag/embeddings'

const TENANT_ID = process.env.SHAREPOINT_TENANT_ID || ''
const CLIENT_ID = process.env.SHAREPOINT_CLIENT_ID || ''
const CLIENT_SECRET = process.env.SHAREPOINT_CLIENT_SECRET || ''
const SITE = process.env.SHAREPOINT_SITE || 'avasopt.sharepoint.com/sites/OrkyKnowledgeBase'

async function getAccessToken(): Promise<string> {
  const tokenUrl = `https://login.microsoftonline.com/${TENANT_ID}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials',
  })

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!response.ok) {
    throw new Error(`SharePoint auth failed: ${response.status}`)
  }

  const data = await response.json()
  return data.access_token
}

async function getSiteId(token: string): Promise<string> {
  const [host, ...pathParts] = SITE.split('/')
  const sitePath = pathParts.join('/')

  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${host}:/${sitePath}`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to get site: ${response.status}`)
  }

  const data = await response.json()
  return data.id
}

async function getDocuments(
  token: string,
  siteId: string
): Promise<any[]> {
  const response = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drive/root/children`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  )

  if (!response.ok) {
    throw new Error(`Failed to list documents: ${response.status}`)
  }

  const data = await response.json()
  return data.value || []
}

async function downloadDocument(
  token: string,
  downloadUrl: string
): Promise<string> {
  const response = await fetch(downloadUrl, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`)
  }

  return response.text()
}

export async function syncSharePoint(): Promise<{
  documents: number
  total: number
}> {
  if (!TENANT_ID || !CLIENT_SECRET) {
    throw new Error('SharePoint credentials not configured')
  }

  const token = await getAccessToken()
  const siteId = await getSiteId(token)
  const documents = await getDocuments(token, siteId)

  let count = 0
  for (const doc of documents) {
    if (doc.file && doc['@microsoft.graph.downloadUrl']) {
      try {
        const content = await downloadDocument(
          token,
          doc['@microsoft.graph.downloadUrl']
        )

        const articleNumber = `SP-${doc.id.substring(0, 8)}`
        const article = await prisma.knowledgeArticle.upsert({
          where: { number: articleNumber },
          update: {
            shortDescription: doc.name,
            articleBody: content,
            source: 'sharepoint',
            isActive: true,
          },
          create: {
            number: articleNumber,
            shortDescription: doc.name,
            articleBody: content,
            source: 'sharepoint',
            isActive: true,
          },
        })

        await generateAndStoreEmbeddings(article.id)
        count++
      } catch (error) {
        console.error(`Failed to sync SharePoint doc ${doc.name}:`, error)
      }
    }
  }

  return { documents: count, total: count }
}
