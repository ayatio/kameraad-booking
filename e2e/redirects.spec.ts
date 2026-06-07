/**
 * redirects.spec.ts — FR-102: legacy + localized booking-slug redirects.
 *
 * Asserts the REAL map implemented in next.config.mjs (Delegation C), which uses
 * explicit `statusCode: 301` for every entry (NOT Next's `permanent:true` 308
 * shorthand — see the decision comment in next.config.mjs). Query strings on
 * path-only redirects are preserved by Next automatically.
 *
 * Desktop-chromium only (not in the mobile testMatch allowlist).
 */
import { test, expect } from '@playwright/test'

// Each entry: source path → expected Location (path or path-prefix when query is appended).
const REDIRECTS: Array<{ from: string; to: string }> = [
  // Localized booking slugs → canonical /{locale}/boeken
  { from: '/en/book', to: '/en/boeken' },
  { from: '/fr/reserver', to: '/fr/boeken' },
  { from: '/es/reservar', to: '/es/boeken' },
  // Legacy Webflow entry point (explicit FR-102 example)
  { from: '/afspraak-maken', to: '/nl/boeken' },
]

for (const { from, to } of REDIRECTS) {
  test(`301 ${from} → ${to}`, async ({ page }) => {
    const res = await page.request.get(from, { maxRedirects: 0 })
    expect([301, 308], `status for ${from}`).toContain(res.status())
    // next.config uses statusCode:301 explicitly.
    expect(res.status(), `${from} should be a literal 301`).toBe(301)
    const loc = res.headers()['location']
    expect(loc, `Location header for ${from}`).toBeTruthy()
    // Location may be absolute or relative; assert it ends with / contains the target.
    expect(loc).toContain(to)
  })
}

test('301 preserves the query string', async ({ page }) => {
  const res = await page.request.get('/en/book?barber=adil&service=haircut', { maxRedirects: 0 })
  expect(res.status()).toBe(301)
  const loc = res.headers()['location']
  expect(loc).toContain('/en/boeken')
  expect(loc, 'barber query preserved').toContain('barber=adil')
  expect(loc, 'service query preserved').toContain('service=haircut')
})

test('canonical booking page is NOT redirected (200)', async ({ page }) => {
  const res = await page.request.get('/nl/boeken', { maxRedirects: 0 })
  expect(res.status(), '/nl/boeken serves directly').toBe(200)
})
