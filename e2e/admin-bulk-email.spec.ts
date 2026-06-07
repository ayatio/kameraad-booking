/**
 * admin-bulk-email.spec.ts — PHASES box 7 (FR-063: forced marketing opt-in).
 * Desktop-chromium only.
 *
 * A marketing bulk send must reach ONLY opted-in customers — never an opted-out
 * customer, never an email_missing one — even under the dry-run transport. The
 * exclusion is proven against email_log (one 'marketing' 'sent' row per included
 * recipient, zero for the excluded ones).
 */
import { test, expect } from '@playwright/test'
import { openDb, type Db } from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const ADMIN_PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-bulk@example.com'
const PASSWORD = 'bulk-passw0rd-xyz'
const CUST_PREFIX = 'e2e-admin-bulk-'

let db: Db
const stamp = Date.now()
const optInA = `${CUST_PREFIX}optin-a-${stamp}@example.com`
const optInB = `${CUST_PREFIX}optin-b-${stamp}@example.com`
const optOut = `${CUST_PREFIX}optout-${stamp}@example.com`
const missing = `${CUST_PREFIX}missing-${stamp}@example.com`

async function seedCustomer(email: string, marketing: boolean, emailMissing: boolean) {
  await db`
    INSERT INTO customers (first_name, last_name, email, preferred_language, marketing_opt_in, email_missing)
    VALUES ('Bulk', 'Test', ${email}, 'nl', ${marketing}, ${emailMissing})
    ON CONFLICT (email) DO UPDATE SET
      marketing_opt_in = EXCLUDED.marketing_opt_in,
      email_missing = EXCLUDED.email_missing,
      updated_at = now()
  `
}

test.beforeAll(async () => {
  db = openDb()
  await db`DELETE FROM email_log WHERE to_email LIKE ${CUST_PREFIX + '%'}`
  await db`DELETE FROM customers WHERE email LIKE ${CUST_PREFIX + '%'}`
  await seedCustomer(optInA, true, false)
  await seedCustomer(optInB, true, false)
  await seedCustomer(optOut, false, false)
  await seedCustomer(missing, true, true) // opted-in BUT no email → excluded
  await seedAdmin(db, { email: OWNER_EMAIL, role: 'owner', password: PASSWORD })
})

test.afterAll(async () => {
  await db`DELETE FROM email_log WHERE to_email LIKE ${CUST_PREFIX + '%'}`
  await db`DELETE FROM customers WHERE email LIKE ${CUST_PREFIX + '%'}`
  await cleanupAdmins(db, ADMIN_PREFIX)
  await db.end()
})

async function marketingSentCount(email: string): Promise<number> {
  const rows = await db<{ id: string }[]>`
    SELECT id FROM email_log
     WHERE to_email = ${email} AND email_type = 'marketing' AND status = 'sent'
  `
  return rows.length
}

test('marketing bulk send reaches only opted-in customers (FR-063)', async ({ page }) => {
  await loginAs(page, OWNER_EMAIL, PASSWORD)

  // "all" filter, but marketing type FORCES the opt-in exclusion.
  const res = await page.request.post('/api/admin/bulk-email', {
    data: {
      filter: 'all',
      subjectByLocale: { nl: 'E2E Onderwerp' },
      bodyByLocale: { nl: 'E2E marketingbericht' },
    },
  })
  expect(res.status(), 'bulk send').toBe(200)

  // Opted-in customers each get exactly one sent marketing row.
  expect(await marketingSentCount(optInA), 'opted-in A sent').toBe(1)
  expect(await marketingSentCount(optInB), 'opted-in B sent').toBe(1)

  // Opted-out and email_missing customers get none.
  expect(await marketingSentCount(optOut), 'opted-out excluded').toBe(0)
  expect(await marketingSentCount(missing), 'email_missing excluded').toBe(0)
})
