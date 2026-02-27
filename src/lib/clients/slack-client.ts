export class SlackClient {
  private botToken: string
  private defaultChannel?: string
  private baseUrl = 'https://slack.com/api'

  constructor(botToken: string, defaultChannel?: string) {
    if (!botToken) throw new Error('Slack bot_token is required')
    this.botToken = botToken
    this.defaultChannel = defaultChannel
  }

  private get headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.botToken}`,
      'Content-Type': 'application/json',
    }
  }

  async sendMessage(text: string, channel?: string, blocks?: any[]) {
    channel = channel || this.defaultChannel
    if (!channel) throw new Error('Channel must be provided or set as default')

    const payload: any = { channel, text }
    if (blocks) payload.blocks = blocks

    const res = await fetch(`${this.baseUrl}/chat.postMessage`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    if (!result.ok) throw new Error(`Slack API error: ${result.error}`)
    return { ts: result.ts, channel: result.channel }
  }

  async sendApprovalRequest(params: {
    channel?: string
    title: string
    description: string
    request_id?: string
  }) {
    const channel = params.channel || this.defaultChannel
    const blocks = [
      {
        type: 'header',
        text: { type: 'plain_text', text: `Approval Required: ${params.title}` },
      },
      {
        type: 'section',
        text: { type: 'mrkdwn', text: params.description },
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Approve' },
            style: 'primary',
            value: `approve_${params.request_id || 'request'}`,
            action_id: 'approve_request',
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Reject' },
            style: 'danger',
            value: `reject_${params.request_id || 'request'}`,
            action_id: 'reject_request',
          },
        ],
      },
    ]

    return this.sendMessage(
      `Approval required: ${params.title}`,
      channel,
      blocks,
    )
  }

  async updateMessage(channel: string, messageTs: string, text: string, blocks?: any[]) {
    const payload: any = { channel, ts: messageTs, text }
    if (blocks) payload.blocks = blocks

    const res = await fetch(`${this.baseUrl}/chat.update`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify(payload),
    })
    const result = await res.json()
    if (!result.ok) throw new Error(`Slack API error: ${result.error}`)
    return { updated: true, ts: result.ts, channel: result.channel }
  }
}
