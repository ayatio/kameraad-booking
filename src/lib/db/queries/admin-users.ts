import crypto from 'crypto'
import db from '../index'
import type { AdminUser } from '../types'

// Hand-written typed queries against admin_users (postgres.js). Decision logic
// (lockout window, bcrypt) lives in src/lib/services/admin-auth.ts; this module
// is only the typed data-access boundary.

// Thrown when an invite email collides with an existing admin_user (pg 23505).
export class EmailInUseError extends Error {
  constructor(email: string) {
    super(`Email already in use: ${email}`)
    this.name = 'EmailInUseError'
  }
}

const INVITE_TTL_MS = 48 * 60 * 60 * 1000 // FR-041: invite token valid 48h

function newToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === '23505'
  )
}

export async function getAdminUserByEmail(email: string): Promise<AdminUser | null> {
  const rows = await db<AdminUser[]>`
    SELECT * FROM admin_users WHERE email = ${email} LIMIT 1
  `
  return rows[0] ?? null
}

export async function getAdminUserById(id: string): Promise<AdminUser | null> {
  const rows = await db<AdminUser[]>`
    SELECT * FROM admin_users WHERE id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export async function getAdminUserBySetPasswordToken(
  token: string,
): Promise<AdminUser | null> {
  const rows = await db<AdminUser[]>`
    SELECT * FROM admin_users WHERE set_password_token = ${token} LIMIT 1
  `
  return rows[0] ?? null
}

// Owner's admin-user management screen (FR-041, admin.users.manage).
export async function listAdminUsers(): Promise<AdminUser[]> {
  return db<AdminUser[]>`
    SELECT * FROM admin_users ORDER BY created_at ASC
  `
}

// FR-041: owner creates a barber account → row with a fresh single-use invite
// token (48h), password_hash NULL until the barber completes set-password.
export async function createBarberInvite(opts: {
  email: string
  barberId: string
}): Promise<{ id: string; token: string }> {
  const token = newToken()
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS).toISOString()
  try {
    const rows = await db<{ id: string }[]>`
      INSERT INTO admin_users (
        email, role, barber_id, password_hash,
        set_password_token, set_password_expires_at
      ) VALUES (
        ${opts.email}, 'barber', ${opts.barberId}, NULL,
        ${token}, ${expiresAt}
      )
      RETURNING id
    `
    return { id: rows[0].id, token }
  } catch (err: unknown) {
    if (isUniqueViolation(err)) throw new EmailInUseError(opts.email)
    throw err
  }
}

// Single-use, not-expired set-password. Sets the hash and clears the token +
// all lockout counters in one UPDATE. Returns null when no row matched (bad or
// expired token), so a stale link reveals nothing.
export async function setPasswordWithToken(opts: {
  token: string
  passwordHash: string
}): Promise<AdminUser | null> {
  const rows = await db<AdminUser[]>`
    UPDATE admin_users SET
      password_hash           = ${opts.passwordHash},
      set_password_token      = NULL,
      set_password_expires_at = NULL,
      failed_login_count      = 0,
      locked_until            = NULL,
      last_failed_login_at    = NULL,
      updated_at              = now()
    WHERE set_password_token = ${opts.token}
      AND set_password_expires_at > now()
    RETURNING *
  `
  return rows[0] ?? null
}

// FR-042: forgot-password issues a fresh token (expiry supplied by the caller,
// 2h per spec) for an existing user. Returns null when the email is unknown —
// the caller must respond identically either way to avoid user enumeration.
export async function setResetToken(
  email: string,
  expiresAt: Date,
): Promise<{ token: string } | null> {
  const token = newToken()
  const rows = await db<{ id: string }[]>`
    UPDATE admin_users SET
      set_password_token      = ${token},
      set_password_expires_at = ${expiresAt.toISOString()},
      updated_at              = now()
    WHERE email = ${email}
    RETURNING id
  `
  return rows[0] ? { token } : null
}

// ─── Lockout writes (FR-043) — decision logic lives in admin-auth.ts ──────────

export async function recordFailedLogin(
  id: string,
  failedLoginCount: number,
  lastFailedLoginAt: Date,
): Promise<void> {
  await db`
    UPDATE admin_users SET
      failed_login_count   = ${failedLoginCount},
      last_failed_login_at = ${lastFailedLoginAt.toISOString()},
      updated_at           = now()
    WHERE id = ${id}
  `
}

export async function recordSuccessfulLogin(id: string): Promise<void> {
  await db`
    UPDATE admin_users SET
      failed_login_count   = 0,
      locked_until         = NULL,
      last_failed_login_at = NULL,
      updated_at           = now()
    WHERE id = ${id}
  `
}

export async function lockAccount(
  id: string,
  until: Date,
  failedLoginCount: number,
  lastFailedLoginAt: Date,
): Promise<void> {
  await db`
    UPDATE admin_users SET
      failed_login_count   = ${failedLoginCount},
      last_failed_login_at = ${lastFailedLoginAt.toISOString()},
      locked_until         = ${until.toISOString()},
      updated_at           = now()
    WHERE id = ${id}
  `
}
