import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const apps = [
  {
    name: 'Salesforce',
    slug: 'salesforce',
    description: 'CRM platform for sales, service, and marketing automation',
    icon: 'Package',
    logoUrl: '/logos/salesforce-logo.png',
    category: 'CRM',
    actions: [
      { name: 'create_lead', displayName: 'Create Lead', description: 'Create a new lead record', actionType: 'rest_api', inputSchema: { type: 'object', properties: { first_name: { type: 'string' }, last_name: { type: 'string' }, email: { type: 'string' }, company: { type: 'string' } }, required: ['last_name', 'company'] } },
      { name: 'create_case', displayName: 'Create Case', description: 'Create a new support case', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string', enum: ['High', 'Medium', 'Low'] } }, required: ['subject'] } },
      { name: 'update_opportunity', displayName: 'Update Opportunity', description: 'Update an existing opportunity', actionType: 'rest_api', inputSchema: { type: 'object', properties: { opportunity_id: { type: 'string' }, stage: { type: 'string' }, amount: { type: 'number' } }, required: ['opportunity_id'] } },
      { name: 'soql_query', displayName: 'SOQL Query', description: 'Execute a SOQL query against Salesforce', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
    ],
  },
  {
    name: 'SAP',
    slug: 'sap',
    description: 'Enterprise resource planning for finance, supply chain, and operations',
    icon: 'Package',
    logoUrl: '/logos/sap.svg',
    category: 'ERP',
    actions: [
      { name: 'create_purchase_order', displayName: 'Create Purchase Order', description: 'Create a new purchase order', actionType: 'rest_api', inputSchema: { type: 'object', properties: { vendor_id: { type: 'string' }, items: { type: 'array' }, delivery_date: { type: 'string' } }, required: ['vendor_id', 'items'] } },
      { name: 'get_material_stock', displayName: 'Get Material Stock', description: 'Check stock levels for a material', actionType: 'rest_api', inputSchema: { type: 'object', properties: { material_id: { type: 'string' }, plant: { type: 'string' } }, required: ['material_id'] } },
      { name: 'post_financial_document', displayName: 'Post Financial Document', description: 'Post a financial accounting document', actionType: 'rest_api', inputSchema: { type: 'object', properties: { company_code: { type: 'string' }, document_type: { type: 'string' }, posting_date: { type: 'string' } }, required: ['company_code', 'document_type'] } },
    ],
  },
  {
    name: 'ServiceNow',
    slug: 'servicenow',
    description: 'IT Service Management platform for incident, problem, and change management',
    icon: 'Headset',
    logoUrl: '/logos/servicenow.jpg',
    category: 'ITSM',
    actions: [
      { name: 'create_incident', displayName: 'Create Incident', description: 'Create a new incident ticket in ServiceNow', actionType: 'rest_api', inputSchema: { type: 'object', properties: { short_description: { type: 'string' }, description: { type: 'string' }, urgency: { type: 'string', enum: ['1', '2', '3'] }, impact: { type: 'string', enum: ['1', '2', '3'] }, category: { type: 'string' }, assignment_group: { type: 'string' } }, required: ['short_description'] } },
      { name: 'update_incident', displayName: 'Update Incident', description: 'Update fields on an existing ServiceNow incident', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' }, short_description: { type: 'string' }, state: { type: 'string' }, work_notes: { type: 'string' }, assigned_to: { type: 'string' } }, required: ['sys_id'] } },
      { name: 'close_incident', displayName: 'Close Incident', description: 'Close a ServiceNow incident with resolution notes', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' }, close_notes: { type: 'string' } }, required: ['sys_id', 'close_notes'] } },
      { name: 'get_incident', displayName: 'Get Incident', description: 'Retrieve details of a specific ServiceNow incident', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' } }, required: ['sys_id'] } },
      { name: 'search_incidents', displayName: 'Search Incidents', description: 'Search for incidents using a query filter', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
    ],
  },
  {
    name: 'AWS',
    slug: 'aws',
    description: 'Amazon Web Services cloud platform for compute, storage, and infrastructure',
    icon: 'Server',
    logoUrl: '/logos/aws.png',
    category: 'Cloud Infrastructure',
    actions: [
      { name: 'describe_instances', displayName: 'Describe EC2 Instances', description: 'List EC2 instances with their status', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_ids: { type: 'array', items: { type: 'string' } }, filters: { type: 'object' } } } },
      { name: 'create_instance', displayName: 'Create EC2 Instance', description: 'Launch a new EC2 instance', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_type: { type: 'string' }, ami_id: { type: 'string' }, key_name: { type: 'string' } }, required: ['instance_type', 'ami_id'] } },
      { name: 'stop_instance', displayName: 'Stop EC2 Instance', description: 'Stop a running EC2 instance', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_id: { type: 'string' } }, required: ['instance_id'] } },
      { name: 'list_s3_buckets', displayName: 'List S3 Buckets', description: 'List all S3 buckets in the account', actionType: 'rest_api', inputSchema: { type: 'object', properties: {} } },
      { name: 'put_s3_object', displayName: 'Upload to S3', description: 'Upload an object to an S3 bucket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { bucket_name: { type: 'string' }, key: { type: 'string' }, body: { type: 'string' } }, required: ['bucket_name', 'key', 'body'] } },
    ],
  },
  {
    name: 'Azure',
    slug: 'azure',
    description: 'Microsoft Azure cloud platform for computing, databases, and AI services',
    icon: 'Server',
    logoUrl: '/logos/azure-logo.jpg',
    category: 'Cloud Infrastructure',
    actions: [
      { name: 'list_vms', displayName: 'List Virtual Machines', description: 'List Azure VMs in a subscription', actionType: 'rest_api', inputSchema: { type: 'object', properties: { resource_group: { type: 'string' } } } },
      { name: 'create_vm', displayName: 'Create Virtual Machine', description: 'Create a new Azure VM', actionType: 'rest_api', inputSchema: { type: 'object', properties: { name: { type: 'string' }, size: { type: 'string' }, image: { type: 'string' }, resource_group: { type: 'string' } }, required: ['name', 'size', 'resource_group'] } },
      { name: 'run_query', displayName: 'Run Log Analytics Query', description: 'Execute a KQL query against Log Analytics', actionType: 'rest_api', inputSchema: { type: 'object', properties: { workspace_id: { type: 'string' }, query: { type: 'string' } }, required: ['workspace_id', 'query'] } },
    ],
  },
  {
    name: 'Workday',
    slug: 'workday',
    description: 'Human capital management platform for HR, payroll, and talent management',
    icon: 'Package',
    logoUrl: '/logos/workday.svg',
    category: 'HCM',
    actions: [
      { name: 'get_worker', displayName: 'Get Worker Details', description: 'Retrieve employee details from Workday', actionType: 'rest_api', inputSchema: { type: 'object', properties: { worker_id: { type: 'string' } }, required: ['worker_id'] } },
      { name: 'create_position', displayName: 'Create Position', description: 'Create a new position requisition', actionType: 'rest_api', inputSchema: { type: 'object', properties: { title: { type: 'string' }, department: { type: 'string' }, location: { type: 'string' } }, required: ['title', 'department'] } },
      { name: 'submit_time_off', displayName: 'Submit Time Off', description: 'Submit a time-off request for a worker', actionType: 'rest_api', inputSchema: { type: 'object', properties: { worker_id: { type: 'string' }, start_date: { type: 'string' }, end_date: { type: 'string' }, type: { type: 'string' } }, required: ['worker_id', 'start_date', 'end_date'] } },
    ],
  },
  {
    name: 'Snowflake',
    slug: 'snowflake',
    description: 'Cloud data warehouse for analytics and SQL queries',
    icon: 'Snowflake',
    logoUrl: '/logos/snowflake.png',
    category: 'Data & Analytics',
    actions: [
      { name: 'execute_query', displayName: 'Execute Query', description: 'Execute a SQL query against Snowflake', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' }, binds: { type: 'array', items: { type: 'string' } } }, required: ['query'] } },
      { name: 'describe_table', displayName: 'Describe Table', description: 'Get the schema/structure of a Snowflake table', actionType: 'rest_api', inputSchema: { type: 'object', properties: { table_name: { type: 'string' } }, required: ['table_name'] } },
    ],
  },
  {
    name: 'Office 365',
    slug: 'o365',
    description: 'Microsoft 365 suite for email, calendar, and productivity tools',
    icon: 'Package',
    logoUrl: '/logos/o365.svg',
    category: 'Productivity',
    actions: [
      { name: 'send_email', displayName: 'Send Email', description: 'Send an email via Outlook', actionType: 'rest_api', inputSchema: { type: 'object', properties: { to: { type: 'string' }, subject: { type: 'string' }, body: { type: 'string' } }, required: ['to', 'subject', 'body'] } },
      { name: 'create_event', displayName: 'Create Calendar Event', description: 'Create a new calendar event', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subject: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, attendees: { type: 'array', items: { type: 'string' } } }, required: ['subject', 'start', 'end'] } },
      { name: 'search_emails', displayName: 'Search Emails', description: 'Search emails using Microsoft Graph', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' }, top: { type: 'number' } }, required: ['query'] } },
    ],
  },
  {
    name: 'Slack',
    slug: 'slack',
    description: 'Team communication and messaging platform with rich notifications',
    icon: 'MessageCircle',
    logoUrl: '/logos/slack.png',
    category: 'Communication',
    actions: [
      { name: 'send_message', displayName: 'Send Message', description: 'Send a message to a Slack channel', actionType: 'rest_api', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, text: { type: 'string' } }, required: ['text'] } },
      { name: 'send_approval_request', displayName: 'Send Approval Request', description: 'Send a rich approval request with action buttons', actionType: 'rest_api', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['title', 'description'] } },
      { name: 'update_message', displayName: 'Update Message', description: 'Update an existing Slack message', actionType: 'rest_api', inputSchema: { type: 'object', properties: { channel: { type: 'string' }, message_ts: { type: 'string' }, text: { type: 'string' } }, required: ['channel', 'message_ts', 'text'] } },
    ],
  },
  {
    name: 'WhatsApp',
    slug: 'whatsapp',
    description: 'Business messaging platform for customer communication',
    icon: 'MessageCircle',
    logoUrl: '/logos/whatsapp.svg',
    category: 'Communication',
    actions: [
      { name: 'send_message', displayName: 'Send Message', description: 'Send a WhatsApp message to a user', actionType: 'rest_api', inputSchema: { type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' } }, required: ['to', 'message'] } },
      { name: 'send_template', displayName: 'Send Template Message', description: 'Send a pre-approved template message', actionType: 'rest_api', inputSchema: { type: 'object', properties: { to: { type: 'string' }, template_name: { type: 'string' }, parameters: { type: 'array', items: { type: 'string' } } }, required: ['to', 'template_name'] } },
    ],
  },
  {
    name: 'SharePoint',
    slug: 'sharepoint',
    description: 'Microsoft SharePoint for document management and collaboration',
    icon: 'FileText',
    logoUrl: '/logos/sharepoint.svg',
    category: 'Collaboration',
    actions: [
      { name: 'list_files', displayName: 'List Files', description: 'List files in a SharePoint document library', actionType: 'rest_api', inputSchema: { type: 'object', properties: { site_url: { type: 'string' }, folder_path: { type: 'string' } } } },
      { name: 'upload_file', displayName: 'Upload File', description: 'Upload a file to a SharePoint document library', actionType: 'rest_api', inputSchema: { type: 'object', properties: { site_url: { type: 'string' }, file_name: { type: 'string' }, file_content: { type: 'string' }, folder_path: { type: 'string' } }, required: ['file_name', 'file_content'] } },
      { name: 'search_files', displayName: 'Search Files', description: 'Search for files across a SharePoint site', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } }, required: ['query'] } },
    ],
  },
  {
    name: 'Confluence',
    slug: 'confluence',
    description: 'Team workspace for documentation, knowledge bases, and wiki content',
    icon: 'FileText',
    logoUrl: '/logos/confluence.svg',
    category: 'Collaboration',
    actions: [
      { name: 'create_page', displayName: 'Create Page', description: 'Create a new Confluence page', actionType: 'rest_api', inputSchema: { type: 'object', properties: { space_key: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['space_key', 'title', 'body'] } },
      { name: 'update_page', displayName: 'Update Page', description: 'Update an existing Confluence page', actionType: 'rest_api', inputSchema: { type: 'object', properties: { page_id: { type: 'string' }, title: { type: 'string' }, body: { type: 'string' } }, required: ['page_id'] } },
      { name: 'search_content', displayName: 'Search Content', description: 'Search Confluence content using CQL', actionType: 'rest_api', inputSchema: { type: 'object', properties: { cql: { type: 'string' }, limit: { type: 'number' } }, required: ['cql'] } },
    ],
  },
  {
    name: 'Jira',
    slug: 'jira',
    description: 'Project tracking and issue management for software development teams',
    icon: 'Bug',
    logoUrl: '/logos/jira.svg',
    category: 'Project Management',
    actions: [
      { name: 'create_issue', displayName: 'Create Issue', description: 'Create a new Jira issue', actionType: 'rest_api', inputSchema: { type: 'object', properties: { project_key: { type: 'string' }, issue_type: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' } }, required: ['project_key', 'issue_type', 'summary'] } },
      { name: 'update_issue', displayName: 'Update Issue', description: 'Update fields on an existing Jira issue', actionType: 'rest_api', inputSchema: { type: 'object', properties: { issue_key: { type: 'string' }, summary: { type: 'string' }, description: { type: 'string' }, priority: { type: 'string' } }, required: ['issue_key'] } },
      { name: 'transition_issue', displayName: 'Transition Issue', description: 'Move a Jira issue to a different status', actionType: 'rest_api', inputSchema: { type: 'object', properties: { issue_key: { type: 'string' }, transition_id: { type: 'string' }, comment: { type: 'string' } }, required: ['issue_key', 'transition_id'] } },
      { name: 'add_comment', displayName: 'Add Comment', description: 'Add a comment to a Jira issue', actionType: 'rest_api', inputSchema: { type: 'object', properties: { issue_key: { type: 'string' }, comment: { type: 'string' } }, required: ['issue_key', 'comment'] } },
      { name: 'search_issues', displayName: 'Search Issues', description: 'Search for issues using JQL', actionType: 'rest_api', inputSchema: { type: 'object', properties: { jql: { type: 'string' }, max_results: { type: 'number' } }, required: ['jql'] } },
    ],
  },
  {
    name: 'FreshWorks',
    slug: 'freshworks',
    description: 'Customer engagement platform for support, sales, and marketing',
    icon: 'Package',
    logoUrl: '/logos/freshworks.svg',
    category: 'Customer Support',
    actions: [
      { name: 'create_ticket', displayName: 'Create Ticket', description: 'Create a new support ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' }, email: { type: 'string' }, priority: { type: 'number' } }, required: ['subject', 'email'] } },
      { name: 'update_ticket', displayName: 'Update Ticket', description: 'Update an existing support ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'number' }, status: { type: 'number' }, priority: { type: 'number' } }, required: ['ticket_id'] } },
      { name: 'list_tickets', displayName: 'List Tickets', description: 'List support tickets with filters', actionType: 'rest_api', inputSchema: { type: 'object', properties: { filter: { type: 'string' }, page: { type: 'number' } } } },
    ],
  },
  {
    name: 'DocuSign',
    slug: 'docusign',
    description: 'Electronic signature and agreement management platform',
    icon: 'FileText',
    logoUrl: '/logos/docusign.svg',
    category: 'Document Management',
    actions: [
      { name: 'send_envelope', displayName: 'Send Envelope', description: 'Send a document for signature', actionType: 'rest_api', inputSchema: { type: 'object', properties: { document_name: { type: 'string' }, signer_email: { type: 'string' }, signer_name: { type: 'string' } }, required: ['document_name', 'signer_email', 'signer_name'] } },
      { name: 'get_envelope_status', displayName: 'Get Envelope Status', description: 'Check the status of a sent envelope', actionType: 'rest_api', inputSchema: { type: 'object', properties: { envelope_id: { type: 'string' } }, required: ['envelope_id'] } },
    ],
  },
  {
    name: 'ADP',
    slug: 'adp',
    description: 'Payroll, HR, and workforce management platform',
    icon: 'Package',
    logoUrl: '/logos/adp-logo.png',
    category: 'HCM',
    actions: [
      { name: 'get_worker_details', displayName: 'Get Worker Details', description: 'Retrieve employee information from ADP', actionType: 'rest_api', inputSchema: { type: 'object', properties: { worker_id: { type: 'string' } }, required: ['worker_id'] } },
      { name: 'get_payroll_summary', displayName: 'Get Payroll Summary', description: 'Get payroll summary for a pay period', actionType: 'rest_api', inputSchema: { type: 'object', properties: { pay_period: { type: 'string' }, department: { type: 'string' } } } },
    ],
  },
]

async function main() {
  console.log('Seeding apps and actions...')

  for (const appData of apps) {
    const { actions, ...appFields } = appData

    const app = await prisma.app.upsert({
      where: { slug: appFields.slug },
      update: {
        name: appFields.name,
        description: appFields.description,
        icon: appFields.icon,
        logoUrl: appFields.logoUrl,
        category: appFields.category,
      },
      create: appFields,
    })

    console.log(`  App: ${app.name} (id=${app.id})`)

    for (const action of actions) {
      await prisma.appAction.upsert({
        where: {
          appId_name: { appId: app.id, name: action.name },
        },
        update: {
          displayName: action.displayName,
          description: action.description,
          actionType: action.actionType,
          inputSchema: action.inputSchema as any,
        },
        create: {
          appId: app.id,
          name: action.name,
          displayName: action.displayName,
          description: action.description,
          actionType: action.actionType,
          inputSchema: action.inputSchema as any,
        },
      })
      console.log(`    Action: ${action.displayName}`)
    }
  }

  // Clean up old split AWS apps if they exist
  const oldSlugs = ['aws_ec2', 'aws_s3']
  for (const slug of oldSlugs) {
    const oldApp = await prisma.app.findUnique({ where: { slug } })
    if (oldApp) {
      await prisma.appAction.deleteMany({ where: { appId: oldApp.id } })
      await prisma.app.delete({ where: { slug } })
      console.log(`  Cleaned up old app: ${slug}`)
    }
  }

  console.log('\nSeeding complete!')
}

main()
  .catch((e) => {
    console.error('Seed error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
