import { redirect } from 'next/navigation'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { assertCan, UnauthorizedError, type Permission } from './permissions'

// Server-side guards for the admin route group (built in a later delegation).
// FR-044: every admin route/action is enforced server-side; these are the
// shared entry points. UI hiding elsewhere is convenience only.

const SIGN_IN = '/admin/login'

// Returns the active admin session, or redirects to the login page when there
// is none. Use at the top of admin server components / route handlers.
export async function requireAdmin(): Promise<Session> {
  const session = await auth()
  if (!session?.user) {
    redirect(SIGN_IN)
  }
  return session
}

// Requires both a session AND the given permission for the session's role.
// Throws ForbiddenError (status 403) when the role lacks it (FR-044).
export async function requirePermission(permission: Permission): Promise<Session> {
  const session = await requireAdmin()
  assertCan(session.user.role, permission)
  return session
}

// JSON-API counterpart of `requireAdmin`. Returns the active admin session, or
// THROWS `UnauthorizedError` (status 401) when there is none — it does NOT
// redirect (a redirect is meaningless for a fetch() call). Route handlers wrap
// their body in try/catch and map via `adminErrorResponse` (src/lib/auth/api).
export async function requireAdminApi(): Promise<Session> {
  const session = await auth()
  if (!session?.user) {
    throw new UnauthorizedError()
  }
  return session
}

// `requireAdminApi` + a permission assert. Throws UnauthorizedError (401) with
// no session, or ForbiddenError (403) when the role lacks `permission`.
export async function requirePermissionApi(permission: Permission): Promise<Session> {
  const session = await requireAdminApi()
  assertCan(session.user.role, permission)
  return session
}
