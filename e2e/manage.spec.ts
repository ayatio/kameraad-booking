/**
 * manage.spec.ts — Cancel / reschedule / invalid-token flows.
 * Runs on desktop-chromium only (functional; the mobile project excludes this file).
 */
import { test, expect } from '@playwright/test'
import {
  openDb,
  seedAppointment,
  cleanupByEmailPrefix,
  nextBrusselsSlot,
  toLocalDate,
  type Db,
} from './helpers/db'
import nl from '../messages/nl.json'

// ─── Seeded IDs (from stable seed data) ──────────────────────────────────────
// Queried once in beforeAll rather than hardcoded so tests survive re-seeding.
let ADIL_ID: string
let HAIRCUT_ID: string
const HAIRCUT_SLUG = 'haircut'
const HAIRCUT_DURATION_MIN = 40

// ─── Shared DB connection ─────────────────────────────────────────────────────
let db: Db

test.beforeAll(async () => {
  db = openDb()

  const [barber] = await db<{ id: string }[]>`
    SELECT id FROM barbers WHERE slug = 'adil' LIMIT 1
  `
  const [service] = await db<{ id: string }[]>`
    SELECT id FROM services WHERE slug = 'haircut' LIMIT 1
  `
  ADIL_ID = barber.id
  HAIRCUT_ID = service.id
})

test.afterAll(async () => {
  await cleanupByEmailPrefix(db, 'e2e-mng-')
  await db.end()
})

