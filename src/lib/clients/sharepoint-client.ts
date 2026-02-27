export class SharePointClient {
  private tenantId: string
  private clientId: string
  private clientSecret: string
  private siteUrl?: string
  private graphBaseUrl = 'https://graph.microsoft.com/v1.0'
  private tokenUrl: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0

  constructor(tenantId: string, clientId: string, clientSecret: string, siteUrl?: string) {
    if (!tenantId || !clientId || !clientSecret) {
      throw new Error('SharePoint tenant_id, client_id, and client_secret are required')
    }
    this.tenantId = tenantId
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.siteUrl = siteUrl
    this.tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const body = new URLSearchParams({
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    })

    const res = await fetch(this.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`SharePoint auth failed ${res.status}: ${text}`)
    }

    const data = await res.json()
    this.accessToken = data.access_token
    this.tokenExpiresAt = Date.now() + (data.expires_in - 300) * 1000
    return this.accessToken!
  }

  private async headers(): Promise<Record<string, string>> {
    const token = await this.getAccessToken()
    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    }
  }

  private async getSiteId(siteUrl?: string): Promise<string> {
    const url = siteUrl || this.siteUrl
    if (!url) throw new Error('Site URL is required')

    let sitePath = url.replace(/^https?:\/\//, '')
    if (!sitePath.includes(':/') && sitePath.includes('/')) {
      const parts = sitePath.split('/', 1)
      sitePath = `${parts[0]}:/${sitePath.substring(parts[0].length + 1)}`
    }

    const res = await fetch(`${this.graphBaseUrl}/sites/${sitePath}`, {
      headers: await this.headers(),
    })
    if (!res.ok) throw new Error(`Failed to get site: ${res.status}`)
    const data = await res.json()
    return data.id
  }

  async listFiles(siteUrl?: string, folderPath?: string) {
    const siteId = await this.getSiteId(siteUrl)
    const hdrs = await this.headers()

    // Get first drive
    const drivesRes = await fetch(`${this.graphBaseUrl}/sites/${siteId}/drives`, { headers: hdrs })
    if (!drivesRes.ok) throw new Error(`Failed to get drives: ${drivesRes.status}`)
    const drivesData = await drivesRes.json()
    const driveId = drivesData.value?.[0]?.id
    if (!driveId) throw new Error('No drives found')

    let url: string
    if (folderPath) {
      url = `${this.graphBaseUrl}/sites/${siteId}/drives/${driveId}/root:/${folderPath.replace(/^\/+|\/+$/g, '')}:/children`
    } else {
      url = `${this.graphBaseUrl}/sites/${siteId}/drives/${driveId}/root/children`
    }

    const res = await fetch(url, { headers: hdrs })
    if (!res.ok) throw new Error(`Failed to list files: ${res.status}`)
    const data = await res.json()
    return (data.value || []).map((f: any) => ({
      name: f.name,
      size: f.size,
      web_url: f.webUrl,
      last_modified: f.lastModifiedDateTime,
      is_folder: !!f.folder,
    }))
  }

  async uploadFile(fileName: string, fileContent: string, siteUrl?: string, folderPath?: string) {
    const siteId = await this.getSiteId(siteUrl)
    const token = await this.getAccessToken()

    const drivesRes = await fetch(`${this.graphBaseUrl}/sites/${siteId}/drives`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    })
    const drivesData = await drivesRes.json()
    const driveId = drivesData.value?.[0]?.id
    if (!driveId) throw new Error('No drives found')

    const path = folderPath ? `${folderPath.replace(/^\/+|\/+$/g, '')}/${fileName}` : fileName
    const url = `${this.graphBaseUrl}/sites/${siteId}/drives/${driveId}/root:/${path}:/content`

    const res = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: fileContent,
    })
    if (!res.ok) throw new Error(`Failed to upload file: ${res.status}`)
    const data = await res.json()
    return { name: data.name, web_url: data.webUrl, size: data.size, uploaded: true }
  }

  async searchFiles(query: string, siteUrl?: string, limit = 25) {
    await this.getSiteId(siteUrl) // ensure we're authenticated
    const hdrs = await this.headers()

    const res = await fetch(`${this.graphBaseUrl}/search/query`, {
      method: 'POST',
      headers: hdrs,
      body: JSON.stringify({
        requests: [{
          entityTypes: ['driveItem'],
          query: { queryString: query },
          from: 0,
          size: limit,
        }],
      }),
    })
    if (!res.ok) throw new Error(`SharePoint search failed: ${res.status}`)
    const data = await res.json()
    const results: any[] = []
    if (data.value?.[0]?.hitsContainers) {
      for (const container of data.value[0].hitsContainers) {
        results.push(...(container.hits || []))
      }
    }
    return results.map((hit: any) => ({
      name: hit.resource?.name,
      web_url: hit.resource?.webUrl,
      summary: hit.summary,
    }))
  }
}
