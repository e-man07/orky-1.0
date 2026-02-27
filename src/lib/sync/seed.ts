import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  console.log('Seeding database...')

  // Seed designation-based UserCriteria
  const criteria = [
    {
      name: 'Band A - Senior Leadership',
      matchType: 'designation',
      matchValue: 'Director,Senior Director,Vice President,CXO',
    },
    {
      name: 'Band B - Mid Management',
      matchType: 'designation',
      matchValue: 'Manager,Senior Manager,Lead Architect,Program Manager',
    },
    {
      name: 'Band C - Individual Contributors',
      matchType: 'designation',
      matchValue: 'Engineer,Analyst,Associate,Executive',
    },
  ]

  for (const c of criteria) {
    await prisma.userCriteria.upsert({
      where: { name: c.name },
      update: c,
      create: c,
    })
  }
  console.log(`Seeded ${criteria.length} designation criteria`)

  // Seed test users with titles
  const users = [
    {
      name: 'Rahul Jain',
      email: 'rahulkumarjain115@gmail.com',
      location: 'Australia',
      department: 'IT',
      company: 'MarTech Mate',
      title: 'Director',
      roles: ['orky fte'],
    },
    {
      name: 'Charu Gupta',
      email: 'charugupta.mr@gmail.com',
      location: 'California',
      department: 'IT',
      company: 'MarTech Mate',
      title: 'Manager',
      roles: ['orky fte'],
    },
    {
      name: 'Aman Jha',
      email: 'amann.jha1107@gmail.com',
      location: 'California',
      department: 'Development',
      company: 'MarTech Mate',
      title: 'Analyst',
      roles: ['orky fte'],
    },
    {
      name: 'Animesh Jain',
      email: 'jainani450@gmail.com',
      location: 'California',
      department: 'Development',
      company: 'MarTech Mate',
      title: 'Analyst',
      roles: ['orky fte'],
    },
    {
      name: 'Soyal Jain',
      email: 'martechmate@gmail.com',
      location: 'Australia',
      department: 'Finance',
      company: 'MarTech Mate',
      title: 'Senior Director',
      roles: ['orky fte'],
    },
  ]

  for (const u of users) {
    const { roles, ...userData } = u
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: userData,
      create: userData,
    })

    // Clear and re-create roles
    await prisma.userRole.deleteMany({ where: { userId: user.id } })
    for (const roleName of roles) {
      await prisma.userRole.create({
        data: { userId: user.id, roleName },
      })
    }
    console.log(`Seeded user: ${u.name} (${u.title}, ${u.location})`)
  }

  console.log('Seed complete!')
}

seed()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
