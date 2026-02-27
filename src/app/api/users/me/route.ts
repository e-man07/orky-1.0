import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { resolveUserAccessById } from '@/lib/access-control'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      include: { roles: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const access = await resolveUserAccessById(user.id)

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      department: user.department,
      location: user.location,
      company: user.company,
      title: user.title,
      roles: user.roles.map((r) => r.roleName),
      criteria: access?.criteria || [],
    })
  } catch (error) {
    console.error('User API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
