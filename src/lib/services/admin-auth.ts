import bcrypt from 'bcryptjs'
import type { AdminUser } from '../db/types'
import {
  getAdminUserByEmail,
  recordFailedLogin,
  recordSuccessfulLogin,
  lockAccount,
  setPasswordWithToken,
  createBarberInvite,
  setResetToken,
} from '../db/queries/admin-users'

// Framework-free (D1) credential + lockout service for admin auth.
// FR-040 (bcrypt cost 12, 8h session — session handled in src/auth.ts),
// FR-041/042 (invite + reset set-password flows),
// FR-043 (5 failed logins / 15-min rolling window → 15-min lockout,
//          constant-time response to resist user-enumeration).
//
// The lockout decision is a PURE function (`decideLogin`) with an injected
// clock; `verifyCredentials` is the thin DB-backed wrapper. This keeps the
// state machine exhaustively unit-testable with no database.

const BCRYPT_COST = 12 // FR-040: bcrypt cost factor
const MAX_FAILED_ATTEMPTS = 5 // FR-043: lock on the 5th failure within the window
const WINDOW_MS = 15 * 60 * 1000 // FR-043: rolling 15-minute window
const LOCKOUT_MS = 15 * 60 * 1000 // FR-043: lockout duration
const RESET_TTL_MS = 2 * 60 * 60 * 1000 // FR-042: reset token valid 2h
const MIN_PASSWORD_LENGTH = 10 // FR-040: minimum admin password length

// Fixed, valid bcrypt hash (cost 12). Used as the comparison target when the
// account is missing or has no password so that bcrypt.compare ALWAYS runs —
// response time must not reveal whether an account exists (FR-043).
const DUMMY_HASH = '$2a$12$S1LTEUOL9oj18oKCcRUaqOhFbx2i3scXIwqkZEZukfDf4v2AoEtO6'

// ─── Pure lockout state machine ───────────────────────────────────────────────

export interface LoginState {
  failedLoginCount: number
  lastFailedLoginAt: Date | null
  lockedUntil: Date | null
  hasPassword: boolean
}

export type PersistAction =
  | { kind: 'none' }
  | { kind: 'reset' }
  | { kind: 'record'; failedLoginCount: number; lastFailedLoginAt: Date }
  | {
      kind: 'lock'
      failedLoginCount: number
      lastFailedLoginAt: Date
      lockedUntil: Date
    }

export interface LoginDecision {
  result: { ok: true } | { ok: false; reason: 'invalid' | 'locked' | 'no_password' }
  persist: PersistAction
}

// Pure: given the user's current lockout state, whether the password matched,
// and the current time, decide the outcome + what to persist. No I/O.
export function decideLogin(
  state: LoginState,
  passwordOk: boolean,
  now: Date,
): LoginDecision {
  // 1. Already locked → reject without consulting the password at all (FR-043).
  if (state.lockedUntil && state.lockedUntil.getTime() > now.getTime()) {
    return { result: { ok: false, reason: 'locked' }, persist: { kind: 'none' } }
  }

  // 2. Invite not completed (password_hash NULL).
  if (!state.hasPassword) {
    return { result: { ok: false, reason: 'no_password' }, persist: { kind: 'none' } }
  }

  // 3. Correct password → clear all counters.
  if (passwordOk) {
    return { result: { ok: true }, persist: { kind: 'reset' } }
  }

  // 4. Wrong password — apply the rolling 15-minute window. If the last failure
  //    is older than the window (or there is none), the count restarts at 0.
  const windowElapsed =
    state.lastFailedLoginAt === null ||
    now.getTime() - state.lastFailedLoginAt.getTime() > WINDOW_MS
  const effectiveCount = windowElapsed ? 0 : state.failedLoginCount
  const nextCount = effectiveCount + 1

  if (nextCount >= MAX_FAILED_ATTEMPTS) {
    return {
      result: { ok: false, reason: 'locked' },
      persist: {
        kind: 'lock',
        failedLoginCount: nextCount,
        lastFailedLoginAt: now,
        lockedUntil: new Date(now.getTime() + LOCKOUT_MS),
      },
    }
  }

  return {
    result: { ok: false, reason: 'invalid' },
    persist: { kind: 'record', failedLoginCount: nextCount, lastFailedLoginAt: now },
  }
}

