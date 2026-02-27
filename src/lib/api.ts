import { getSession } from 'next-auth/react'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

let cachedToken: string | null = null
let tokenFetchedAt = 0
const TOKEN_TTL = 5 * 60 * 1000 // cache token for 5 minutes

async function getToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && now - tokenFetchedAt < TOKEN_TTL) {
    return cachedToken
  }
  const session = await getSession()
  cachedToken = (session as any)?.jwtToken || (session as any)?.accessToken || null
  tokenFetchedAt = now
  return cachedToken
}

export async function apiFetch(path: string, options?: RequestInit) {
  const token = await getToken()

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  })

  return res
}

export async function apiFetchJson<T = any>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await apiFetch(path, options)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(error.error || `API error: ${res.status}`)
  }
  return res.json()
}
