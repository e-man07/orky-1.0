import { prisma } from '../prisma'
import type { ExecutionStatus, AgentResult } from '@/types'

export abstract class BaseAgent {
  agentType: string
  executionId: number

  constructor(agentType: string, executionId: number) {
    this.agentType = agentType
    this.executionId = executionId
  }

  async logAction(
    action: string,
    details?: Record<string, any>
  ): Promise<void> {
    await prisma.agentLog.create({
      data: {
        executionId: this.executionId,
        agentType: this.agentType,
        action,
        details: details ?? undefined,
      },
    })
  }

  async updateStatus(status: ExecutionStatus): Promise<void> {
    await prisma.execution.update({
      where: { id: this.executionId },
      data: { status, agentType: this.agentType },
    })
  }

  abstract execute(...args: any[]): Promise<AgentResult>
}
