import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id as number
    if (!userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const executions = await prisma.execution.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    return NextResponse.json(executions)
  } catch (error) {
    console.error('Executions API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
