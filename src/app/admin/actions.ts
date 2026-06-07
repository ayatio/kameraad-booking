'use server'

import { AuthError } from 'next-auth'
import { signIn, signOut } from '@/auth'
import { getAdminUserByEmail } from '@/lib/db/queries/admin-users'
import { completeSetPassword } from '@/lib/services/admin-auth'

// Server actions backing the (auth) route group — invoked directly from the
// client forms (no useFormState; the actions return plain results).

export type LoginResult = { ok: true } | { ok: false; reason: 'invalid' | 'locked' }

export async function loginAction(email: string, password: string): Promise<LoginResult> {
  try {
    // redirect:false → signIn sets the session cookie but returns control here so
    // the client can route on success and render the localized error on failure.
    await signIn('credentials', { email, password, redirect: false })
    return { ok: true }
  } catch (err) {
    if (err instanceof AuthError) {
      // authorize() returns null for invalid/locked/no_password alike (no
      // enumeration). Best-effort: surface the lockout message only when the
      // account is currently locked, so the admin knows to wait it out.
      const user = await getAdminUserByEmail(email).catch(() => null)
      const locked = user?.locked_until ? new Date(user.locked_until).getTime() > Date.now() : false
      return { ok: false, reason: locked ? 'locked' : 'invalid' }
    }
    throw err
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: '/admin/login' })
}

export type SetPasswordResult =
  | { ok: true }
  | { ok: false; code: 'INVALID_OR_EXPIRED' | 'WEAK' }

export async function setPasswordAction(
  token: string,
  password: string,
): Promise<SetPasswordResult> {
  const result = await completeSetPassword(token, password, new Date())
  if (result.ok) return { ok: true }
  return { ok: false, code: result.code }
}
