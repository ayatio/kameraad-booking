/**
 * admin.ts — Phase-3 E2E admin auth helpers.
 *
 * The seeded admin_users have NULL passwords (invite flow), so for E2E we seed
 * test admins with KNOWN bcrypt passwords. Every test admin uses a distinct
 * `e2e-admin-` email prefix so cleanup never touches the seeded owner/barbers.
 */
import bcrypt from 'bcryptjs'
import { expect, type Page } from '@playwright/test'
import type { Db } from './db'

const BCRYPT_COST = 12 // FR-040: bcrypt cost 12

export interface SeedAdminOpts {
  email: string
  role: 'owner' | 'barber'
  barberSlug?: string
  password: string
}

/**
 * UPSERT an admin_users row with a known bcrypt password hash. Resolves
 * barber_id from `barberSlug` (required for barbers). Clears the invite/reset
 * token and all lockout counters so the account logs in cleanly. Idempotent.
 */
export async function seedAdmin(db: Db, opts: SeedAdminOpts): Promise<{ id: string }> {
  const hash = await bcrypt.hash(opts.password, BCRYPT_COST)

  let barberId: string | null = null
  if (opts.barberSlug) {
    const rows = await db<{ id: string }[]>`
      SELECT id FROM barbers WHERE slug = ${opts.barberSlug} LIMIT 1
    `
    if (!rows[0]) throw new Error(`seedAdmin: no barber with slug '${opts.barberSlug}'`)
    barberId = rows[0].id
  }

  const rows = await db<{ id: string }[]>`
    INSERT INTO admin_users (
      email, role, barber_id, password_hash,
      set_password_token, set_password_expires_at,
      failed_login_count, locked_until, last_failed_login_at
    ) VALUES (
      ${opts.email}, ${opts.role}, ${barberId}, ${hash},
      NULL, NULL,
      0, NULL, NULL
    )
    ON CONFLICT (email) DO UPDATE SET
      role                    = EXCLUDED.role,
      barber_id               = EXCLUDED.barber_id,
      password_hash           = EXCLUDED.password_hash,
      set_password_token      = NULL,
      set_password_expires_at = NULL,
      failed_login_count      = 0,
      locked_until            = NULL,
      last_failed_login_at    = NULL,
      updated_at              = now()
    RETURNING id
  `
  return { id: rows[0].id }
}

/**
 * Drive the /admin/login form (email + password → submit) and wait for the
 * post-login admin landing (the calendar at /admin). The Auth.js credentials
 * login sets the session cookie on success; returns once authenticated.
 */
export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  // Clear any prior session in this context — otherwise /admin/login redirects
  // straight to /admin (the login page bounces an already-authenticated admin),
  // which breaks logging in as a different user within the same test.
  await page.context().clearCookies()
  await page.goto('/admin/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.getByRole('button', { name: 'Aanmelden' }).click()
  // Lands on the agenda; the chrome's logout button proves we're authenticated.
  await page.waitForURL('**/admin', { timeout: 20_000 })
  await expect(page.getByRole('button', { name: 'Uitloggen' })).toBeVisible({ timeout: 15_000 })
}

/** Delete every TEST admin (by email prefix). NEVER pass a bare/seeded prefix. */
export async function cleanupAdmins(db: Db, prefix: string): Promise<void> {
  if (!prefix.startsWith('e2e-admin-')) {
    throw new Error(`cleanupAdmins: refusing unsafe prefix '${prefix}'`)
  }
  await db`DELETE FROM admin_users WHERE email LIKE ${prefix + '%'}`
}
