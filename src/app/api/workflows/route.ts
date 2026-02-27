import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const workflows = await prisma.workflow.findMany({
      where: { userId: user.id },
      include: {
        agents: {
          include: {
            agent: {
              select: { id: true, name: true, icon: true, color: true },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
        _count: { select: { agents: true, executions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(workflows)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({ where: { email: session.user.email } })
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const body = await req.json()
    const { name, description, steps, triggerRoles, status, agents } = body

    const workflow = await prisma.workflow.create({
      data: {
        userId: user.id,
        name,
        description,
        steps,
        triggerRoles: triggerRoles || [],
        status: status || 'draft',
        agents: agents?.length
          ? {
              create: agents.map(
                (a: { agentId: number; stepOrder: number; taskPrompt?: string }) => ({
                  agentId: a.agentId,
                  stepOrder: a.stepOrder,
                  taskPrompt: a.taskPrompt,
                }),
              ),
            }
          : undefined,
      },
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

    return NextResponse.json(workflow, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
