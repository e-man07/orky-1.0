import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const apps = await prisma.app.findMany({
      include: {
        _count: { select: { actions: true } },
      },
      orderBy: { name: 'asc' },
    })

    // Strip credentials from the response (just indicate configured or not)
    const result = apps.map((app) => ({
      ...app,
      isConfigured: app.credentials !== null,
      credentials: undefined,
    }))

    return NextResponse.json(result)
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
