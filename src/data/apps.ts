export interface AppAction {
  name: string
  displayName: string
  description: string
  actionType: string
  inputSchema: Record<string, unknown>
}

export interface CredentialField {
  key: string
  label: string
  type?: 'text' | 'password'
  placeholder?: string
}

export interface AppDefinition {
  slug: string
  name: string
  description: string
  icon: string
  logoUrl: string
  category: string
  actions: AppAction[]
  credentialFields: CredentialField[]
  pro?: boolean
}

/** Unique key for an action: "appSlug:actionName" */
export function actionKey(appSlug: string, actionName: string) {
  return `${appSlug}:${actionName}`
}

/** Parse an action key back to { appSlug, actionName } */
export function parseActionKey(key: string) {
  const idx = key.indexOf(':')
  return { appSlug: key.slice(0, idx), actionName: key.slice(idx + 1) }
}

export const APP_CATALOG: AppDefinition[] = [
  {
    name: 'Salesforce',
    slug: 'salesforce',
    description: 'CRM platform for sales, service, and marketing automation',
    icon: 'Package',
    logoUrl: '/logos/salesforce-logo.png',
    category: 'CRM',
    credentialFields: [
      { key: 'instance_url', label: 'Instance URL', placeholder: 'https://yourorg.my.salesforce.com' },
      { key: 'access_token', label: 'Access Token', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://sap-server.example.com' },
      { key: 'username', label: 'Username', placeholder: 'SAP_USER' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'instance_url', label: 'Instance URL', placeholder: 'https://dev12345.service-now.com' },
      { key: 'username', label: 'Username', placeholder: 'admin' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
    actions: [
      { name: 'create_incident', displayName: 'Create Incident', description: 'Create a new incident ticket in ServiceNow', actionType: 'rest_api', inputSchema: { type: 'object', properties: { short_description: { type: 'string' }, description: { type: 'string' }, urgency: { type: 'string', enum: ['1', '2', '3'] }, impact: { type: 'string', enum: ['1', '2', '3'] }, category: { type: 'string' }, assignment_group: { type: 'string' } }, required: ['short_description'] } },
      { name: 'update_incident', displayName: 'Update Incident', description: 'Update fields on an existing ServiceNow incident', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' }, short_description: { type: 'string' }, state: { type: 'string' }, work_notes: { type: 'string' }, assigned_to: { type: 'string' } }, required: ['sys_id'] } },
      { name: 'close_incident', displayName: 'Close Incident', description: 'Close a ServiceNow incident with resolution notes', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' }, close_notes: { type: 'string' } }, required: ['sys_id', 'close_notes'] } },
      { name: 'get_incident', displayName: 'Get Incident', description: 'Retrieve details of a specific ServiceNow incident', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' } }, required: ['sys_id'] } },
      { name: 'search_incidents', displayName: 'Search Incidents', description: 'Search for incidents using a query filter', actionType: 'rest_api', inputSchema: { type: 'object', properties: { query: { type: 'string' }, limit: { type: 'number' } } } },
      { name: 'create_ritm', displayName: 'Create RITM', description: 'Create a new Requested Item (RITM) in ServiceNow', actionType: 'rest_api', inputSchema: { type: 'object', properties: { short_description: { type: 'string' }, description: { type: 'string' }, cat_item: { type: 'string' }, assignment_group: { type: 'string' }, urgency: { type: 'string', enum: ['1', '2', '3'] } }, required: ['short_description'] } },
      { name: 'close_ritm', displayName: 'Close RITM', description: 'Close a Requested Item (RITM) with resolution notes', actionType: 'rest_api', inputSchema: { type: 'object', properties: { sys_id: { type: 'string' }, close_notes: { type: 'string' } }, required: ['sys_id', 'close_notes'] } },
      { name: 'get_user_record', displayName: 'Get User Record', description: 'Retrieve employee record from ServiceNow to verify employment type (FTE/contractor), active status, and department', actionType: 'rest_api', inputSchema: { type: 'object', properties: { employee_email: { type: 'string' } }, required: ['employee_email'] } },
      { name: 'get_hr_profile', displayName: 'Get HR Profile', description: 'Fetch HR profile with designation, band, department, and monthly reimbursement limit for an employee', actionType: 'rest_api', inputSchema: { type: 'object', properties: { employee_email: { type: 'string' } }, required: ['employee_email'] } },
    ],
  },
  {
    name: 'AWS',
    slug: 'aws',
    description: 'Amazon Web Services cloud platform for compute, storage, and infrastructure',
    icon: 'Server',
    logoUrl: '/logos/aws.png',
    category: 'Cloud Infrastructure',
    credentialFields: [
      { key: 'access_key_id', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE' },
      { key: 'secret_access_key', label: 'Secret Access Key', type: 'password' },
      { key: 'region', label: 'Region', placeholder: 'us-east-1' },
    ],
    actions: [
      { name: 'describe_instances', displayName: 'Describe EC2 Instances', description: 'List EC2 instances with their status', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_ids: { type: 'array', items: { type: 'string' } }, filters: { type: 'object' } } } },
      { name: 'create_instance', displayName: 'Create EC2 Instance', description: 'Launch a new EC2 instance', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_type: { type: 'string' }, ami_id: { type: 'string' }, key_name: { type: 'string' } }, required: ['instance_type', 'ami_id'] } },
      { name: 'stop_instance', displayName: 'Stop EC2 Instance', description: 'Stop a running EC2 instance', actionType: 'rest_api', inputSchema: { type: 'object', properties: { instance_id: { type: 'string' } }, required: ['instance_id'] } },
      { name: 'list_s3_buckets', displayName: 'List S3 Buckets', description: 'List all S3 buckets in the account', actionType: 'rest_api', inputSchema: { type: 'object', properties: {} } },
      { name: 'put_s3_object', displayName: 'Upload to S3', description: 'Upload an object to an S3 bucket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { bucket_name: { type: 'string' }, key: { type: 'string' }, body: { type: 'string' } }, required: ['bucket_name', 'key', 'body'] } },
      { name: 'extract_invoice', displayName: 'Extract Invoice Data', description: 'Use AWS Textract AnalyzeExpense to extract structured data from an invoice (vendor name, GSTIN, invoice number, date, amounts, tax breakup, line items)', actionType: 'rest_api', inputSchema: { type: 'object', properties: { s3_bucket: { type: 'string' }, s3_key: { type: 'string' } }, required: ['s3_bucket', 's3_key'] } },
      { name: 'validate_invoice', displayName: 'Validate Invoice', description: 'Validate extracted invoice data against employee details (name match, GSTIN format, date range, tax calculations)', actionType: 'rest_api', inputSchema: { type: 'object', properties: { invoice_data: { type: 'object' }, employee_name: { type: 'string' }, expected_billing_period: { type: 'string' } }, required: ['invoice_data', 'employee_name'] } },
      { name: 'detect_document_text', displayName: 'Detect Document Text', description: 'Use AWS Textract to detect and extract raw text from a document for quality assessment', actionType: 'rest_api', inputSchema: { type: 'object', properties: { s3_bucket: { type: 'string' }, s3_key: { type: 'string' } }, required: ['s3_bucket', 's3_key'] } },
    ],
  },
  {
    name: 'Azure',
    slug: 'azure',
    description: 'Microsoft Azure cloud platform for computing, databases, and AI services',
    icon: 'Server',
    logoUrl: '/logos/azure-logo.jpg',
    category: 'Cloud Infrastructure',
    credentialFields: [
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure AD Tenant ID' },
      { key: 'client_id', label: 'Client ID', placeholder: 'App Registration Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
      { key: 'subscription_id', label: 'Subscription ID', placeholder: 'Azure Subscription ID' },
    ],
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
    logoUrl: '/logos/workday-logo.png',
    category: 'HCM',
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://wd5-impl-services1.workday.com' },
      { key: 'tenant', label: 'Tenant', placeholder: 'your_tenant' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'account', label: 'Account', placeholder: 'xy12345.us-east-1' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', type: 'password' },
      { key: 'warehouse', label: 'Warehouse', placeholder: 'COMPUTE_WH' },
      { key: 'database', label: 'Database' },
      { key: 'schema', label: 'Schema', placeholder: 'PUBLIC' },
    ],
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
    logoUrl: '/logos/microsoft-logo.png',
    category: 'Productivity',
    credentialFields: [
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure AD Tenant ID' },
      { key: 'client_id', label: 'Client ID', placeholder: 'App Registration Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'bot_token', label: 'Bot Token', placeholder: 'xoxb-...', type: 'password' },
      { key: 'default_channel', label: 'Default Channel', placeholder: '#general or C1234567890' },
    ],
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
    credentialFields: [
      { key: 'phone_number_id', label: 'Phone Number ID', placeholder: 'WhatsApp Business Phone Number ID' },
      { key: 'access_token', label: 'Access Token', type: 'password' },
    ],
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
    logoUrl: '/logos/sharepoint-logo.webp',
    category: 'Collaboration',
    credentialFields: [
      { key: 'tenant_id', label: 'Tenant ID', placeholder: 'Azure AD Tenant ID' },
      { key: 'client_id', label: 'Client ID', placeholder: 'App Registration Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
      { key: 'site_url', label: 'Site URL', placeholder: 'contoso.sharepoint.com/sites/team' },
    ],
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
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://your-domain.atlassian.net/wiki' },
      { key: 'email', label: 'Email', placeholder: 'user@company.com' },
      { key: 'api_token', label: 'API Token', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://your-domain.atlassian.net' },
      { key: 'email', label: 'Email', placeholder: 'user@company.com' },
      { key: 'api_token', label: 'API Token', type: 'password' },
    ],
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
    logoUrl: '/logos/freshworks-logo.jpeg',
    category: 'Customer Support',
    credentialFields: [
      { key: 'domain', label: 'Domain', placeholder: 'yourcompany.freshdesk.com' },
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
    actions: [
      { name: 'create_ticket', displayName: 'Create Ticket', description: 'Create a new support ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subject: { type: 'string' }, description: { type: 'string' }, email: { type: 'string' }, priority: { type: 'number' } }, required: ['subject', 'email'] } },
      { name: 'update_ticket', displayName: 'Update Ticket', description: 'Update an existing support ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'number' }, status: { type: 'number' }, priority: { type: 'number' } }, required: ['ticket_id'] } },
      { name: 'list_tickets', displayName: 'List Tickets', description: 'List support tickets with filters', actionType: 'rest_api', inputSchema: { type: 'object', properties: { filter: { type: 'string' }, page: { type: 'number' } } } },
    ],
  },
  {
    name: 'Freshservice',
    slug: 'freshservice',
    description: 'IT Service Management platform for incident, change, and asset management',
    icon: 'Headset',
    logoUrl: '/logos/freshservice.png',
    category: 'ITSM',
    credentialFields: [
      { key: 'domain', label: 'Domain', placeholder: 'yourcompany.freshservice.com' },
      { key: 'api_key', label: 'API Key', type: 'password', placeholder: 'Your Freshservice API key' },
    ],
    actions: [
      { name: 'create_ticket', displayName: 'Create Ticket', description: 'Create a new incident ticket in Freshservice', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subject: { type: 'string', description: 'Ticket subject/title' }, description: { type: 'string', description: 'HTML description of the ticket' }, email: { type: 'string', description: 'Email of the requester' }, priority: { type: 'integer', enum: [1, 2, 3, 4], description: '1=Low, 2=Medium, 3=High, 4=Urgent' }, status: { type: 'integer', enum: [2, 3, 4, 5], description: '2=Open, 3=Pending, 4=Resolved, 5=Closed' } }, required: ['subject', 'description', 'email', 'priority', 'status'] } },
      { name: 'update_ticket', displayName: 'Update Ticket', description: 'Update an existing Freshservice ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'integer', description: 'ID of the ticket to update' }, status: { type: 'integer' }, priority: { type: 'integer' }, category: { type: 'string' } }, required: ['ticket_id'] } },
      { name: 'get_ticket', displayName: 'Get Ticket', description: 'Retrieve a Freshservice ticket by ID', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'integer', description: 'ID of the ticket to retrieve' } }, required: ['ticket_id'] } },
      { name: 'list_tickets', displayName: 'List Tickets', description: 'List tickets with optional filters', actionType: 'rest_api', inputSchema: { type: 'object', properties: { filter: { type: 'string', description: 'Filter query' }, per_page: { type: 'integer' }, page: { type: 'integer' } } } },
      { name: 'close_ticket', displayName: 'Close Ticket', description: 'Close a Freshservice ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'integer', description: 'ID of the ticket to close' }, close_notes: { type: 'string', description: 'Resolution notes' } }, required: ['ticket_id'] } },
      { name: 'create_service_request', displayName: 'Create Service Request', description: 'Place a service catalog request', actionType: 'rest_api', inputSchema: { type: 'object', properties: { catalog_item_id: { type: 'integer', description: 'Service catalog item ID' }, email: { type: 'string', description: 'Email of the requester' }, quantity: { type: 'integer' }, custom_fields: { type: 'object' } }, required: ['catalog_item_id', 'email'] } },
      { name: 'add_ticket_note', displayName: 'Add Ticket Note', description: 'Add a note/comment to a ticket', actionType: 'rest_api', inputSchema: { type: 'object', properties: { ticket_id: { type: 'integer', description: 'ID of the ticket' }, body: { type: 'string', description: 'Note content (HTML supported)' }, private: { type: 'boolean', description: 'Whether the note is private' } }, required: ['ticket_id', 'body'] } },
    ],
  },
  {
    name: 'DocuSign',
    slug: 'docusign',
    description: 'Electronic signature and agreement management platform',
    icon: 'FileText',
    logoUrl: '/logos/docusign.svg',
    category: 'Document Management',
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://demo.docusign.net/restapi' },
      { key: 'account_id', label: 'Account ID', placeholder: 'DocuSign Account ID' },
      { key: 'access_token', label: 'Access Token', type: 'password' },
    ],
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
    credentialFields: [
      { key: 'base_url', label: 'Base URL', placeholder: 'https://api.adp.com' },
      { key: 'client_id', label: 'Client ID' },
      { key: 'client_secret', label: 'Client Secret', type: 'password' },
    ],
    actions: [
      { name: 'get_worker_details', displayName: 'Get Worker Details', description: 'Retrieve employee information from ADP', actionType: 'rest_api', inputSchema: { type: 'object', properties: { worker_id: { type: 'string' } }, required: ['worker_id'] } },
      { name: 'get_payroll_summary', displayName: 'Get Payroll Summary', description: 'Get payroll summary for a pay period', actionType: 'rest_api', inputSchema: { type: 'object', properties: { pay_period: { type: 'string' }, department: { type: 'string' } } } },
    ],
  },
  {
    name: 'Tinyfish',
    slug: 'tinyfish',
    description: 'AI-powered browser agent that navigates the GST portal to verify vendor GSTIN numbers and retrieve taxpayer details',
    icon: 'Search',
    logoUrl: '/logos/tinyfish-logo.svg',
    category: 'Compliance',
    credentialFields: [
      { key: 'api_key', label: 'API Key', type: 'password' },
    ],
    actions: [
      { name: 'verify_gstin', displayName: 'Verify GSTIN', description: 'Browse the GST portal to verify a GSTIN number and retrieve vendor/taxpayer details (legal name, status, registration date, state, business type)', actionType: 'rest_api', inputSchema: { type: 'object', properties: { gstin: { type: 'string' } }, required: ['gstin'] } },
      { name: 'validate_tax_breakup', displayName: 'Validate Tax Breakup', description: 'Verify that CGST/SGST/IGST amounts are correctly calculated based on applicable GST rates', actionType: 'rest_api', inputSchema: { type: 'object', properties: { subtotal: { type: 'number' }, cgst: { type: 'number' }, sgst: { type: 'number' }, igst: { type: 'number' }, total: { type: 'number' }, gst_rate: { type: 'number' } }, required: ['subtotal', 'cgst', 'sgst', 'igst', 'total', 'gst_rate'] } },
    ],
  },
  // --- Pro Apps ---
  { slug: 'google-workspace', name: 'Google Workspace', description: 'Email, calendar, docs, and collaboration suite for businesses', icon: 'Package', logoUrl: '/logos/GoogleWorkspace-logo.webp', category: 'Productivity', actions: [], credentialFields: [], pro: true },
  { slug: 'github', name: 'GitHub', description: 'Source code management and CI/CD platform for developers', icon: 'Package', logoUrl: '/logos/github-logo.jpg', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'gitlab', name: 'GitLab', description: 'Complete DevOps platform with Git repository and CI/CD pipelines', icon: 'Package', logoUrl: '/logos/gitlab-logo.webp', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'datadog', name: 'Datadog', description: 'Monitoring and observability platform for cloud and infrastructure', icon: 'Package', logoUrl: '/logos/datadog-logo.webp', category: 'Monitoring', actions: [], credentialFields: [], pro: true },
  { slug: 'pagerduty', name: 'PagerDuty', description: 'Incident response and on-call management platform', icon: 'Package', logoUrl: '/logos/PagerDuty-logo.png', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'splunk', name: 'Splunk', description: 'Data analytics platform for searching, monitoring, and investigating data', icon: 'Package', logoUrl: '/logos/splunk-logo.webp', category: 'Data & Analytics', actions: [], credentialFields: [], pro: true },
  { slug: 'terraform', name: 'Terraform', description: 'Infrastructure as code tool for provisioning and managing cloud resources', icon: 'Package', logoUrl: '/logos/terraform-logo.webp', category: 'Cloud Infrastructure', actions: [], credentialFields: [], pro: true },
  { slug: 'jenkins', name: 'Jenkins', description: 'Open-source automation server for continuous integration and delivery', icon: 'Package', logoUrl: '/logos/jenkins-logo.webp', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'circleci', name: 'CircleCI', description: 'Continuous integration and delivery platform for automated testing', icon: 'Package', logoUrl: '/logos/circleci-logo.webp', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'zendesk', name: 'Zendesk', description: 'Customer support and help desk platform for service management', icon: 'Package', logoUrl: '/logos/zendesk-logo.webp', category: 'Customer Support', actions: [], credentialFields: [], pro: true },
  { slug: 'hubspot', name: 'HubSpot', description: 'Marketing, sales, and service platform for customer relationship management', icon: 'Package', logoUrl: '/logos/hubspot-logo.webp', category: 'CRM', actions: [], credentialFields: [], pro: true },
  { slug: 'marketo', name: 'Marketo', description: 'Marketing automation platform for lead management and campaigns', icon: 'Package', logoUrl: '/logos/Marketo-Logo.webp', category: 'Marketing', actions: [], credentialFields: [], pro: true },
  { slug: 'tableau', name: 'Tableau', description: 'Business intelligence and data visualization platform', icon: 'Package', logoUrl: '/logos/tableau-logo.webp', category: 'Business Intelligence', actions: [], credentialFields: [], pro: true },
  { slug: 'power-bi', name: 'Power BI', description: 'Business analytics and reporting platform with interactive dashboards', icon: 'Package', logoUrl: '/logos/powerbi-logo.webp', category: 'Business Intelligence', actions: [], credentialFields: [], pro: true },
  { slug: 'looker', name: 'Looker', description: 'Data platform for business intelligence and embedded analytics', icon: 'Package', logoUrl: '/logos/looker-logo.png', category: 'Business Intelligence', actions: [], credentialFields: [], pro: true },
  { slug: 'mongodb', name: 'MongoDB', description: 'NoSQL database platform for storing and managing document data', icon: 'Package', logoUrl: '/logos/mongodb-logo.png', category: 'Database', actions: [], credentialFields: [], pro: true },
  { slug: 'redis', name: 'Redis', description: 'In-memory data store for caching and real-time applications', icon: 'Package', logoUrl: '/logos/redis-logo.png', category: 'Database', actions: [], credentialFields: [], pro: true },
  { slug: 'elasticsearch', name: 'Elasticsearch', description: 'Search and analytics engine for indexing and querying data', icon: 'Package', logoUrl: '/logos/elasticsearch-logo.webp', category: 'Database', actions: [], credentialFields: [], pro: true },
  { slug: 'okta', name: 'Okta', description: 'Identity and access management platform for secure user authentication', icon: 'Package', logoUrl: '/logos/okta-logo.webp', category: 'Identity & Access', actions: [], credentialFields: [], pro: true },
  { slug: 'auth0', name: 'Auth0', description: 'Authentication and authorization platform for application security', icon: 'Package', logoUrl: '/logos/Auth0-logo.jpg', category: 'Identity & Access', actions: [], credentialFields: [], pro: true },
  { slug: 'crowdstrike', name: 'CrowdStrike', description: 'Endpoint detection and response platform for cybersecurity', icon: 'Package', logoUrl: '/logos/crowdstrike-logo.webp', category: 'Security', actions: [], credentialFields: [], pro: true },
  { slug: 'sentinelone', name: 'SentinelOne', description: 'Endpoint protection and threat prevention platform', icon: 'Package', logoUrl: '/logos/sentinelone-logo.webp', category: 'Security', actions: [], credentialFields: [], pro: true },
  { slug: 'twilio', name: 'Twilio', description: 'Communications platform for SMS, voice, and video integration', icon: 'Package', logoUrl: '/logos/twilio-logo.webp', category: 'Communication', actions: [], credentialFields: [], pro: true },
  { slug: 'sendgrid', name: 'SendGrid', description: 'Email delivery and management platform for transactional messages', icon: 'Package', logoUrl: '/logos/sendgrid-logo.webp', category: 'Communication', actions: [], credentialFields: [], pro: true },
  { slug: 'stripe', name: 'Stripe', description: 'Payment processing platform for accepting online transactions', icon: 'Package', logoUrl: '', category: 'Finance', actions: [], credentialFields: [], pro: true },
  { slug: 'netsuite', name: 'NetSuite', description: 'Cloud ERP platform for managing business operations and finances', icon: 'Package', logoUrl: '', category: 'ERP', actions: [], credentialFields: [], pro: true },
  { slug: 'oracle', name: 'Oracle', description: 'Enterprise database and application software for business management', icon: 'Package', logoUrl: '', category: 'ERP', actions: [], credentialFields: [], pro: true },
  { slug: 'zoom', name: 'Zoom', description: 'Video conferencing and unified communications platform', icon: 'Package', logoUrl: '', category: 'Communication', actions: [], credentialFields: [], pro: true },
  { slug: 'webex', name: 'Webex', description: 'Enterprise video conferencing and collaboration platform', icon: 'Package', logoUrl: '', category: 'Communication', actions: [], credentialFields: [], pro: true },
  { slug: 'microsoft-teams', name: 'Microsoft Teams', description: 'Team collaboration platform with chat, calls, and file sharing', icon: 'Package', logoUrl: '/logos/microsoft-logo.png', category: 'Collaboration', actions: [], credentialFields: [], pro: true },
  { slug: 'notion', name: 'Notion', description: 'Workspace platform for notes, databases, and team collaboration', icon: 'Package', logoUrl: '', category: 'Productivity', actions: [], credentialFields: [], pro: true },
  { slug: 'asana', name: 'Asana', description: 'Project management platform for tracking work and team coordination', icon: 'Package', logoUrl: '', category: 'Project Management', actions: [], credentialFields: [], pro: true },
  { slug: 'monday-com', name: 'Monday.com', description: 'Work OS platform for managing projects and workflows', icon: 'Package', logoUrl: '', category: 'Project Management', actions: [], credentialFields: [], pro: true },
  { slug: 'trello', name: 'Trello', description: 'Visual project management platform using boards and cards', icon: 'Package', logoUrl: '', category: 'Project Management', actions: [], credentialFields: [], pro: true },
  { slug: 'bamboohr', name: 'BambooHR', description: 'Human resources management system for employee data and payroll', icon: 'Package', logoUrl: '', category: 'HCM', actions: [], credentialFields: [], pro: true },
  { slug: 'greenhouse', name: 'Greenhouse', description: 'Applicant tracking system for recruitment and hiring', icon: 'Package', logoUrl: '', category: 'HCM', actions: [], credentialFields: [], pro: true },
  { slug: 'lever', name: 'Lever', description: 'Talent acquisition platform for recruiting and hiring teams', icon: 'Package', logoUrl: '', category: 'HCM', actions: [], credentialFields: [], pro: true },
  { slug: 'coupa', name: 'Coupa', description: 'Business spend management platform for procurement and expenses', icon: 'Package', logoUrl: '', category: 'Procurement', actions: [], credentialFields: [], pro: true },
  { slug: 'ariba', name: 'Ariba', description: 'Procurement and supply chain collaboration platform', icon: 'Package', logoUrl: '', category: 'Procurement', actions: [], credentialFields: [], pro: true },
  { slug: 'new-relic', name: 'New Relic', description: 'Application performance monitoring and observability platform', icon: 'Package', logoUrl: '', category: 'Monitoring', actions: [], credentialFields: [], pro: true },
  { slug: 'grafana', name: 'Grafana', description: 'Visualization platform for metrics and observability', icon: 'Package', logoUrl: '', category: 'Monitoring', actions: [], credentialFields: [], pro: true },
  { slug: 'prometheus', name: 'Prometheus', description: 'Open-source monitoring and alerting toolkit', icon: 'Package', logoUrl: '', category: 'Monitoring', actions: [], credentialFields: [], pro: true },
  { slug: 'docker', name: 'Docker', description: 'Container platform for packaging and deploying applications', icon: 'Package', logoUrl: '', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'kubernetes', name: 'Kubernetes', description: 'Container orchestration platform for managing containerized workloads', icon: 'Package', logoUrl: '', category: 'Cloud Infrastructure', actions: [], credentialFields: [], pro: true },
  { slug: 'ansible', name: 'Ansible', description: 'Infrastructure automation platform for configuration management', icon: 'Package', logoUrl: '', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'puppet', name: 'Puppet', description: 'Infrastructure automation and configuration management tool', icon: 'Package', logoUrl: '', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'chef', name: 'Chef', description: 'Infrastructure automation platform for managing cloud resources', icon: 'Package', logoUrl: '', category: 'DevOps', actions: [], credentialFields: [], pro: true },
  { slug: 'airtable', name: 'Airtable', description: 'Low-code platform for building custom databases and workflows', icon: 'Package', logoUrl: '', category: 'Productivity', actions: [], credentialFields: [], pro: true },
  { slug: 'box', name: 'Box', description: 'Content management and file sharing platform for enterprises', icon: 'Package', logoUrl: '', category: 'Document Management', actions: [], credentialFields: [], pro: true },
  { slug: 'dropbox', name: 'Dropbox', description: 'File storage and synchronization platform for teams', icon: 'Package', logoUrl: '', category: 'Document Management', actions: [], credentialFields: [], pro: true },
  { slug: 'google-cloud', name: 'Google Cloud', description: 'Cloud computing platform providing compute, storage, and analytics services', icon: 'Package', logoUrl: '', category: 'Cloud Infrastructure', actions: [], credentialFields: [], pro: true },
  { slug: 'ibm-cloud', name: 'IBM Cloud', description: 'Cloud platform for enterprise applications and hybrid cloud solutions', icon: 'Package', logoUrl: '', category: 'Cloud Infrastructure', actions: [], credentialFields: [], pro: true },
  { slug: 'databricks', name: 'Databricks', description: 'Data and AI platform for analytics and machine learning', icon: 'Package', logoUrl: '', category: 'AI & ML', actions: [], credentialFields: [], pro: true },
  { slug: 'segment', name: 'Segment', description: 'Customer data platform for unified customer analytics', icon: 'Package', logoUrl: '', category: 'Data & Analytics', actions: [], credentialFields: [], pro: true },
  { slug: 'mulesoft', name: 'MuleSoft', description: 'Integration platform for connecting applications and APIs', icon: 'Package', logoUrl: '', category: 'Cloud Infrastructure', actions: [], credentialFields: [], pro: true },
]

/** Slugs that are fully configurable today — the rest show "Coming Soon" */
export const CONFIGURABLE_SLUGS = new Set(['servicenow', 'aws', 'snowflake', 'slack', 'sharepoint', 'tinyfish', 'freshservice'])

/** Lookup helpers */
export const APP_BY_SLUG = Object.fromEntries(APP_CATALOG.map((a) => [a.slug, a]))

export function getAction(appSlug: string, actionName: string): AppAction | undefined {
  return APP_BY_SLUG[appSlug]?.actions.find((a) => a.name === actionName)
}

export const TOTAL_ACTIONS = APP_CATALOG.reduce((sum, app) => sum + app.actions.length, 0)
