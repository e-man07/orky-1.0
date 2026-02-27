import { prisma } from './prisma'

export interface ResolvedAccess {
  userId: number
  criteriaIds: number[]
  criteria: { id: number; name: string }[]
}

export async function resolveUserAccess(
  userEmail: string
): Promise<ResolvedAccess | null> {
  const user = await prisma.user.findUnique({
    where: { email: userEmail },
  })

  if (!user) return null

  // Get all criteria
  const allCriteria = await prisma.userCriteria.findMany()

  // Match criteria based on user's title/designation
  const matchedCriteria = allCriteria.filter((criteria) => {
    if (criteria.matchType === 'designation') {
      if (!user.title) return false
      const designations = criteria.matchValue
        .split(',')
        .map((d) => d.trim().toLowerCase())
      return designations.includes(user.title.toLowerCase())
    }
    return false
  })

  return {
    userId: user.id,
    criteriaIds: matchedCriteria.map((c) => c.id),
    criteria: matchedCriteria.map((c) => ({ id: c.id, name: c.name })),
  }
}

export async function resolveUserAccessById(
  userId: number
): Promise<ResolvedAccess | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) return null

  const allCriteria = await prisma.userCriteria.findMany()

  // Match criteria based on user's title/designation
  const matchedCriteria = allCriteria.filter((criteria) => {
    if (criteria.matchType === 'designation') {
      if (!user.title) return false
      const designations = criteria.matchValue
        .split(',')
        .map((d) => d.trim().toLowerCase())
      return designations.includes(user.title.toLowerCase())
    }
    return false
  })

  return {
    userId: user.id,
    criteriaIds: matchedCriteria.map((c) => c.id),
    criteria: matchedCriteria.map((c) => ({ id: c.id, name: c.name })),
  }
}
