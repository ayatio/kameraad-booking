/**
 * admin-auth.spec.ts — PHASES box 2 (FR-041 invite, FR-042 reset, FR-043 lockout).
 * Desktop-chromium only.
 */
import crypto from 'crypto'
import { test, expect } from '@playwright/test'
import { openDb, type Db } from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-auth@example.com'
const PASSWORD = 'auth-passw0rd-xyz'

let db: Db
let ADIL_ID: string

test.beforeAll(async () => {
  db = openDb()
  const [b] = await db<{ id: string }[]>`SELECT id FROM barbers WHERE slug = 'adil' LIMIT 1`
  ADIL_ID = b.id
  await seedAdmin(db, { email: OWNER_EMAIL, role: 'owner', password: PASSWORD })
})

test.afterAll(async () => {
  await cleanupAdmins(db, PREFIX)
  await db.end()
})

async function setPasswordViaPage(page: import('@playwright/test').Page, token: string, pw: string) {
  await page.goto(`/admin/wachtwoord/${token}`)
  await page.fill('#pw', pw)
  await page.fill('#pw2', pw)
  await page.getByRole('button', { name: 'Wachtwoord opslaan' }).click()
  // Success state renders the "Naar aanmelden" link.
  await expect(page.getByRole('link', { name: 'Naar aanmelden' })).toBeVisible({ timeout: 15_000 })
}

// ═════════════════════════════════════════════════════════════════════════════
// Invite → set-password → login (FR-041)
// ═════════════════════════════════════════════════════════════════════════════

test('invite → set-password → login', async ({ page }) => {
  const inviteEmail = `e2e-admin-invite-${Date.now()}@example.com`
  const newPw = 'invited-passw0rd-1'

  // Owner creates a barber account via the invite API.
  await loginAs(page, OWNER_EMAIL, PASSWORD)
  const res = await page.request.post('/api/admin/users', {
    data: { email: inviteEmail, barberId: ADIL_ID },
  })
  expect(res.status(), 'invite create').toBe(201)

  // Retrieve the single-use set-password token from the DB (the email is dry-run).
  const [row] = await db<{ set_password_token: string | null; password_hash: string | null }[]>`
    SELECT set_password_token, password_hash FROM admin_users WHERE email = ${inviteEmail}
  `
  expect(row.password_hash, 'invited account has no password yet').toBeNull()
  expect(row.set_password_token, 'invite token present').toBeTruthy()

  // Barber sets their password via the public set-password page.
  await setPasswordViaPage(page, row.set_password_token!, newPw)

  // Token cleared + hash set in DB.
  const [after] = await db<{ set_password_token: string | null; password_hash: string | null }[]>`
    SELECT set_password_token, password_hash FROM admin_users WHERE email = ${inviteEmail}
  `
  expect(after.set_password_token, 'token consumed').toBeNull()
  expect(after.password_hash, 'hash set').toBeTruthy()

  // Login works with the chosen password.
  await loginAs(page, inviteEmail, newPw)
  await expect(page).toHaveURL(/\/admin$/)
})

// ═════════════════════════════════════════════════════════════════════════════
// Reset flow (FR-042): fresh token → set new password → login
// ═════════════════════════════════════════════════════════════════════════════

test('reset → set new password → login', async ({ page }) => {
  const resetEmail = `e2e-admin-reset-${Date.now()}@example.com`
  await seedAdmin(db, { email: resetEmail, role: 'barber', barberSlug: 'adil', password: 'original-pw-000' })

  // Issue a reset token directly (mirrors requestReset / FR-042: 2h TTL).
  const token = crypto.randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString()
  await db`
    UPDATE admin_users
       SET set_password_token = ${token}, set_password_expires_at = ${expires}, updated_at = now()
     WHERE email = ${resetEmail}
  `

  const newPw = 'reset-passw0rd-2'
  await setPasswordViaPage(page, token, newPw)

  // Old password no longer works; new one does.
  await loginAs(page, resetEmail, newPw)
  await expect(page).toHaveURL(/\/admin$/)
})

// ═════════════════════════════════════════════════════════════════════════════
// Lockout (FR-043): 5 wrong attempts → locked; 6th correct attempt rejected
// ═════════════════════════════════════════════════════════════════════════════

test('5 failed logins lock the account; correct password then rejected', async ({ page }) => {
  const lockEmail = `e2e-admin-lock-${Date.now()}@example.com`
  const correctPw = 'correct-passw0rd-9'
  await seedAdmin(db, { email: lockEmail, role: 'barber', barberSlug: 'adil', password: correctPw })

  await page.goto('/admin/login')
  await page.fill('#email', lockEmail)
  await page.fill('#password', 'wrong-password-zzz')
  const submit = page.getByRole('button', { name: 'Aanmelden' })

  // 5 wrong attempts. Each click round-trips the credentials server action;
  // poll the DB so we know the failure was persisted before the next attempt.
  for (let attempt = 1; attempt <= 5; attempt++) {
    await submit.click()
    await expect(submit).toBeEnabled({ timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const [r] = await db<{ failed_login_count: number; locked_until: string | null }[]>`
            SELECT failed_login_count, locked_until FROM admin_users WHERE email = ${lockEmail}
          `
          // On the 5th failure the row is locked (count=5, locked_until set).
          return r.locked_until ? 5 : r.failed_login_count
        },
        { timeout: 10_000 },
      )
      .toBe(attempt)
  }

  // DB: account is now locked.
  const [locked] = await db<{ locked_until: string | null }[]>`
    SELECT locked_until FROM admin_users WHERE email = ${lockEmail}
  `
  expect(locked.locked_until, 'locked_until set after 5 failures').toBeTruthy()
  expect(new Date(locked.locked_until!).getTime()).toBeGreaterThan(Date.now())

  // 6th attempt with the CORRECT password is still rejected (locked message).
  await page.fill('#password', correctPw)
  await submit.click()
  await expect(page.getByText('Account tijdelijk vergrendeld')).toBeVisible({ timeout: 10_000 })
  // Still on the login page — not authenticated.
  await expect(page).toHaveURL(/\/admin\/login$/)

  // Clean up the lock so a retry of this test starts fresh.
  await db`
    UPDATE admin_users
       SET locked_until = NULL, failed_login_count = 0, last_failed_login_at = NULL
     WHERE email = ${lockEmail}
  `
})
