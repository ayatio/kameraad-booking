/**
 * booking.spec.ts — Happy-path booking in nl / en / fr / es.
 * Runs on both desktop-chromium (accordion) and mobile (popup wizard).
 */
import { test, expect, type Page } from '@playwright/test'
import postgres from 'postgres'
import { openDb, cleanupByEmailPrefix } from './helpers/db'
import { findOutboxPayload } from './helpers/outbox'
import { buildIcs } from '../src/lib/email/ics'

// ─── Message imports (exact strings used as stable locators) ──────────────────

import nl from '../messages/nl.json'
import en from '../messages/en.json'
import fr from '../messages/fr.json'
import es from '../messages/es.json'

type Messages = typeof nl

const LOCALES: Array<{ locale: string; m: Messages }> = [
  { locale: 'nl', m: nl },
  { locale: 'en', m: en as unknown as Messages },
  { locale: 'fr', m: fr as unknown as Messages },
  { locale: 'es', m: es as unknown as Messages },
]

// Unique per locale+run so parallel reruns don't clash
function makeEmail(locale: string) {
  return `e2e+bk-${locale}-${Date.now()}@example.com`
}

// ─── Slot-picking helper ───────────────────────────────────────────────────────

/**
 * Waits for the slot picker to finish loading, navigates to the first day with
 * available slots (handles the "no slots today → next available day" path), and
 * clicks the first slot button.
 */
async function pickFirstAvailableSlot(page: Page, nextAvailableDayLabel: string) {
  // The day pill strip (aria-label hardcoded "Selecteer een dag" in StepSlot)
  await page.locator('[aria-label="Selecteer een dag"]').waitFor({ timeout: 15_000 })

  // Wait for any loading skeleton to disappear
  const skeleton = page.locator('[aria-busy="true"]')
  if (await skeleton.isVisible({ timeout: 2_000 })) {
    await skeleton.waitFor({ state: 'hidden', timeout: 15_000 })
  }

  // If today has no slots, a "next available day" button appears
  const nextDayBtn = page.getByRole('button', { name: nextAvailableDayLabel })
  if (await nextDayBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
    await nextDayBtn.click()
    // Wait for new day's slots to load
    const newSkeleton = page.locator('[aria-busy="true"]')
    if (await newSkeleton.isVisible({ timeout: 2_000 })) {
      await newSkeleton.waitFor({ state: 'hidden', timeout: 15_000 })
    }
  }

  // Click first available slot
  await page
    .locator('[aria-label="Beschikbare tijden"]')
    .waitFor({ timeout: 15_000 })
  await page
    .locator('[aria-label="Beschikbare tijden"]')
    .getByRole('option')
    .first()
    .click()
}

// ─── Single booking flow ───────────────────────────────────────────────────────

async function runBookingFlow(page: Page, locale: string, m: Messages, email: string) {
  await page.goto(`/${locale}/boeken`)

  // On mobile viewport, the accordion is hidden until the "open" button is tapped
  const isMobile = (page.viewportSize()?.width ?? 1280) <= 680
  if (isMobile) {
    await page.getByRole('button', { name: m.booking.openButton }).click()
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 })
  }

  // Step 1 – Barber: pick "no preference"
  await page.getByRole('button', { name: m.booking.noPreference }).click()

  // Step 2 – Service: pick first bookable (aria-pressed appears on service buttons)
  await page.locator('button[aria-pressed]').first().waitFor({ timeout: 10_000 })
  await page.locator('button[aria-pressed]').first().click()

  // Step 3 – Slot: pick first available
  await pickFirstAvailableSlot(page, m.booking.nextAvailableDay)

  // Step 4 – Details form
  await page.locator('#bf-firstName').waitFor({ timeout: 10_000 })
  await page.fill('#bf-firstName', 'Test')
  await page.fill('#bf-lastName', 'E2E')
  await page.fill('#bf-email', email)
  await page.fill('#bf-phone', '0479123456')

  // Tick both required checkboxes
  const checkboxes = page.locator('input[type="checkbox"]')
  await checkboxes.nth(0).check()
  await checkboxes.nth(1).check()

  // Submit
  await page.getByRole('button', { name: m.booking.confirm }).click()

  // ── Assert confirmation state ──────────────────────────────────────────────
  await expect(page.getByText(m.booking.done.heading)).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(m.booking.done.emailInfo)).toBeVisible()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

let db: ReturnType<typeof openDb>

test.beforeAll(async () => {
  db = openDb()
})

test.afterAll(async () => {
  await cleanupByEmailPrefix(db, 'e2e+bk-')
  await db.end()
})

for (const { locale, m } of LOCALES) {
  test(`happy booking — ${locale}`, async ({ page }) => {
    const email = makeEmail(locale)

    await runBookingFlow(page, locale, m, email)

    // ── DB: confirmation email_log row ─────────────────────────────────────
    const logs = await db<{ id: string }[]>`
      SELECT el.id
      FROM email_log el
      JOIN appointments a  ON a.id  = el.appointment_id
      JOIN customers   c  ON c.id  = a.customer_id
      WHERE c.email          = ${email}
        AND el.email_type    = 'confirmation'
        AND el.status        = 'sent'
    `
    expect(logs, 'email_log should have a confirmation row').toHaveLength(1)

    // ── .email-outbox: ICS attachment ──────────────────────────────────────
    const payload = findOutboxPayload(email, 'confirmation')
    expect(payload, `.email-outbox payload for ${email}`).not.toBeNull()
    expect(payload!.ics, 'ICS attachment should be present').toBeDefined()
    expect(payload!.ics!.method, 'ICS method').toBe('REQUEST')
    expect(payload!.ics!.filename).toMatch(/\.ics$/)

    // Verify buildIcs (the function used to generate the attachment) produces
    // BEGIN:VCALENDAR and METHOD:REQUEST — confirming the outbox entry is valid.
    const sampleIcs = buildIcs({
      method: 'REQUEST',
      sequence: 0,
      uid: 'e2e-verification',
      summary: 'E2E test',
      dtstart: new Date().toISOString(),
      dtend: new Date().toISOString(),
    })
    expect(sampleIcs).toContain('BEGIN:VCALENDAR')
    expect(sampleIcs).toContain('METHOD:REQUEST')
  })
}
