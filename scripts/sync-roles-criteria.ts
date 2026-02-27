import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = process.env.SERVICENOW_BASE_URL || 'https://dev285187.service-now.com'
const SN_USER = process.env.SERVICENOW_USER_ID || 'ORKY007'
const SN_PASS = process.env.SERVICENOW_PASSWORD || 'Aman@007'
const DATE_FILTER = "sys_created_onON2026-02-24@javascript:gs.dateGenerate('2026-02-24','start')@javascript:gs.dateGenerate('2026-02-24','end')"
const ROLE_DATE_FILTER = `${DATE_FILTER}^user.${DATE_FILTER}`

async function fetchTable(table: string, query?: string): Promise<any[]> {
  const url = new URL(`${BASE_URL}/api/now/table/${table}`)
  url.searchParams.set('sysparm_display_value', 'true')
  if (query) url.searchParams.set('sysparm_query', query)

  const basicAuth = Buffer.from(`${SN_USER}:${SN_PASS}`).toString('base64')
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Basic ${basicAuth}`, Accept: 'application/json' },
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`${table} (${res.status}): ${body.substring(0, 300)}`)
  }

  const data = await res.json()
  return data.result || []
}

async function main() {
  console.log('=== Syncing sys_user_has_role ===')
  try {
    const ORKY_ROLES = ['orky fte', 'orky contractors', 'orky external']
    const roles = await fetchTable('sys_user_has_role', ROLE_DATE_FILTER)
    console.log(`Fetched ${roles.length} role records`)
    let count = 0
    for (const r of roles) {
      let userSysId = r.user?.value || r.user
      if (typeof userSysId === 'object' && userSysId?.link) {
        userSysId = userSysId.link.split('/').pop()
      }
      const roleName = r.role?.display_value || r.role
      if (!userSysId || !roleName || typeof userSysId !== 'string') continue
      // Only sync orky KB access roles
      if (!ORKY_ROLES.includes(roleName)) continue
      const user = await prisma.user.findUnique({ where: { sysId: userSysId } })
      if (user) {
        await prisma.userRole.upsert({
          where: { userId_roleName: { userId: user.id, roleName } },
          update: {},
          create: { userId: user.id, roleName },
        })
        console.log(`  ${user.name} -> ${roleName}`)
        count++
      } else {
        console.log(`  SKIP: no user with sysId ${userSysId}`)
      }
    }
    console.log(`Total roles synced: ${count}`)
  } catch (e: any) {
    console.error('Roles FAILED:', e.message)
  }

  console.log()
  console.log('=== Syncing user_criteria ===')
  try {
    const criteria = await fetchTable('user_criteria', DATE_FILTER)
    console.log(`Fetched ${criteria.length} criteria records`)
    let count = 0
    for (const r of criteria) {
      if (!r.name) continue
      let matchType = 'location'
      let matchValue = ''
      if (r.name.includes('FTE') || r.name.includes('Contractors') || r.name.includes('External')) {
        matchType = 'role'
        matchValue = r.name.toLowerCase().replace('Orky ', 'orky ')
      } else {
        matchType = 'location'
        matchValue = r.name.replace('Orky ', '')
      }
      await prisma.userCriteria.upsert({
        where: { name: r.name },
        update: { matchType, matchValue },
        create: { name: r.name, matchType, matchValue },
      })
      console.log(`  ${r.name} -> ${matchType}:${matchValue}`)
      count++
    }
    console.log(`Total criteria synced: ${count}`)
  } catch (e: any) {
    console.error('Criteria FAILED:', e.message)
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
