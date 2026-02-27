import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const workflow = await prisma.workflow.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        agents: {
          include: {
            agent: {
              include: {
                actions: {
                  include: {
                    action: {
                      include: { app: { select: { name: true, slug: true, icon: true } } },
                    },
                  },
                },
              },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
        _count: { select: { agents: true, executions: true } },
      },
    })

    if (!workflow) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { name, description, steps, triggerRoles, status, agents } = body
    const workflowId = parseInt(params.id)

    // Update workflow fields
    await prisma.workflow.update({
      where: { id: workflowId },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(steps !== undefined && { steps }),
        ...(triggerRoles !== undefined && { triggerRoles }),
        ...(status !== undefined && { status }),
      },
    })

    // Update workflow agents if provided
    if (agents !== undefined) {
      await prisma.workflowAgent.deleteMany({ where: { workflowId } })
      if (agents.length > 0) {
        await prisma.workflowAgent.createMany({
          data: agents.map(
            (a: { agentId: number; stepOrder: number; taskPrompt?: string }) => ({
              workflowId,
              agentId: a.agentId,
              stepOrder: a.stepOrder,
              taskPrompt: a.taskPrompt,
            }),
          ),
        })
      }
    }

    const workflow = await prisma.workflow.findUnique({
      where: { id: workflowId },
      include: {
        agents: {
          include: {
            agent: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    return NextResponse.json(workflow)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.workflow.delete({ where: { id: parseInt(params.id) } })
    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
