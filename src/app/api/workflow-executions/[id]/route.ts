import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const execution = await prisma.workflowExecution.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        workflow: { select: { name: true } },
        steps: {
          include: {
            workflowAgent: {
              include: {
                agent: {
                  select: { name: true, icon: true, color: true },
                },
              },
            },
          },
          orderBy: { stepOrder: 'asc' },
        },
      },
    })

    if (!execution) {
      return NextResponse.json({ error: 'Execution not found' }, { status: 404 })
    }

    return NextResponse.json(execution)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
