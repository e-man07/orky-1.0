import { getClient } from '../clients/client-factory'
import { ServiceNowClient } from '../clients/servicenow-client'
import { JiraClient } from '../clients/jira-client'
import { SlackClient } from '../clients/slack-client'
import { AWSClient } from '../clients/aws-client'
import { SharePointClient } from '../clients/sharepoint-client'
import { SnowflakeClient } from '../clients/snowflake-client'

export interface ActionResult {
  success: boolean
  result: any
  error?: string
}

export async function executeAction(
  appSlug: string,
  actionName: string,
  params: Record<string, any>,
  credentials: Record<string, any>,
): Promise<ActionResult> {
  try {
    const client = getClient(appSlug, credentials)
    let result: any

    switch (appSlug) {
      case 'servicenow': {
        const sn = client as ServiceNowClient
        switch (actionName) {
          case 'create_incident':
            result = await sn.createIncident(params)
            break
          case 'update_incident':
            result = await sn.updateIncident(params.sys_id, params)
            break
          case 'close_incident':
            result = await sn.closeIncident(params.sys_id, params.close_notes)
            break
          case 'get_incident':
            result = await sn.getIncident(params.sys_id)
            break
          case 'search_incidents':
            result = await sn.searchIncidents(params.query, params.limit)
            break
          default:
            throw new Error(`Unknown ServiceNow action: ${actionName}`)
        }
        break
      }

      case 'jira': {
        const jira = client as JiraClient
        switch (actionName) {
          case 'create_issue':
            result = await jira.createIssue(params as any)
            break
          case 'update_issue':
            result = await jira.updateIssue(params.issue_key, params)
            break
          case 'transition_issue':
            result = await jira.transitionIssue(params.issue_key, params.transition_id, params.comment)
            break
          case 'add_comment':
            result = await jira.addComment(params.issue_key, params.comment)
            break
          case 'search_issues':
            result = await jira.searchIssues(params.jql, params.max_results)
            break
          default:
            throw new Error(`Unknown Jira action: ${actionName}`)
        }
        break
      }

      case 'slack': {
        const slack = client as SlackClient
        switch (actionName) {
          case 'send_message':
            result = await slack.sendMessage(params.text, params.channel)
            break
          case 'send_approval_request':
            result = await slack.sendApprovalRequest(params as any)
            break
          case 'update_message':
            result = await slack.updateMessage(params.channel, params.message_ts, params.text)
            break
          default:
            throw new Error(`Unknown Slack action: ${actionName}`)
        }
        break
      }

      case 'aws_ec2': {
        const aws = client as AWSClient
        switch (actionName) {
          case 'describe_instances':
            result = await aws.describeInstances(params.instance_ids, params.filters)
            break
          case 'create_instance':
            result = await aws.createInstance(params as any)
            break
          case 'stop_instance':
            result = await aws.stopInstance(params.instance_id)
            break
          case 'terminate_instance':
            result = await aws.terminateInstance(params.instance_id)
            break
          default:
            throw new Error(`Unknown AWS EC2 action: ${actionName}`)
        }
        break
      }

      case 'aws_s3': {
        const aws = client as AWSClient
        switch (actionName) {
          case 'list_buckets':
            result = await aws.listBuckets()
            break
          case 'create_bucket':
            result = await aws.createBucket(params.bucket_name, params.region)
            break
          case 'put_object':
            result = await aws.putObject(params.bucket_name, params.key, params.body, params.content_type)
            break
          default:
            throw new Error(`Unknown AWS S3 action: ${actionName}`)
        }
        break
      }

      case 'sharepoint': {
        const sp = client as SharePointClient
        switch (actionName) {
          case 'list_files':
            result = await sp.listFiles(params.site_url, params.folder_path)
            break
          case 'upload_file':
            result = await sp.uploadFile(params.file_name, params.file_content, params.site_url, params.folder_path)
            break
          case 'search_files':
            result = await sp.searchFiles(params.query, params.site_url, params.limit)
            break
          default:
            throw new Error(`Unknown SharePoint action: ${actionName}`)
        }
        break
      }

      case 'snowflake': {
        const sf = client as SnowflakeClient
        switch (actionName) {
          case 'execute_query':
            result = await sf.executeQuery(params.query, params.binds)
            break
          case 'describe_table':
            result = await sf.describeTable(params.table_name)
            break
          default:
            throw new Error(`Unknown Snowflake action: ${actionName}`)
        }
        break
      }

      default:
        throw new Error(`Unknown app: ${appSlug}`)
    }

    return { success: true, result }
  } catch (error: any) {
    return { success: false, result: null, error: error.message }
  }
}
