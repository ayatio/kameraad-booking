import type { Role } from '../auth/permissions'

// The privileged-mutation actor, shared across admin services. Framework-free
// (D1): `email` is the audit actor (audit_log.actor); role + barberId drive the
// own-vs-others scope checks (canActOnBarber). Built from the session in the
// route layer via adminActor() (src/lib/auth/api).
export interface AdminActor {
  role: Role
  barberId: string | null
  email: string
}
