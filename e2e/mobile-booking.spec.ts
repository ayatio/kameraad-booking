/**
 * mobile-booking.spec.ts — Mobile wizard (Pixel 7) tests.
 * Restricted to the 'mobile' project via test.skip.
 */
import { test, expect, type Page } from '@playwright/test'
import { openDb, cleanupByEmailPrefix, type Db } from './helpers/db'
import nl from '../messages/nl.json'

// ─── DB for cleanup ───────────────────────────────────────────────────────────
let db: Db

test.beforeAll(async () => {
  db = openDb()
})

test.afterAll(async () => {
  await cleanupByEmailPrefix(db, 'e2e+mob-')
  await db.end()
})

// Guard: skip unless running in the 'mobile' project
function mobileOnly(testInfo: { project: { name: string } }) {
  test.skip(testInfo.project.name !== 'mobile', 'mobile-only test')
}

// ─── Shared slot-picker helper (mirrors booking.spec) ─────────────────────────
async function pickFirstAvailableSlot(page: Page) {
  await page.locator('[aria-label="Selecteer een dag"]').waitFor({ timeout: 15_000 })
  const skeleton = page.locator('[aria-busy="true"]')
  if (await skeleton.isVisible({ timeout: 2_000 })) {
    await skeleton.waitFor({ state: 'hidden', timeout: 15_000 })
  }
  const nextDayBtn = page.getByRole('button', { name: nl.booking.nextAvailableDay })
  if (await nextDayBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await nextDayBtn.click()
    const newSkeleton = page.locator('[aria-busy="true"]')
    if (await newSkeleton.isVisible({ timeout: 2_000 })) {
      await newSkeleton.waitFor({ state: 'hidden', timeout: 15_000 })
    }
  }
  await page.locator('[aria-label="Beschikbare tijden"]').waitFor({ timeout: 15_000 })
  await page.locator('[aria-label="Beschikbare tijden"]').getByRole('option').first().click()
}

// ═════════════════════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════════════════════

test('mobile: /nl/boeken shows the open-button', async ({ page }, testInfo) => {
  mobileOnly(testInfo)

  await page.goto('/nl/boeken')

  // "Boek je stoel →" button visible on mobile
  const openBtn = page.getByRole('button', { name: nl.booking.openButton })
  await expect(openBtn).toBeVisible()
})

test('mobile: tapping open-button opens the full-screen wizard with progress dots', async ({
  page,
}, testInfo) => {
  mobileOnly(testInfo)

  await page.goto('/nl/boeken')

  const openBtn = page.getByRole('button', { name: nl.booking.openButton })
  await openBtn.click()

  // Dialog opens
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5_000 })

  // Progress dots: 4 spans inside the modal bar (aria-hidden)
  const progressDots = page.locator('.bk-modalbar span[aria-hidden="true"] span, .bk-modalbar [aria-hidden="true"] span')
  // The modal bar contains a flex row with 4 dot spans
  await expect(
    page.locator('.bk-modalbar').locator('span.h-\\[7px\\]'),
  ).toHaveCount(4)
})

test('mobile: close ✕ button closes the wizard', async ({ page }, testInfo) => {
  mobileOnly(testInfo)

  await page.goto('/nl/boeken')
  await page.getByRole('button', { name: nl.booking.openButton }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  // Close with ✕ button (aria-label = nl.booking.close)
  await page.getByRole('button', { name: nl.booking.close }).click()

  // Dialog gone
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
})

test('mobile: Esc key closes the wizard', async ({ page }, testInfo) => {
  mobileOnly(testInfo)

  await page.goto('/nl/boeken')
  await page.getByRole('button', { name: nl.booking.openButton }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  // Press Escape
  await page.keyboard.press('Escape')

  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5_000 })
})

test('mobile: complete a full booking through the wizard', async ({ page }, testInfo) => {
  mobileOnly(testInfo)

  const email = `e2e+mob-${Date.now()}@example.com`

  await page.goto('/nl/boeken')

  // Open wizard
  await page.getByRole('button', { name: nl.booking.openButton }).click()
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })

  // Step 1 – Barber: no preference
  await page.getByRole('button', { name: nl.booking.noPreference }).click()

  // Step 2 – Service: first bookable
  await page.locator('button[aria-pressed]').first().waitFor({ timeout: 10_000 })
  await page.locator('button[aria-pressed]').first().click()

  // Step 3 – Slot
  await pickFirstAvailableSlot(page)

  // Step 4 – Details
  await page.locator('#bf-firstName').waitFor({ timeout: 10_000 })
  await page.fill('#bf-firstName', 'MobTest')
  await page.fill('#bf-lastName', 'E2E')
  await page.fill('#bf-email', email)
  await page.fill('#bf-phone', '0479123456')
  await page.locator('input[type="checkbox"]').nth(0).check()
  await page.locator('input[type="checkbox"]').nth(1).check()

  // Submit
  await page.getByRole('button', { name: nl.booking.confirm }).click()

  // Confirmation
  await expect(page.getByText(nl.booking.done.heading)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(nl.booking.done.emailInfo)).toBeVisible()

  // Verify email_log row in DB
  const rows = await db<{ id: string }[]>`
    SELECT el.id FROM email_log el
    JOIN appointments a ON a.id = el.appointment_id
    JOIN customers c ON c.id = a.customer_id
    WHERE c.email = ${email}
      AND el.email_type = 'confirmation'
      AND el.status = 'sent'
  `
  expect(rows, 'mobile booking should have confirmation email_log row').toHaveLength(1)
})
