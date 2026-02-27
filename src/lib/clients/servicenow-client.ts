const RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504]

export class ServiceNowClient {
  private instance: string
  private username: string
  private password: string
  private baseUrl: string

  constructor(instance: string, username: string, password: string) {
    if (!instance?.trim()) throw new Error('ServiceNow instance URL is required')
    if (!username?.trim()) throw new Error('ServiceNow username is required')
    if (!password?.trim()) throw new Error('ServiceNow password is required')

    instance = instance.trim()
    if (instance.includes('/api/')) instance = instance.split('/api/')[0]
    if (!instance.startsWith('http://') && !instance.startsWith('https://'))
      instance = `https://${instance}`
    instance = instance.replace(/\/+$/, '')

    this.instance = instance
    this.username = username.trim()
    this.password = password.trim()
    this.baseUrl = `${instance}/api/now/table`
  }

  private get headers(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`,
    }
  }

  private async request(
    method: string,
    url: string,
    options?: { json?: Record<string, any>; params?: Record<string, any> },
    maxAttempts = 3,
  ): Promise<any> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const urlObj = new URL(url)
        if (options?.params) {
          for (const [k, v] of Object.entries(options.params)) {
            urlObj.searchParams.set(k, String(v))
          }
        }
        const res = await fetch(urlObj.toString(), {
          method,
          headers: this.headers,
          body: options?.json ? JSON.stringify(options.json) : undefined,
        })
        if (RETRYABLE_STATUS_CODES.includes(res.status) && attempt < maxAttempts - 1) {
          const delay = (attempt + 1) * 2000
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        if (!res.ok) {
          const text = await res.text()
          throw new Error(`ServiceNow API error ${res.status}: ${text}`)
        }
        return res.json()
      } catch (e: any) {
        lastError = e
        if (attempt < maxAttempts - 1 && !e.message?.includes('API error')) {
          const delay = (attempt + 1) * 2000
          await new Promise((r) => setTimeout(r, delay))
          continue
        }
        throw e
      }
    }
    throw lastError
  }

  private ticketUrl(sysId: string, type = 'incident'): string {
    const table = type === 'incident' ? 'incident' : 'sc_req_item'
    return `${this.instance}/${table}.do?sys_id=${sysId}`
  }

  async createIncident(data: Record<string, any>) {
    const result = await this.request('POST', `${this.baseUrl}/incident`, { json: data })
    const record = result.result || {}
    const sysId = record.sys_id
    if (!sysId) throw new Error('No sys_id in ServiceNow response')
    return {
      sys_id: sysId,
      number: record.number || sysId,
      url: this.ticketUrl(sysId),
    }
  }

  async updateIncident(sysId: string, data: Record<string, any>) {
    await this.request('PATCH', `${this.baseUrl}/incident/${sysId}`, { json: data })
    return { updated: true, sys_id: sysId }
  }

  async closeIncident(sysId: string, closeNotes: string) {
    await this.updateIncident(sysId, {
      state: '7',
      close_code: 'Closed/Resolved by Caller',
      close_notes: closeNotes,
    })
    return { closed: true, sys_id: sysId }
  }

  async getIncident(sysId: string) {
    const result = await this.request('GET', `${this.baseUrl}/incident/${sysId}`)
    return result.result || {}
  }

  async searchIncidents(query?: string, limit = 10) {
    const params: Record<string, any> = { sysparm_limit: limit }
    if (query) params.sysparm_query = query
    const result = await this.request('GET', `${this.baseUrl}/incident`, { params })
    return result.result || []
  }
}
