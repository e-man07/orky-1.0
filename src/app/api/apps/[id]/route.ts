import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const app = await prisma.app.findUnique({
      where: { id: parseInt(params.id) },
      include: {
        actions: { orderBy: { name: 'asc' } },
      },
    })

    if (!app) {
      return NextResponse.json({ error: 'App not found' }, { status: 404 })
    }

    return NextResponse.json({
      ...app,
      isConfigured: app.credentials !== null,
      credentials: undefined,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
