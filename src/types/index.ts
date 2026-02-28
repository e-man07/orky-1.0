// Execution status flow
export type ExecutionStatus =
  | 'pending'
  | 'parsing'
  | 'searching_kb'
  | 'executing_actions'
  | 'generating'
  | 'success'
  | 'failed'
  | 'conversational'
  | 'action_completed'

export type AgentType = 'orchestrator' | 'kb_agent'

export type MessageRole = 'user' | 'assistant'

export type SyncSource = 'servicenow' | 'sharepoint' | 'excel'

export type CriteriaMatchType = 'designation'

export interface SourceCitation {
  articleNumber: string
  shortDescription: string
  category: string
  similarity: number
  snippet?: string // key excerpt from the matched chunk
}

export interface AgentResult {
  response: string
  sources: SourceCitation[]
  status: ExecutionStatus
}

export interface ActionTakenData {
  app: string
  action: string
  input: Record<string, any>
  output: any
  success: boolean
  error: string | null
}

export interface FileAttachment {
  s3_bucket: string
  s3_key: string
  filename: string
}

export type WorkflowStepStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface WorkflowStepState {
  step_order: number
  agent_name: string
  agent_icon: string | null
  agent_color: string | null
  status: WorkflowStepStatus
  apps?: { slug: string; name: string }[]
  actions?: { app: string; action: string }[]
  result_summary?: string | null
  error?: string | null
}

export interface WorkflowProgressState {
  workflow_name: string
  steps: WorkflowStepState[]
  isComplete: boolean
  isPaused: boolean
}

export interface ChatMessageData {
  id: number
  role: MessageRole
  content: string
  sources?: SourceCitation[]
  actionsTaken?: ActionTakenData[]
  fileAttachment?: FileAttachment
  workflowProgress?: WorkflowProgressState
  createdAt: string
}

export interface UserProfile {
  id: number
  name: string
  email: string
  department: string | null
  location: string | null
  company: string | null
  title: string | null
  roles: string[]
  criteria: { id: number; name: string }[]
}

export interface ExecutionData {
  id: number
  userPrompt: string
  status: ExecutionStatus
  agentType: string | null
  conversationalResponse: string | null
  sources: SourceCitation[] | null
  errorMessage: string | null
  createdAt: string
  logs: AgentLogData[]
}

export interface AgentLogData {
  id: number
  agentType: string
  action: string
  details: Record<string, any> | null
  createdAt: string
}

export interface SearchResult {
  chunkId: number
  content: string
  precedingContext: string | null
  followingContext: string | null
  articleNumber: string
  shortDescription: string
  category: string
  similarity: number
}

// =============================================
// Part 2: Agentic Workflow Types
// =============================================

export interface AppData {
  id: number
  name: string
  slug: string
  description: string | null
  icon: string | null
  logoUrl: string | null
  category: string | null
  credentials: Record<string, any> | null
  createdAt: string
  actions: AppActionData[]
  _count?: { actions: number }
}

export interface AppActionData {
  id: number
  appId: number
  name: string
  displayName: string
  description: string | null
  actionType: string
  inputSchema: Record<string, any> | null
  isEnabled: boolean
  app?: { name: string; slug: string; icon: string | null }
}

export interface AgentData {
  id: number
  userId: number
  name: string
  description: string | null
  role: string | null
  steps: string | null
  model: string
  icon: string | null
  color: string | null
  status: string
  createdAt: string
  updatedAt: string
  actions: { actionId: number; action: AppActionData }[]
  _count?: { actions: number; workflowAgents: number }
}

export interface WorkflowData {
  id: number
  userId: number
  name: string
  description: string | null
  steps: string | null
  triggerRoles: string[]
  status: string
  createdAt: string
  updatedAt: string
  agents: WorkflowAgentData[]
  _count?: { agents: number; executions: number }
}

export interface WorkflowAgentData {
  id: number
  workflowId: number
  agentId: number
  stepOrder: number
  taskPrompt: string | null
  agent: AgentData
}

export interface WorkflowExecutionData {
  id: number
  workflowId: number
  userId: number
  status: string
  currentStep: number | null
  variables: Record<string, any> | null
  triggerInput: string | null
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  workflow: { name: string }
  steps: StepExecutionData[]
}

export interface StepExecutionData {
  id: number
  workflowExecutionId: number
  workflowAgentId: number
  stepOrder: number
  status: string
  agentThinking: string | null
  actionsInvoked: { action: string; input: any; output: any }[] | null
  result: any
  errorMessage: string | null
  startedAt: string | null
  completedAt: string | null
  workflowAgent: { agent: { name: string; icon: string | null; color: string | null } }
}
