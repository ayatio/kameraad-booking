/**
 * admin-blocks.spec.ts — PHASES box 4 (D10: block-over-appointment conflict).
 * Desktop-chromium only.
 *
 * The conflict dialog IS the acceptance criterion, so this drives the real UI.
 * Path A: cancel + notify → appointment cancelled + cancellation email.
 * Path B: keep            → appointment stays confirmed, no email.
 */
import { test, expect, type Page } from '@playwright/test'
import {
  openDb,
  seedAppointment,
  cleanupByEmailPrefix,
  nextBrusselsSlot,
  toLocalDate,
  type Db,
} from './helpers/db'
import { findOutboxPayload } from './helpers/outbox'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const ADMIN_PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-blocks@example.com'
const PASSWORD = 'blocks-passw0rd-xyz'
const CUST_PREFIX = 'e2e-admin-blocks-'
const BLOCK_REASON = `e2e-block-${Date.now()}`

let db: Db
let ADIL_ID: string
let HAIRCUT_ID: string

test.beforeAll(async () => {
  db = openDb()
  const [b] = await db<{ id: string }[]>`SELECT id FROM barbers WHERE slug = 'adil' LIMIT 1`
  const [s] = await db<{ id: string }[]>`SELECT id FROM services WHERE slug = 'haircut' LIMIT 1`
  ADIL_ID = b.id
  HAIRCUT_ID = s.id
  await cleanupByEmailPrefix(db, CUST_PREFIX)
  await seedAdmin(db, { email: OWNER_EMAIL, role: 'owner', password: PASSWORD })
})

test.afterAll(async () => {
  await db`DELETE FROM blocked_slots WHERE reason LIKE ${BLOCK_REASON + '%'}`
  await cleanupByEmailPrefix(db, CUST_PREFIX)
  await cleanupAdmins(db, ADMIN_PREFIX)
  await db.end()
})

const pad = (n: number) => String(n).padStart(2, '0')

// Drive the BlocksEditor create form: pick Adil, a window straddling `brusselsHour`,
// and submit. Returns once the D10 conflict dialog is on screen.
async function openConflictDialog(page: Page, dateStr: string, brusselsHour: number, reason: string) {
  await page.goto('/admin/blokkades')
  await page.locator('select').first().selectOption(ADIL_ID)
  // The reason field is a plain <input> (no type attr). Exclude the date/time
  // inputs AND the hidden input that Next injects into the logout server-action
  // form (which precedes it in the DOM).
  await page
    .locator('input:not([type="date"]):not([type="time"]):not([type="hidden"])')
    .first()
    .fill(reason)
  await page.locator('input[type="date"]').nth(0).fill(dateStr)
  await page.locator('input[type="time"]').nth(0).fill(`${pad(brusselsHour - 1)}:00`)
  await page.locator('input[type="date"]').nth(1).fill(dateStr)
  await page.locator('input[type="time"]').nth(1).fill(`${pad(brusselsHour + 1)}:00`)
  await page.getByRole('button', { name: 'Blokkade aanmaken' }).click()
  await expect(page.getByRole('heading', { name: 'Overlappende afspraken' })).toBeVisible({
    timeout: 15_000,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// Path A — cancel + notify
// ═════════════════════════════════════════════════════════════════════════════

test('D10 path A: cancel + notify → appointment cancelled + cancellation email', async ({ page }) => {
  const email = `${CUST_PREFIX}cancel-${Date.now()}@example.com`
  const firstName = `BlockA${Date.now()}`
  const slot = nextBrusselsSlot(72, 13)
  const seeded = await seedAppointment(db, {
    email,
    firstName,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: slot,
    durationMin: 40,
  })

  await loginAs(page, OWNER_EMAIL, PASSWORD)
  await openConflictDialog(page, toLocalDate(slot), 13, BLOCK_REASON + '-A')

  // The conflicting appointment is listed by customer name.
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(firstName, { exact: false })).toBeVisible()

  // Choose "Annuleren + klant mailen" for this conflict, then commit.
  await dialog.getByRole('button', { name: 'Annuleren + klant mailen' }).click()
  await dialog.getByRole('button', { name: 'Blokkade bevestigen' }).click()

  // Success notice appears once the block is created.
  await expect(page.getByText('Blokkade aangemaakt.')).toBeVisible({ timeout: 15_000 })

  // DB: appointment cancelled.
  const [appt] = await db<{ status: string }[]>`
    SELECT status FROM appointments WHERE id = ${seeded.appointmentId}
  `
  expect(appt.status).toBe('cancelled')

  // email_log: a sent cancellation for this customer.
  await expect
    .poll(async () => {
      const rows = await db<{ id: string }[]>`
        SELECT id FROM email_log
         WHERE appointment_id = ${seeded.appointmentId}
           AND email_type = 'cancellation' AND status = 'sent'
      `
      return rows.length
    }, { timeout: 10_000 })
    .toBe(1)

  // Outbox: a cancellation payload addressed to the customer.
  const payload = findOutboxPayload(email, 'cancellation')
  expect(payload, 'cancellation outbox payload exists').not.toBeNull()
  expect(payload!.to).toBe(email)
})

// ═════════════════════════════════════════════════════════════════════════════
// Path B — keep
// ═════════════════════════════════════════════════════════════════════════════

test('D10 path B: keep → appointment stays confirmed, no cancellation email', async ({ page }) => {
  const email = `${CUST_PREFIX}keep-${Date.now()}@example.com`
  const firstName = `BlockB${Date.now()}`
  const slot = nextBrusselsSlot(72, 16)
  const seeded = await seedAppointment(db, {
    email,
    firstName,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: slot,
    durationMin: 40,
  })

  await loginAs(page, OWNER_EMAIL, PASSWORD)
  await openConflictDialog(page, toLocalDate(slot), 16, BLOCK_REASON + '-B')

  const dialog = page.getByRole('dialog')
  await expect(dialog.getByText(firstName, { exact: false })).toBeVisible()

  // "Behouden" is the default decision — just commit without changing it.
  await dialog.getByRole('button', { name: 'Blokkade bevestigen' }).click()
  await expect(page.getByText('Blokkade aangemaakt.')).toBeVisible({ timeout: 15_000 })

  // DB: appointment unchanged.
  const [appt] = await db<{ status: string }[]>`
    SELECT status FROM appointments WHERE id = ${seeded.appointmentId}
  `
  expect(appt.status).toBe('confirmed')

  // No cancellation email was logged.
  const rows = await db<{ id: string }[]>`
    SELECT id FROM email_log
     WHERE appointment_id = ${seeded.appointmentId} AND email_type = 'cancellation'
  `
  expect(rows, 'no cancellation email for a kept appointment').toHaveLength(0)
  expect(findOutboxPayload(email, 'cancellation'), 'no cancellation outbox payload').toBeNull()
})
