import { prisma } from '../prisma'
import { executeWorkflowAgent } from '../agents/workflow-agent-executor'

export async function runWorkflow(executionId: number) {
  const execution = await prisma.workflowExecution.findUnique({
    where: { id: executionId },
    include: {
      workflow: {
        include: {
          agents: {
            include: {
              agent: {
                include: {
                  actions: {
                    include: {
                      action: {
                        include: { app: true },
                      },
                    },
                  },
                },
              },
            },
            orderBy: { stepOrder: 'asc' },
          },
        },
      },
    },
  })

  if (!execution) throw new Error(`Execution ${executionId} not found`)

  // Mark execution as running
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: { status: 'running', currentStep: 0 },
  })

  let variables: Record<string, any> = (execution.variables as any) || {}
  if (execution.triggerInput) {
    variables._triggerInput = execution.triggerInput
  }

  const workflowAgents = execution.workflow.agents

  for (let i = 0; i < workflowAgents.length; i++) {
    const wa = workflowAgents[i]

    // Create step execution
    const stepExec = await prisma.stepExecution.create({
      data: {
        workflowExecutionId: executionId,
        workflowAgentId: wa.id,
        stepOrder: wa.stepOrder,
        status: 'running',
        startedAt: new Date(),
      },
    })

    // Update current step
    await prisma.workflowExecution.update({
      where: { id: executionId },
      data: { currentStep: wa.stepOrder },
    })

    try {
      // Build action info from agent's actions
      const agentActions = wa.agent.actions.map((aa) => {
        const app = aa.action.app
        return {
          actionName: aa.action.name,
          appSlug: app.slug,
          appCredentials: (app.credentials as Record<string, any>) || {},
          inputSchema: (aa.action.inputSchema as Record<string, any>) || {},
        }
      })

      // Build task prompt
      const taskPrompt = wa.taskPrompt
        || execution.triggerInput
        || `Execute step ${wa.stepOrder} of the workflow.`

      // Execute the agent
      const agentResult = await executeWorkflowAgent({
        agentName: wa.agent.name,
        role: wa.agent.role || '',
        steps: wa.agent.steps || '',
        model: wa.agent.model,
        actions: agentActions,
        taskPrompt,
        variables,
      })

      if (agentResult.error) {
        // Agent returned an error
        await prisma.stepExecution.update({
          where: { id: stepExec.id },
          data: {
            status: 'failed',
            agentThinking: agentResult.thinking,
            actionsInvoked: agentResult.actionsInvoked as any,
            errorMessage: agentResult.error,
            completedAt: new Date(),
          },
        })

        // Mark entire execution as failed
        await prisma.workflowExecution.update({
          where: { id: executionId },
          data: {
            status: 'failed',
            errorMessage: `Step ${wa.stepOrder} failed: ${agentResult.error}`,
            completedAt: new Date(),
          },
        })
        return
      }

      // Step succeeded — save result
      await prisma.stepExecution.update({
        where: { id: stepExec.id },
        data: {
          status: 'completed',
          agentThinking: agentResult.thinking,
          actionsInvoked: agentResult.actionsInvoked as any,
          result: agentResult.result as any,
          completedAt: new Date(),
        },
      })

      // Merge result into shared variables for next step
      if (agentResult.result && typeof agentResult.result === 'object') {
        variables = { ...variables, [`step_${wa.stepOrder}`]: agentResult.result }
      }

      // Update execution variables
      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: { variables: variables as any },
      })
    } catch (error: any) {
      await prisma.stepExecution.update({
        where: { id: stepExec.id },
        data: {
          status: 'failed',
          errorMessage: error.message,
          completedAt: new Date(),
        },
      })

      await prisma.workflowExecution.update({
        where: { id: executionId },
        data: {
          status: 'failed',
          errorMessage: `Step ${wa.stepOrder} error: ${error.message}`,
          completedAt: new Date(),
        },
      })
      return
    }
  }

  // All steps completed
  await prisma.workflowExecution.update({
    where: { id: executionId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      variables: variables as any,
    },
  })
}
