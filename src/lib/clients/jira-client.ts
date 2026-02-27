export class JiraClient {
  private baseUrl: string
  private authHeader: string
  private headers: Record<string, string>

  constructor(baseUrl: string, email: string, apiToken: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '')
    this.authHeader = `Basic ${Buffer.from(`${email}:${apiToken}`).toString('base64')}`
    this.headers = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: this.authHeader,
    }
  }

  private async request(method: string, path: string, body?: any, params?: Record<string, any>) {
    const url = new URL(`${this.baseUrl}${path}`)
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, String(v))
      }
    }
    const res = await fetch(url.toString(), {
      method,
      headers: this.headers,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (!res.ok && res.status !== 204) {
      const text = await res.text()
      throw new Error(`Jira API error ${res.status}: ${text}`)
    }
    if (res.status === 204) return null
    return res.json()
  }

  private toAdf(text: string) {
    return {
      type: 'doc',
      version: 1,
      content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
    }
  }

  async createIssue(params: {
    project_key: string
    issue_type: string
    summary: string
    description?: string
    priority?: string
    labels?: string[]
  }) {
    const fields: any = {
      project: { key: params.project_key },
      summary: params.summary,
      issuetype: { name: params.issue_type },
    }
    if (params.description) fields.description = this.toAdf(params.description)
    if (params.priority) fields.priority = { name: params.priority }
    if (params.labels) fields.labels = params.labels

    const result = await this.request('POST', '/rest/api/3/issue', { fields })
    return {
      key: result.key,
      id: result.id,
      url: `${this.baseUrl}/browse/${result.key}`,
    }
  }

  async updateIssue(issueKey: string, fields: Record<string, any>) {
    await this.request('PUT', `/rest/api/3/issue/${issueKey}`, { fields })
    return { updated: true, issue_key: issueKey }
  }

  async transitionIssue(issueKey: string, transitionId: string, comment?: string) {
    const body: any = { transition: { id: transitionId } }
    if (comment) {
      body.update = {
        comment: [{ add: { body: this.toAdf(comment) } }],
      }
    }
    await this.request('POST', `/rest/api/3/issue/${issueKey}/transitions`, body)
    return { transitioned: true, issue_key: issueKey }
  }

  async addComment(issueKey: string, comment: string) {
    const result = await this.request('POST', `/rest/api/3/issue/${issueKey}/comment`, {
      body: this.toAdf(comment),
    })
    return { comment_id: result.id, comment_added: true }
  }

  async searchIssues(jql: string, maxResults = 50) {
    const result = await this.request('GET', '/rest/api/3/search', undefined, {
      jql,
      maxResults,
    })
    return result.issues || []
  }
}
