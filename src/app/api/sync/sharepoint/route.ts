import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncSharePoint } from '@/lib/sync/sharepoint'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const syncJob = await prisma.syncJob.create({
      data: { source: 'sharepoint', status: 'running' },
    })

    try {
      const result = await syncSharePoint()

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'completed',
          itemsSynced: result.total,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({ success: true, ...result })
    } catch (error) {
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'failed',
          errorMessage:
            error instanceof Error ? error.message : 'Unknown error',
          completedAt: new Date(),
        },
      })
      throw error
    }
  } catch (error) {
    console.error('SharePoint sync error:', error)
    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
