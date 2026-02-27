import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

async function test() {
  console.log('1. Importing prisma...')
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()

  console.log('2. Testing DB...')
  const r = await prisma.$queryRaw`SELECT 1 as ok`
  console.log('   DB OK')

  const u = process.env.SERVICENOW_USER_ID!
  const p = process.env.SERVICENOW_PASSWORD!
  const auth = Buffer.from(`${u}:${p}`).toString('base64')

  console.log('3. Fetching SN users...')
  const res = await fetch(
    'https://dev285187.service-now.com/api/now/table/sys_user?sysparm_query=company.nameLIKEMarTech%5Eactive%3Dtrue&sysparm_display_value=true&sysparm_limit=10',
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
  )
  const data = await res.json()
  console.log('   Got', data.result?.length, 'users')

  console.log('4. Upserting users to DB...')
  for (const rec of data.result) {
    if (rec.email) {
      await prisma.user.upsert({
        where: { email: rec.email },
        update: { name: rec.name || rec.user_name, title: rec.title || null },
        create: { email: rec.email, name: rec.name || rec.user_name, title: rec.title || null },
      })
      console.log('   Upserted:', rec.name)
    }
  }

  console.log('5. Fetching SN roles...')
  const rolesRes = await fetch(
    'https://dev285187.service-now.com/api/now/table/sys_user_has_role?sysparm_query=user.company.nameLIKEMarTech&sysparm_display_value=true&sysparm_limit=50',
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
  )
  const rolesData = await rolesRes.json()
  console.log('   Got', rolesData.result?.length, 'roles')

  console.log('6. Fetching SN articles...')
  const artRes = await fetch(
    'https://dev285187.service-now.com/api/now/table/kb_knowledge?sysparm_query=workflow_state%3DPublished&sysparm_display_value=true&sysparm_fields=number,short_description&sysparm_limit=50',
    { headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } }
  )
  const artData = await artRes.json()
  console.log('   Got', artData.result?.length, 'articles')
  for (const a of artData.result || []) {
    console.log('  ', a.number, a.short_description)
  }

  console.log('7. Testing Gemini embedding...')
  const { GoogleGenerativeAI, TaskType } = await import('@google/generative-ai')
  const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!)
  const model = genAI.getGenerativeModel({ model: 'gemini-embedding-001' })
  const embResult = await model.embedContent({
    content: { parts: [{ text: 'test embedding' }], role: 'user' },
    taskType: TaskType.RETRIEVAL_DOCUMENT,
  })
  console.log('   Embedding OK, dims:', embResult.embedding.values.length)

  console.log('8. Testing Gemini summarize...')
  const chatModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  const sumResult = await chatModel.generateContent('Say "hello" in one word.')
  console.log('   Gemini OK:', sumResult.response.text().trim())

  await prisma.$disconnect()
  console.log('\nALL STEPS PASSED')
}

test().catch((e) => {
  console.error('FAILED:', e.message)
  process.exit(1)
})
