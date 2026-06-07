import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { ForbiddenError, UnauthorizedError, type Role } from './permissions'

// The privileged-mutation actor, derived from the admin session. `email` is the
// audit actor (audit_log.actor); role + barberId drive the scope checks.
export interface SessionActor {
  role: Role
  barberId: string | null
  email: string
}

export function adminActor(session: Session): SessionActor {
  return {
    role: session.user.role,
    barberId: session.user.barberId,
    email: session.user.email ?? 'unknown',
  }
}

// Shared error→JSON mapper for admin API route handlers. Each handler wraps its
// body in try/catch and calls this: a thrown UnauthorizedError becomes 401, a
// ForbiddenError becomes 403 (FR-044). Anything else returns null so the caller
// can rethrow (→ Next.js 500) — we never swallow unexpected errors.
//
// Strings are NL (admin UI is NL-only in v1, FR-112).
export function adminErrorResponse(err: unknown): NextResponse | null {
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: 'unauthorized', message: 'Niet ingelogd.' }, { status: 401 })
  }
  if (err instanceof ForbiddenError) {
    return NextResponse.json({ error: 'forbidden', message: 'Geen toegang.' }, { status: 403 })
  }
  return null
}
