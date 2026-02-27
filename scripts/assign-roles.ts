import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({ include: { roles: true }, orderBy: { id: 'asc' } })
  console.log('Current users:')
  for (const u of users) {
    console.log(`  id=${u.id} ${u.name} | loc=${u.location || 'none'} | roles=[${u.roles.map(r => r.roleName).join(', ')}]`)
  }

  const assignments = [
    { email: 'rahulkumarjain115@gmail.com', role: 'orky fte' },
    { email: 'martechmate@gmail.com', role: 'orky fte' },
    { email: 'charugupta.mr@gmail.com', role: 'orky fte' },
    { email: 'jainani450@gmail.com', role: 'orky contractors' },
    { email: 'contact@martechmate.in', role: 'orky external' },
    { email: 'amann.jha1107@gmail.com', role: 'orky contractors' },
  ]

  console.log('\nAssigning roles:')
  for (const a of assignments) {
    const user = await prisma.user.findUnique({ where: { email: a.email } })
    if (!user) {
      console.log(`  SKIP: ${a.email} not found`)
      continue
    }

    await prisma.userRole.upsert({
      where: { userId_roleName: { userId: user.id, roleName: a.role } },
      update: {},
      create: { userId: user.id, roleName: a.role },
    })
    console.log(`  ${user.name} -> ${a.role}`)
  }

  console.log('\nFinal state:')
  const updated = await prisma.user.findMany({ include: { roles: true }, orderBy: { id: 'asc' } })
  for (const u of updated) {
    console.log(`  ${u.name} | ${u.location || 'no-loc'} | [${u.roles.map(r => r.roleName).join(', ')}]`)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
