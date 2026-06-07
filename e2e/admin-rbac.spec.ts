/**
 * admin-rbac.spec.ts — PHASES box 1 (FR-044 RBAC).
 * Desktop-chromium only (the mobile project's testMatch excludes admin specs).
 *
 * Owner vs barber: a barber is server-side blocked from owner-only pages/APIs
 * (403 / NoAccess), and the owner-only nav links are hidden (FR-044 UI hiding).
 * The API assertions are the robust proof; the UI assertions document the hiding.
 */
import { test, expect } from '@playwright/test'
import { openDb, cleanupByEmailPrefix, type Db } from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-rbac@example.com'
const BARBER_EMAIL = 'e2e-admin-barber-rbac@example.com'
const PASSWORD = 'rbac-passw0rd-xyz'
const CUST_PREFIX = 'e2e-admin-rbac-'

const today = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
}).format(new Date())

let db: Db
let custId: string

test.beforeAll(async () => {
  db = openDb()
  await cleanupByEmailPrefix(db, CUST_PREFIX)
  await seedAdmin(db, { email: OWNER_EMAIL, role: 'owner', password: PASSWORD })
  await seedAdmin(db, { email: BARBER_EMAIL, role: 'barber', barberSlug: 'adil', password: PASSWORD })

  // A throwaway customer so the purge-API RBAC check has a real target id.
  const rows = await db<{ id: string }[]>`
    INSERT INTO customers (first_name, last_name, email, preferred_language)
    VALUES ('Rbac', 'Target', ${CUST_PREFIX + 'target@example.com'}, 'nl')
    ON CONFLICT (email) DO UPDATE SET updated_at = now()
    RETURNING id
  `
  custId = rows[0].id
})

test.afterAll(async () => {
  await cleanupByEmailPrefix(db, CUST_PREFIX)
  await cleanupAdmins(db, PREFIX)
  await db.end()
})

// ── The owner-only API endpoints a barber must be 403'd from ──────────────────
function ownerOnlyCalls(custId: string) {
  return [
    { label: 'services editor', method: 'get' as const, url: '/api/admin/services' },
    {
      label: 'GDPR purge',
      method: 'post' as const,
      url: `/api/admin/customers/${custId}/purge`,
      data: { confirmText: 'VERWIJDER' },
    },
    {
      label: 'bulk mail',
      method: 'post' as const,
      url: '/api/admin/bulk-email',
      data: { preview: true, filter: 'marketing' },
    },
    { label: 'settings', method: 'put' as const, url: '/api/admin/settings', data: {} },
  ]
}

// ═════════════════════════════════════════════════════════════════════════════
// Barber: owner-only nav hidden, owner-only pages 403, owner-only APIs 403
// ═════════════════════════════════════════════════════════════════════════════

test.describe('barber role', () => {
  test('owner-only nav links hidden; calendar visible (FR-044 UI hiding)', async ({ page }) => {
    await loginAs(page, BARBER_EMAIL, PASSWORD)

    // Barber CAN see the calendar + own-scope links.
    await expect(page.getByRole('link', { name: 'Agenda' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Klanten' })).toBeVisible()

    // Owner-only links are absent.
    for (const label of ['Diensten', 'Banner', 'Mailing', 'Instellingen']) {
      await expect(page.getByRole('link', { name: label })).toHaveCount(0)
    }
  })

  test('owner-only page shows the 403/NoAccess state', async ({ page }) => {
    await loginAs(page, BARBER_EMAIL, PASSWORD)
    await page.goto('/admin/diensten')
    // NoAccess renders the "Geen toegang" block instead of the services editor.
    await expect(page.getByRole('heading', { name: 'Geen toegang' })).toBeVisible()
  })

  test('owner-only APIs return 403 for a barber', async ({ page }) => {
    await loginAs(page, BARBER_EMAIL, PASSWORD)
    for (const call of ownerOnlyCalls(custId)) {
      const res =
        call.method === 'get'
          ? await page.request.get(call.url)
          : call.method === 'post'
            ? await page.request.post(call.url, { data: call.data })
            : await page.request.put(call.url, { data: call.data })
      expect(res.status(), `barber → ${call.label} (${call.url})`).toBe(403)
    }
  })

  test('shop stats: barber response is own-scoped (no revenue, FR-060)', async ({ page }) => {
    await loginAs(page, BARBER_EMAIL, PASSWORD)
    // The route forces a barber to scope=own even when scope=shop is requested,
    // so it is 200 — but revenue is null (out of scope) rather than a number.
    const res = await page.request.get(`/api/admin/stats?range=day&from=${today}&scope=shop`)
    expect(res.status()).toBe(200)
    const body = (await res.json()) as { totals: { revenueCents: number | null } }
    expect(body.totals.revenueCents, 'barber must not see shop revenue').toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// Owner: owner-only nav visible, owner-only APIs 200
// ═════════════════════════════════════════════════════════════════════════════

test.describe('owner role', () => {
  test('owner-only nav links visible', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    for (const label of ['Diensten', 'Banner', 'Mailing', 'Instellingen']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible()
    }
  })

  test('owner sees the GDPR delete control on a customer detail', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)
    await page.goto(`/admin/klanten/${custId}`)
    await expect(page.getByRole('button', { name: 'Klant verwijderen (AVG)' })).toBeVisible()
  })

  test('owner-only (non-destructive) APIs return 200', async ({ page }) => {
    await loginAs(page, OWNER_EMAIL, PASSWORD)

    const services = await page.request.get('/api/admin/services')
    expect(services.status(), 'owner → services GET').toBe(200)

    const preview = await page.request.post('/api/admin/bulk-email', {
      data: { preview: true, filter: 'marketing' },
    })
    expect(preview.status(), 'owner → bulk-email preview').toBe(200)

    const stats = await page.request.get(`/api/admin/stats?range=day&from=${today}&scope=shop`)
    expect(stats.status(), 'owner → shop stats').toBe(200)
    const body = (await stats.json()) as { totals: { revenueCents: number | null } }
    expect(body.totals.revenueCents, 'owner sees shop revenue (number)').not.toBeNull()
  })
})
