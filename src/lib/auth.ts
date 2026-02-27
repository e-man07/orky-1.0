import { getServerSession } from 'next-auth/next'
import { NextAuthOptions } from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from './prisma'

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      if (user.email) {
        try {
          // Check if user exists in our DB (synced from ServiceNow)
          const dbUser = await prisma.user.findUnique({
            where: { email: user.email },
          })
          if (!dbUser) {
            // Create a basic user record — will be enriched on ServiceNow sync
            await prisma.user.create({
              data: {
                email: user.email,
                name: user.name || user.email,
              },
            })
          }
        } catch (error) {
          console.error('Error in signIn callback:', error)
        }
      }
      return true
    },
    async session({ session, token }) {
      if (session.user?.email) {
        // Retry up to 3 times for Neon cold start
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const dbUser = await prisma.user.findUnique({
              where: { email: session.user.email },
            })
            if (dbUser) {
              ;(session.user as any).id = dbUser.id
              ;(session.user as any).location = dbUser.location
              ;(session.user as any).department = dbUser.department
              ;(session.user as any).company = dbUser.company
              ;(session.user as any).title = dbUser.title
            }
            break
          } catch (error) {
            console.error(`Session callback attempt ${attempt + 1} failed:`, error)
            if (attempt < 2) await new Promise((r) => setTimeout(r, 2000))
          }
        }
      }
      // Expose the raw JWT for FastAPI backend auth
      ;(session as any).accessToken = token.accessToken
      ;(session as any).jwtToken = token.jwtToken
      return session
    },
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        // Create a simple JWT token for FastAPI backend
        const { SignJWT } = await import('jose')
        const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET || '')
        const jwtToken = await new SignJWT({ email: token.email, sub: token.sub })
          .setProtectedHeader({ alg: 'HS256' })
          .setIssuedAt()
          .setExpirationTime('30d')
          .sign(secret)
        token.jwtToken = jwtToken
      }
      return token
    },
  },
  pages: {
    signIn: '/',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
}

export async function getSession() {
  return await getServerSession(authOptions)
}