// ═════════════════════════════════════════════════════════════════════════════
// 1. Cancel – within cancellation window (appointment 48 h out)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('cancel – within window', () => {
  let cancelToken: string
  let apptId: string
  let slotUtc: Date

  test.beforeAll(async () => {
    slotUtc = nextBrusselsSlot(48, 14) // 14:00 Brussels, ≥48 h from now
    const seeded = await seedAppointment(db, {
      email: `e2e-mng-cancel-ok-${Date.now()}@example.com`,
      barberId: ADIL_ID,
      serviceId: HAIRCUT_ID,
      startAt: slotUtc,
      durationMin: HAIRCUT_DURATION_MIN,
    })
    cancelToken = seeded.cancelToken
    apptId = seeded.appointmentId
  })

  test('cancel page → succeeds → DB status cancelled → freed slot reappears', async ({
    page,
    request,
  }) => {
    // Visit cancel page
    await page.goto(`/nl/afspraak/annuleren/${cancelToken}`)

    // Appointment card should show (exact match avoids overlap with page h1)
    await expect(
      page.getByText(nl.manage.appointmentCard.heading, { exact: true }),
    ).toBeVisible({ timeout: 10_000 })

    // Idle state: "Annuleer afspraak" button visible
    await expect(
      page.getByRole('button', { name: nl.manage.cancel.confirmButton }),
    ).toBeVisible()

    // Click → confirming state
    await page.getByRole('button', { name: nl.manage.cancel.confirmButton }).click()
    await expect(
      page.getByRole('button', { name: nl.manage.cancel.confirmDefinitive }),
    ).toBeVisible()

    // Confirm definitively
    await page.getByRole('button', { name: nl.manage.cancel.confirmDefinitive }).click()

    // Success state
    await expect(page.getByText(nl.manage.cancel.successHeading)).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(nl.manage.cancel.successBody)).toBeVisible()

    // DB: status = 'cancelled'
    const rows = await db<{ status: string }[]>`
      SELECT status FROM appointments WHERE id = ${apptId}
    `
    expect(rows[0].status).toBe('cancelled')

    // Freed slot appears in GET /api/slots
    const dateStr = toLocalDate(slotUtc)
    const slotsRes = await request.get(
      `/api/slots?barberId=${ADIL_ID}&service=${HAIRCUT_SLUG}&from=${dateStr}&to=${dateStr}`,
    )
    expect(slotsRes.ok()).toBe(true)
    const { slots } = (await slotsRes.json()) as { slots: { startAtUtc: string }[] }
    const freed = slots.find((s) => s.startAtUtc === slotUtc.toISOString())
    expect(freed, `slot ${slotUtc.toISOString()} should be bookable again`).toBeDefined()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2. Cancel – outside cancellation window (appointment 1.5 h out → blocked)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('cancel – outside window (blocked)', () => {
  let cancelToken: string

  test.beforeAll(async () => {
    // ~1.5 h from now — inside the 24-h window → cannot cancel
    const startAt = new Date(Date.now() + 1.5 * 3_600_000)
    const seeded = await seedAppointment(db, {
      email: `e2e-mng-cancel-blocked-${Date.now()}@example.com`,
      barberId: ADIL_ID,
      serviceId: HAIRCUT_ID,
      startAt,
      durationMin: HAIRCUT_DURATION_MIN,
    })
    cancelToken = seeded.cancelToken
  })

  test('UI shows outside-window message with no cancel button; POST returns 403', async ({
    page,
    request,
  }) => {
    await page.goto(`/nl/afspraak/annuleren/${cancelToken}`)

    // Outside-window heading visible
    await expect(
      page.getByText(nl.manage.cancel.outsideWindowHeading),
    ).toBeVisible({ timeout: 10_000 })

    // No cancel button (CancelActions not rendered)
    await expect(
      page.getByRole('button', { name: nl.manage.cancel.confirmButton }),
    ).not.toBeVisible()

    // Server-side enforcement: POST returns 403 OUTSIDE_WINDOW (FR-034)
    const res = await request.post('/api/manage/cancel', {
      data: { token: cancelToken },
    })
    expect(res.status()).toBe(403)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('OUTSIDE_WINDOW')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3. Reschedule (appointment 48 h out, different slot from cancel test)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('reschedule', () => {
  let rescheduleToken: string
  let cancelToken: string
  let apptId: string
  let originalSlotUtc: Date

  test.beforeAll(async () => {
    // 15:00 Brussels on the same weekday to avoid exclusion-constraint conflict
    // with the cancel-within-window appointment (14:00 Brussels, same day)
    originalSlotUtc = nextBrusselsSlot(48, 15)
    const seeded = await seedAppointment(db, {
      email: `e2e-mng-reschedule-${Date.now()}@example.com`,
      barberId: ADIL_ID,
      serviceId: HAIRCUT_ID,
      startAt: originalSlotUtc,
      durationMin: HAIRCUT_DURATION_MIN,
    })
    rescheduleToken = seeded.rescheduleToken
    cancelToken = seeded.cancelToken
    apptId = seeded.appointmentId
  })

  test('reschedule to different slot → DB updated, old slot freed, reschedule email logged', async ({
    page,
    request,
  }) => {
    await page.goto(`/nl/afspraak/verzetten/${rescheduleToken}`)

    // Current appointment card
    await expect(
      page.getByText(nl.manage.reschedule.currentAppointment),
    ).toBeVisible({ timeout: 10_000 })

    // New-slot picker should show available slots
    // Wait for day strip, then loading to finish
    await page.locator('[aria-label="Selecteer een dag"]').waitFor({ timeout: 15_000 })
    const skeleton = page.locator('[aria-busy="true"]')
    if (await skeleton.isVisible({ timeout: 2_000 })) {
      await skeleton.waitFor({ state: 'hidden', timeout: 15_000 })
    }

    // If today has no slots, navigate to next available day
    const nextDayBtn = page.getByRole('button', { name: nl.booking.nextAvailableDay })
    if (await nextDayBtn.isVisible({ timeout: 4_000 }).catch(() => false)) {
      await nextDayBtn.click()
      const newSkeleton = page.locator('[aria-busy="true"]')
      if (await newSkeleton.isVisible({ timeout: 2_000 })) {
        await newSkeleton.waitFor({ state: 'hidden', timeout: 15_000 })
      }
    }

    // Click first available slot (≠ original slot, which is blocked)
    await page
      .locator('[aria-label="Beschikbare tijden"]')
      .waitFor({ timeout: 15_000 })
    await page
      .locator('[aria-label="Beschikbare tijden"]')
      .getByRole('option')
      .first()
      .click()

    // Confirm button appears
    await page
      .getByRole('button', { name: nl.manage.reschedule.confirmButton })
      .waitFor({ timeout: 5_000 })
    await page.getByRole('button', { name: nl.manage.reschedule.confirmButton }).click()

    // Success state
    await expect(
      page.getByText(nl.manage.reschedule.successHeading),
    ).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText(nl.manage.reschedule.successBody)).toBeVisible()

    // ── DB checks ────────────────────────────────────────────────────────────
    const [apptRow] = await db<{
      start_at: string
      cancel_token: string
      reschedule_token: string
    }[]>`
      SELECT start_at, cancel_token, reschedule_token
      FROM appointments WHERE id = ${apptId}
    `

    // start_at changed
    expect(
      new Date(apptRow.start_at).toISOString(),
      'start_at should differ from original slot',
    ).not.toBe(originalSlotUtc.toISOString())

    // tokens unchanged
    expect(apptRow.cancel_token).toBe(cancelToken)
    expect(apptRow.reschedule_token).toBe(rescheduleToken)

    // ── Old slot bookable again ───────────────────────────────────────────────
    const dateStr = toLocalDate(originalSlotUtc)
    const slotsRes = await request.get(
      `/api/slots?barberId=${ADIL_ID}&service=${HAIRCUT_SLUG}&from=${dateStr}&to=${dateStr}`,
    )
    expect(slotsRes.ok()).toBe(true)
    const { slots } = (await slotsRes.json()) as { slots: { startAtUtc: string }[] }
    const freed = slots.find((s) => s.startAtUtc === originalSlotUtc.toISOString())
    expect(freed, `old slot ${originalSlotUtc.toISOString()} should be bookable`).toBeDefined()

    // ── email_log has reschedule row ──────────────────────────────────────────
    const logRows = await db<{ id: string }[]>`
      SELECT id FROM email_log
      WHERE appointment_id = ${apptId}
        AND email_type = 'reschedule'
        AND status = 'sent'
    `
    expect(logRows, 'email_log should have a reschedule row').toHaveLength(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4. Invalid token → neutral 404 (no appointment data leaked)
// ═════════════════════════════════════════════════════════════════════════════

test.describe('invalid token', () => {
  test('cancel page with unknown token → 404, no appointment data', async ({ page }) => {
    // Next.js notFound() renders a 404 page
    const res = await page.goto('/nl/afspraak/annuleren/invalid-token-e2e-xyz-000')
    expect(res?.status()).toBe(404)

    // No barber name or service data should be visible
    await expect(page.getByText(nl.manage.appointmentCard.heading)).not.toBeVisible()
  })

  test('reschedule page with unknown token → 404, no appointment data', async ({ page }) => {
    const res = await page.goto('/nl/afspraak/verzetten/invalid-token-e2e-xyz-001')
    expect(res?.status()).toBe(404)

    await expect(page.getByText(nl.manage.appointmentCard.heading)).not.toBeVisible()
  })
})
