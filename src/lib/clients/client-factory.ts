import { ServiceNowClient } from './servicenow-client'
import { JiraClient } from './jira-client'
import { SlackClient } from './slack-client'
import { AWSClient } from './aws-client'
import { SharePointClient } from './sharepoint-client'
import { SnowflakeClient } from './snowflake-client'

export type AppClient =
  | ServiceNowClient
  | JiraClient
  | SlackClient
  | AWSClient
  | SharePointClient
  | SnowflakeClient

const clientCache = new Map<string, AppClient>()

export function getClient(appSlug: string, credentials: Record<string, any>): AppClient {
  const cacheKey = `${appSlug}:${JSON.stringify(credentials)}`
  const cached = clientCache.get(cacheKey)
  if (cached) return cached

  let client: AppClient

  switch (appSlug) {
    case 'servicenow':
      client = new ServiceNowClient(
        credentials.instance_url,
        credentials.username,
        credentials.password,
      )
      break

    case 'jira':
      client = new JiraClient(
        credentials.base_url,
        credentials.email,
        credentials.api_token,
      )
      break

    case 'slack':
      client = new SlackClient(
        credentials.bot_token,
        credentials.default_channel,
      )
      break

    case 'aws_ec2':
    case 'aws_s3':
      client = new AWSClient(
        credentials.access_key_id,
        credentials.secret_access_key,
        credentials.region || 'us-east-1',
      )
      break

    case 'sharepoint':
      client = new SharePointClient(
        credentials.tenant_id,
        credentials.client_id,
        credentials.client_secret,
        credentials.site_url,
      )
      break

    case 'snowflake':
      client = new SnowflakeClient({
        account: credentials.account,
        username: credentials.username,
        password: credentials.password,
        warehouse: credentials.warehouse,
        database: credentials.database,
        schema: credentials.schema,
      })
      break

    default:
      throw new Error(`Unknown app: ${appSlug}`)
  }

  clientCache.set(cacheKey, client)
  return client
}

export function clearClientCache() {
  clientCache.clear()
}