// ─── DB-backed credential verification ────────────────────────────────────────

export async function verifyCredentials(
  email: string,
  password: string,
  now: Date,
): Promise<
  | { ok: true; user: AdminUser }
  | { ok: false; reason: 'invalid' | 'locked' | 'no_password' }
> {
  const user = await getAdminUserByEmail(email)

  // Always run a bcrypt compare — against the real hash, or the dummy when the
  // user is missing / has no password — so timing does not reveal existence.
  const target = user?.password_hash ?? DUMMY_HASH
  const passwordOk = await bcrypt.compare(password, target)

  // Unknown email: behave exactly like a wrong password, with no persistence.
  if (!user) {
    return { ok: false, reason: 'invalid' }
  }

  const state: LoginState = {
    failedLoginCount: user.failed_login_count,
    lastFailedLoginAt: user.last_failed_login_at
      ? new Date(user.last_failed_login_at)
      : null,
    lockedUntil: user.locked_until ? new Date(user.locked_until) : null,
    hasPassword: user.password_hash !== null,
  }

  const decision = decideLogin(state, passwordOk, now)

  switch (decision.persist.kind) {
    case 'reset':
      await recordSuccessfulLogin(user.id)
      break
    case 'record':
      await recordFailedLogin(
        user.id,
        decision.persist.failedLoginCount,
        decision.persist.lastFailedLoginAt,
      )
      break
    case 'lock':
      await lockAccount(
        user.id,
        decision.persist.lockedUntil,
        decision.persist.failedLoginCount,
        decision.persist.lastFailedLoginAt,
      )
      break
    case 'none':
      break
  }

  if (decision.result.ok) return { ok: true, user }
  return { ok: false, reason: decision.result.reason }
}

// ─── Password hashing & strength ──────────────────────────────────────────────

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST)
}

// Rule (FR-040): minimum length 10. No composition rules in v1 — length is the
// dominant factor in resisting brute force, and admins are few and trusted.
export function validatePasswordStrength(plain: string): boolean {
  return typeof plain === 'string' && plain.length >= MIN_PASSWORD_LENGTH
}

// ─── Set-password (invite FR-041 + reset FR-042 share this) ───────────────────

export async function completeSetPassword(
  token: string,
  plain: string,
  _now: Date, // accepted for a uniform clock-injected signature; expiry is
  // checked atomically in SQL via now() inside setPasswordWithToken.
): Promise<{ ok: true; user: AdminUser } | { ok: false; code: 'INVALID_OR_EXPIRED' | 'WEAK' }> {
  void _now
  if (!validatePasswordStrength(plain)) {
    return { ok: false, code: 'WEAK' }
  }
  const passwordHash = await hashPassword(plain)
  // Single-use + not-expired check is enforced atomically in SQL (now()).
  const user = await setPasswordWithToken({ token, passwordHash })
  if (!user) {
    return { ok: false, code: 'INVALID_OR_EXPIRED' }
  }
  return { ok: true, user }
}

// ─── Invite / reset issuance (returns the token for the email layer) ──────────

// FR-041: owner invites a barber. The token is returned so a later layer can
// build the set-password link and email it (no Resend wiring here).
export async function createInvite(opts: {
  email: string
  barberId: string
}): Promise<{ id: string; token: string }> {
  return createBarberInvite(opts)
}

// FR-042: forgot-password. Returns a success-shaped result regardless of
// whether the email exists; `token` is null for unknown emails (no enumeration)
// and the caller simply skips sending in that case.
export async function requestReset(
  email: string,
  now: Date,
): Promise<{ token: string | null }> {
  const expiresAt = new Date(now.getTime() + RESET_TTL_MS)
  const res = await setResetToken(email, expiresAt)
  return { token: res?.token ?? null }
}
