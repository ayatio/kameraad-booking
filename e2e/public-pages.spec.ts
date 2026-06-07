/**
 * public-pages.spec.ts — Phase-4 public marketing pages (Delegation A) regression.
 *
 * Desktop-chromium only (NOT in the mobile project's testMatch allowlist).
 *
 * Resilient by design: es/le copy is DRAFT (FR-094), so assertions target
 * STRUCTURE + PRESENCE (one <h1>, a Book CTA, barbers, a € price, the language
 * switcher, header/footer) rather than exact copy. The banner test re-proves
 * FR-062 at the PAGE level (Phase 3 proved the admin API): activate in the DB,
 * reload, assert visible; deactivate, reload, assert gone — then restore.
 */
import { test, expect } from '@playwright/test'
import { openDb } from './helpers/db'

const HOME_LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const
const SUBPAGES = ['diensten', 'over-ons', 'contact', 'privacy'] as const

// ─── Home, per locale ─────────────────────────────────────────────────────────

for (const locale of HOME_LOCALES) {
  test(`home renders structure — ${locale}`, async ({ page }) => {
    const res = await page.goto(`/${locale}`)
    expect(res?.status(), `GET /${locale} status`).toBe(200)

    // Exactly one <h1>
    await expect(page.locator('h1')).toHaveCount(1)

    // Book CTA → /{locale}/boeken (several link to it; assert at least one)
    const bookLinks = page.locator(`a[href="/${locale}/boeken"]`)
    expect(await bookLinks.count(), 'a Book CTA links to /boeken').toBeGreaterThan(0)
    await expect(bookLinks.first()).toBeVisible()

    // Barbers render (team showcase section has at least one card)
    const teamCards = page.locator('[data-section="team"] li')
    expect(await teamCards.count(), 'barber cards render').toBeGreaterThan(0)

    // A service price (€) renders in the services section
    await expect(page.locator('[data-section="services"]')).toContainText('€')

    // LanguageSwitcher present (FR-093)
    await expect(page.locator('nav[aria-label="Language switcher"]').first()).toBeVisible()

    // Public chrome present
    await expect(page.locator('header.pub-header')).toBeVisible()
    await expect(page.locator('footer.pub-footer')).toBeVisible()
  })
}

// ─── Seasonal banner: page-level FR-062 ───────────────────────────────────────

test('seasonal banner appears when active and disappears when inactive (FR-062)', async ({
  page,
}) => {
  const db = openDb()
  const MARKER = `E2E BANNER ${Date.now()}`

  // Capture original state so we can restore it exactly.
  const [orig] = await db<{ is_active: boolean; title_nl: string | null }[]>`
    SELECT is_active, title_nl FROM content WHERE key = 'banner'
  `
  expect(orig, 'a seeded banner content row exists').toBeTruthy()

  try {
    // Activate with a unique marker title.
    await db`
      UPDATE content SET is_active = true, title_nl = ${MARKER} WHERE key = 'banner'
    `
    await page.goto('/nl')
    // force-dynamic home reads the banner at request time → marker visible.
    await expect(page.getByText(MARKER)).toBeVisible()
    await expect(page.locator('aside[role="region"]')).toBeVisible()

    // Deactivate → banner gone after reload.
    await db`UPDATE content SET is_active = false WHERE key = 'banner'`
    await page.goto('/nl')
    await expect(page.getByText(MARKER)).toHaveCount(0)
  } finally {
    // Restore original DB state regardless of assertion outcome.
    await db`
      UPDATE content
      SET is_active = ${orig.is_active}, title_nl = ${orig.title_nl}
      WHERE key = 'banner'
    `
    await db.end()
  }
})

// ─── Sub-pages (services / about / contact / privacy) ─────────────────────────

for (const locale of HOME_LOCALES) {
  for (const seg of SUBPAGES) {
    test(`subpage ${seg} renders — ${locale}`, async ({ page }) => {
      const res = await page.goto(`/${locale}/${seg}`)
      expect(res?.status(), `GET /${locale}/${seg} status`).toBe(200)

      // One <h1> + public chrome
      await expect(page.locator('h1')).toHaveCount(1)
      await expect(page.locator('header.pub-header')).toBeVisible()
      await expect(page.locator('footer.pub-footer')).toBeVisible()
    })
  }
}

// ─── Privacy page content + footer policy (FR-100 / GDPR) ─────────────────────

test('privacy page contains a GDPR/privacy keyword', async ({ page }) => {
  await page.goto('/nl/privacy')
  const body = (await page.locator('main').innerText()).toLowerCase()
  expect(body).toMatch(/privacy|gegevens|persoonsgegevens|gdpr|avg|verwerk/)
})

test('footer has the privacy link and NO social links (FR-100)', async ({ page }) => {
  await page.goto('/nl')
  const footer = page.locator('footer.pub-footer')

  // Privacy link present
  expect(await footer.locator('a[href="/nl/privacy"]').count()).toBeGreaterThan(0)

  // No social links (FA §10/§12 exclude socials)
  expect(await footer.locator('a[href*="instagram"]').count()).toBe(0)
  expect(await footer.locator('a[href*="facebook"]').count()).toBe(0)
  expect(await footer.locator('a[href*="tiktok"]').count()).toBe(0)
})
