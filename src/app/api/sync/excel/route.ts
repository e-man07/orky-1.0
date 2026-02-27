import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { syncFromExcel } from '@/lib/sync/excel'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create sync job
    const syncJob = await prisma.syncJob.create({
      data: { source: 'excel', status: 'running' },
    })

    try {
      const result = await syncFromExcel()

      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: 'completed',
          itemsSynced: result.articles,
          completedAt: new Date(),
        },
      })

      return NextResponse.json({
        success: true,
        articles: result.articles,
        chunks: result.chunks,
      })
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
    console.error('Excel sync error:', error)
    return NextResponse.json(
      {
        error: 'Sync failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
