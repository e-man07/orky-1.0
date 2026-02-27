import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        actions: {
          include: {
            action: {
              include: { app: { select: { name: true, slug: true, icon: true } } },
            },
          },
        },
        _count: { select: { actions: true, workflowAgents: true } },
      },
    })

    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    return NextResponse.json(agent)
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
    const { name, description, role, steps, model, icon, color, status, actionIds } = body

    // Update agent fields
    const agent = await prisma.agent.update({
      where: { id: parseInt(params.id) },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(role !== undefined && { role }),
        ...(steps !== undefined && { steps }),
        ...(model !== undefined && { model }),
        ...(icon !== undefined && { icon }),
        ...(color !== undefined && { color }),
        ...(status !== undefined && { status }),
      },
    })

    // Update action associations if provided
    if (actionIds !== undefined) {
      await prisma.agentAction.deleteMany({ where: { agentId: agent.id } })
      if (actionIds.length > 0) {
        await prisma.agentAction.createMany({
          data: actionIds.map((actionId: number) => ({
            agentId: agent.id,
            actionId,
          })),
        })
      }
    }

    // Return full agent with relations
    const fullAgent = await prisma.agent.findUnique({
      where: { id: agent.id },
      include: {
        actions: {
          include: {
            action: {
              include: { app: { select: { name: true, slug: true, icon: true } } },
            },
          },
        },
      },
    })

    return NextResponse.json(fullAgent)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await prisma.agent.delete({ where: { id: parseInt(params.id) } })
    return NextResponse.json({ deleted: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
