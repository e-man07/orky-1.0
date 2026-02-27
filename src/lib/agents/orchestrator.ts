import { BaseAgent } from './base'
import { KnowledgeBaseAgent } from './kb-agent'
import { classifyIntent, generateChatResponse } from '../gemini'
import { prisma } from '../prisma'
import type { AgentResult } from '@/types'

export class OrchestratorAgent extends BaseAgent {
  constructor(executionId: number) {
    super('orchestrator', executionId)
  }

  async execute(
    userId: number,
    query: string,
    conversationHistory: { role: 'user' | 'model'; content: string }[] = []
  ): Promise<AgentResult> {
    try {
      // Step 1: Parse intent
      await this.updateStatus('parsing')
      await this.logAction('Parsing user intent')

      const intent = await classifyIntent(query)

      await this.logAction('Intent classified', { intent })

      // Step 2: Route to appropriate agent
      switch (intent) {
        case 'kb_query': {
          await this.logAction('Routing to Knowledge Base Agent')
          const kbAgent = new KnowledgeBaseAgent(this.executionId)
          const result = await kbAgent.execute(
            userId,
            query,
            conversationHistory
          )

          // Store result in execution
          await prisma.execution.update({
            where: { id: this.executionId },
            data: {
              conversationalResponse: result.response,
              sources: result.sources as any,
              status: result.status,
            },
          })

          return result
        }

        case 'conversational': {
          await this.updateStatus('conversational')
          await this.logAction('Handling as conversational query')

          const response = await generateChatResponse(
            'You are ORKY, a friendly AI assistant for enterprise employees. Be helpful, concise, and professional.',
            query,
            conversationHistory
          )

          await prisma.execution.update({
            where: { id: this.executionId },
            data: {
              conversationalResponse: response,
              status: 'conversational',
            },
          })

          return { response, sources: [], status: 'conversational' }
        }

        case 'workflow': {
          await this.logAction('Workflow requests not yet supported')
          const response =
            "Workflow actions are not yet supported in this version. I can help you find information from the knowledge base instead. What would you like to know?"

          await prisma.execution.update({
            where: { id: this.executionId },
            data: {
              conversationalResponse: response,
              status: 'conversational',
            },
          })

          return { response, sources: [], status: 'conversational' }
        }

        default: {
          const response =
            "I'm not sure how to handle that request. Could you try rephrasing?"
          await prisma.execution.update({
            where: { id: this.executionId },
            data: {
              conversationalResponse: response,
              status: 'failed',
            },
          })
          return { response, sources: [], status: 'failed' }
        }
      }
    } catch (error) {
      console.error('[ORCHESTRATOR ERROR]', error)
      await this.updateStatus('failed')
      await this.logAction('Error in orchestrator', {
        error: error instanceof Error ? error.message : 'Unknown error',
      })
      return {
        response:
          'An error occurred while processing your request. Please try again.',
        sources: [],
        status: 'failed',
      }
    }
  }
}
