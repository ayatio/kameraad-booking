/**
 * admin-banner.spec.ts — PHASES box 6 (FR-062: banner edit reflected ≤60s, no redeploy).
 * Desktop-chromium only.
 *
 * The owner edits the banner; the PUBLIC force-dynamic /api/banner endpoint
 * returns the new active title at request time with NO rebuild — that endpoint
 * is the Phase-3 proof of the ≤60s/no-redeploy behaviour (the public homepage
 * that consumes it is Phase 4).
 */
import { test, expect } from '@playwright/test'
import { openDb, type Db } from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const ADMIN_PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-banner@example.com'
const PASSWORD = 'banner-passw0rd-xyz'

let db: Db

test.beforeAll(async () => {
  db = openDb()
  await seedAdmin(db, { email: OWNER_EMAIL, role: 'owner', password: PASSWORD })
})

test.afterAll(async () => {
  // Reset the banner to inactive so we don't leave a live banner behind.
  await db`UPDATE content SET is_active = false WHERE key = 'banner'`
  await cleanupAdmins(db, ADMIN_PREFIX)
  await db.end()
})

test('banner edit is reflected by the public force-dynamic API without a rebuild', async ({ page }) => {
  const title = `E2E Banner ${Date.now()}`

  await loginAs(page, OWNER_EMAIL, PASSWORD)

  // Owner edits the banner (active + a unique NL title).
  const put = await page.request.put('/api/admin/banner', {
    data: { titles: { nl: title }, texts: { nl: 'E2E melding' }, isActive: true },
  })
  expect(put.status(), 'banner PUT').toBe(200)

  // The PUBLIC endpoint (no auth, force-dynamic) returns the new active title now.
  const pub = await page.request.get('/api/banner?locale=nl')
  expect(pub.status()).toBe(200)
  const body = (await pub.json()) as { banner: { title: string | null } | null }
  expect(body.banner?.title, 'public banner reflects the edit at request time').toBe(title)

  // Deactivating it is likewise reflected immediately.
  const off = await page.request.put('/api/admin/banner', {
    data: { titles: { nl: title }, texts: { nl: 'E2E melding' }, isActive: false },
  })
  expect(off.status()).toBe(200)
  const pub2 = await page.request.get('/api/banner?locale=nl')
  const body2 = (await pub2.json()) as { banner: { title: string | null } | null }
  expect(body2.banner, 'inactive banner is not served publicly').toBeNull()
})
