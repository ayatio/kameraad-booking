import type { DefaultSession } from 'next-auth'
import type { Role } from '@/lib/auth/permissions'

// Module augmentation so `session.user.role` / `session.user.barberId` and the
// JWT counterparts are typed throughout the app (FR-040, RBAC §6.2).

declare module 'next-auth' {
  interface Session {
    user: {
      role: Role
      barberId: string | null
    } & DefaultSession['user']
  }

  interface User {
    role: Role
    barberId: string | null
  }
}

// Auth.js v5 sources the JWT type from @auth/core/jwt (next-auth/jwt only
// re-exports it), so the augmentation must target the core module to merge.
declare module '@auth/core/jwt' {
  interface JWT {
    role: Role
    barberId: string | null
  }
}
