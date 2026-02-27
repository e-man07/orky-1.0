import { generateWithTools, generateWithToolsChat } from '../gemini'
import { executeAction } from '../actions/action-executor'
import { SchemaType, type FunctionDeclarationsTool } from '@google/generative-ai'

interface AgentActionInfo {
  actionName: string
  appSlug: string
  appCredentials: Record<string, any>
  inputSchema: Record<string, any>
}

export interface AgentExecutionResult {
  thinking: string
  actionsInvoked: { action: string; app: string; input: any; output: any }[]
  result: any
  error?: string
}

export async function executeWorkflowAgent(params: {
  agentName: string
  role: string
  steps: string
  model: string
  actions: AgentActionInfo[]
  taskPrompt: string
  variables: Record<string, any>
}): Promise<AgentExecutionResult> {
  const actionsInvoked: AgentExecutionResult['actionsInvoked'] = []

  // Build system prompt
  const systemPrompt = [
    `You are ${params.agentName}, an AI agent in an automated workflow.`,
    params.role ? `\nYour Role:\n${params.role}` : '',
    params.steps ? `\nYour Steps:\n${params.steps}` : '',
    Object.keys(params.variables).length > 0
      ? `\nContext from previous steps:\n${JSON.stringify(params.variables, null, 2)}`
      : '',
    '\nYou have access to tools/actions. Use them to accomplish your task.',
    'After completing your task, provide a clear summary of what you did and the results.',
  ]
    .filter(Boolean)
    .join('\n')

  // Convert actions to Gemini function declarations
  const functionDeclarations = params.actions.map((a) => {
    const schema = a.inputSchema || {}
    return {
      name: a.actionName,
      description: `[${a.appSlug}] ${a.actionName}`,
      parameters: {
        type: SchemaType.OBJECT,
        properties: schema.properties || {},
        required: schema.required || [],
      },
    }
  })

  const tools: FunctionDeclarationsTool[] =
    functionDeclarations.length > 0
      ? [{ functionDeclarations }]
      : []

  try {
    // First call to Gemini
    let result = await generateWithTools(
      systemPrompt,
      params.taskPrompt,
      tools,
      params.model,
    )

    let response = result.response
    let thinking = ''
    const messages: any[] = [
      { role: 'user', parts: [{ text: params.taskPrompt }] },
    ]

    // Handle function calling loop (max 5 rounds)
    for (let round = 0; round < 5; round++) {
      const candidate = response.candidates?.[0]
      if (!candidate) break

      const parts = candidate.content?.parts || []
      const functionCalls = parts.filter((p: any) => p.functionCall)

      if (functionCalls.length === 0) {
        // No more function calls — extract text response
        const textParts = parts.filter((p: any) => p.text)
        thinking = textParts.map((p: any) => p.text).join('\n')
        break
      }

      // Process each function call
      messages.push({ role: 'model', parts })

      const functionResponseParts: any[] = []

      for (const part of functionCalls) {
        const fc = part.functionCall!
        const actionName = fc.name
        const actionArgs = fc.args as Record<string, any>

        // Find matching action to get app info
        const actionInfo = params.actions.find((a) => a.actionName === actionName)
        if (!actionInfo) {
          functionResponseParts.push({
            functionResponse: {
              name: actionName,
              response: { error: `Unknown action: ${actionName}` },
            },
          })
          continue
        }

        // Execute the real action
        const actionResult = await executeAction(
          actionInfo.appSlug,
          actionName,
          actionArgs,
          actionInfo.appCredentials,
        )

        actionsInvoked.push({
          action: actionName,
          app: actionInfo.appSlug,
          input: actionArgs,
          output: actionResult.success ? actionResult.result : actionResult.error,
        })

        functionResponseParts.push({
          functionResponse: {
            name: actionName,
            response: actionResult.success
              ? { result: actionResult.result }
              : { error: actionResult.error },
          },
        })
      }

      // Send function results back to Gemini
      messages.push({ role: 'function', parts: functionResponseParts })

      result = await generateWithToolsChat(
        systemPrompt,
        messages,
        tools,
        params.model,
      )
      response = result.response
    }

    // If we never got thinking text, extract from last response
    if (!thinking) {
      thinking = response.text() || 'Agent completed without text response.'
    }

    // Gather all action outputs as the result
    const resultData =
      actionsInvoked.length > 0
        ? actionsInvoked.reduce(
            (acc, a) => {
              acc[a.action] = a.output
              return acc
            },
            {} as Record<string, any>,
          )
        : { summary: thinking }

    return { thinking, actionsInvoked, result: resultData }
  } catch (error: any) {
    return {
      thinking: '',
      actionsInvoked,
      result: null,
      error: error.message,
    }
  }
}
