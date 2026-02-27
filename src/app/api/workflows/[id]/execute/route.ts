import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { runWorkflow } from '@/lib/workflows/engine'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const workflowId = parseInt(params.id)

    // Verify workflow exists
    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: { agents: true },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    if (workflow.agents.length === 0) {
      return NextResponse.json(
        { error: 'Workflow has no agents configured' },
        { status: 400 },
      )
    }

    // Create execution record
    const execution = await prisma.workflowExecution.create({
      data: {
        workflowId,
        userId: user.id,
        status: 'pending',
        triggerInput: body.triggerInput || null,
        variables: body.variables || {},
      },
    })

    // Run workflow in background (don't await)
    runWorkflow(execution.id).catch((err) => {
      console.error(`Workflow execution ${execution.id} failed:`, err)
      prisma.workflowExecution
        .update({
          where: { id: execution.id },
          data: {
            status: 'failed',
            errorMessage: err.message,
            completedAt: new Date(),
          },
        })
        .catch(console.error)
    })

    return NextResponse.json(
      { executionId: execution.id, status: 'pending' },
      { status: 201 },
    )
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
