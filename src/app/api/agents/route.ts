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

    const agents = await prisma.agent.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(agents)
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
    const { name, description, role, steps, model, icon, color, status, actionIds } = body

    const agent = await prisma.agent.create({
      data: {
        userId: user.id,
        name,
        description,
        role,
        steps,
        model: model || 'gemini-2.0-flash',
        icon,
        color,
        status: status || 'active',
        actions: actionIds?.length
          ? { create: actionIds.map((actionId: number) => ({ actionId })) }
          : undefined,
      },
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

    return NextResponse.json(agent, { status: 201 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
