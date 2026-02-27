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

    const execution = await prisma.execution.findUnique({
      where: { id: executionId },
      include: {
        logs: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!execution) {
      return NextResponse.json(
        { error: 'Execution not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(execution)
  } catch (error) {
    console.error('Execution detail API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
