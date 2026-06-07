import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import { verifyCredentials } from '@/lib/services/admin-auth'
import type { Role } from '@/lib/auth/permissions'

// Auth.js (NextAuth v5) config — FR-040: credentials provider over bcrypt,
// sliding 8h JWT session. RBAC role + barberId are carried in the JWT and
// exposed on session.user (typed via src/types/next-auth.d.ts).

// Dev-only fallback secret. NEVER used in production: deployments MUST set
// AUTH_SECRET (or NEXTAUTH_SECRET). Documented in .env.example.
const DEV_FALLBACK_SECRET = 'kameraad-dev-insecure-secret-do-not-use-in-prod'

const SESSION_MAX_AGE = 8 * 60 * 60 // FR-040: 8 hours

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret:
    process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET ?? DEV_FALLBACK_SECRET,
  trustHost: true,
  session: {
    strategy: 'jwt',
    // Sliding session (FR-040): NextAuth refreshes the JWT on activity and
    // re-applies maxAge, so an active admin's 8h window rolls forward.
    maxAge: SESSION_MAX_AGE,
  },
  pages: { signIn: '/admin/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        const email =
          typeof credentials?.email === 'string' ? credentials.email : ''
        const password =
          typeof credentials?.password === 'string' ? credentials.password : ''
        if (!email || !password) return null

        const result = await verifyCredentials(email, password, new Date())
        if (!result.ok) return null

        return {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          barberId: result.user.barber_id,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      // On sign-in `user` is set; persist role + barberId into the token.
      if (user) {
        token.role = user.role as Role
        token.barberId = user.barberId
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.role = token.role
        session.user.barberId = token.barberId
      }
      return session
    },
  },
})
