import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const executionId = parseInt(params.id)
    if (isNaN(executionId)) {
      return NextResponse.json(
        { error: 'Invalid execution ID' },
        { status: 400 }
      )
    }

    const logs = await prisma.agentLog.findMany({
      where: { executionId },
      orderBy: { createdAt: 'asc' },
    })

    return NextResponse.json(logs)
  } catch (error) {
    console.error('Logs API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
