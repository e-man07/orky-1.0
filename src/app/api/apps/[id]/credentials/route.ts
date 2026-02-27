import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const credentials = await req.json()

    const app = await prisma.app.update({
      where: { id: parseInt(params.id) },
      data: { credentials: credentials as any },
    })

    return NextResponse.json({
      id: app.id,
      name: app.name,
      isConfigured: true,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
