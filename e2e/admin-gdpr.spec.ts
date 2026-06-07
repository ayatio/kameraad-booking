/**
 * admin-gdpr.spec.ts — PHASES box 3 (FR-058 type-to-confirm, FR-080..083 purge).
 * Desktop-chromium only.
 */
import { test, expect } from '@playwright/test'
import { openDb, seedAppointment, cleanupByEmailPrefix, nextBrusselsSlot, type Db } from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const ADMIN_PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-gdpr@example.com'
const PASSWORD = 'gdpr-passw0rd-xyz'
const CUST_PREFIX = 'e2e-admin-gdpr-'

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
  await cleanupByEmailPrefix(db, CUST_PREFIX)
  await cleanupAdmins(db, ADMIN_PREFIX)
  await db.end()
})

// ═════════════════════════════════════════════════════════════════════════════
// Owner purges a customer via the UI; all PII is gone; one PII-free audit event
// ═════════════════════════════════════════════════════════════════════════════

test('GDPR purge wipes all PII and writes one PII-free audit event', async ({ page }) => {
  // Unique, identifiable PII so the post-purge scan can't false-positive on other rows.
  const email = `${CUST_PREFIX}wipe-${Date.now()}@example.com`
  const firstName = `Gdpr${Date.now()}`
  const lastName = `Wipe${Date.now()}`
  const phone = `+32 470 ${String(Date.now()).slice(-6)}`

  const slot = nextBrusselsSlot(72, 10)
  const seeded = await seedAppointment(db, {
    email,
    firstName,
    lastName,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: slot,
    durationMin: 40,
  })
  const custId = seeded.customerId
  await db`UPDATE customers SET phone = ${phone} WHERE id = ${custId}`

  // An email_log row referencing both the customer and their appointment.
  await db`
    INSERT INTO email_log (appointment_id, customer_id, email_type, to_email, subject, sent_at, status)
    VALUES (${seeded.appointmentId}, ${custId}, 'confirmation', ${email}, 'Bevestiging', NOW(), 'sent')
  `

  // ── Drive the type-to-confirm UI (FR-058) ──────────────────────────────────
  await loginAs(page, OWNER_EMAIL, PASSWORD)
  await page.goto(`/admin/klanten/${custId}`)
  await page.getByRole('button', { name: 'Klant verwijderen (AVG)' }).click()

  const confirmInput = page.getByPlaceholder('Typ VERWIJDER')
  await expect(confirmInput).toBeVisible()
  const purgeBtn = page.getByRole('button', { name: 'Permanent verwijderen' })
  // Disabled until the exact phrase is typed.
  await expect(purgeBtn).toBeDisabled()
  await confirmInput.fill('VERWIJDER')
  await expect(purgeBtn).toBeEnabled()
  await purgeBtn.click()

  // After purge the UI returns to the customer list.
  await page.waitForURL('**/admin/klanten', { timeout: 15_000 })

  // ── FR-081: ZERO rows anywhere contain this customer's PII ──────────────────
  const [{ c: custRows }] = await db<{ c: string }[]>`
    SELECT count(*)::text AS c FROM customers
     WHERE id = ${custId}
        OR email = ${email} OR first_name = ${firstName}
        OR last_name = ${lastName} OR phone = ${phone}
  `
  expect(Number(custRows), 'no customer row with this PII').toBe(0)

  const [{ c: apptRows }] = await db<{ c: string }[]>`
    SELECT count(*)::text AS c FROM appointments WHERE customer_id = ${custId}
  `
  expect(Number(apptRows), 'no appointments for purged customer').toBe(0)

  const [{ c: emailRows }] = await db<{ c: string }[]>`
    SELECT count(*)::text AS c FROM email_log
     WHERE customer_id = ${custId} OR to_email = ${email}
  `
  expect(Number(emailRows), 'no email_log rows with this PII').toBe(0)

  // ── FR-080/082: exactly one gdpr_delete audit event, matched by id hash ─────
  const auditRows = await db<{ payload: Record<string, unknown> }[]>`
    SELECT payload FROM audit_log
     WHERE action = 'gdpr_delete'
       AND payload->>'customer_id_hash' = encode(digest(${custId}::text, 'sha256'), 'hex')
  `
  expect(auditRows, 'exactly one gdpr_delete event for this customer').toHaveLength(1)

  // Payload carries NO PII — only the hash + counts.
  const payloadStr = JSON.stringify(auditRows[0].payload)
  for (const pii of [email, firstName, lastName, phone]) {
    expect(payloadStr, 'audit payload must contain no PII').not.toContain(pii)
  }
  expect(auditRows[0].payload).toHaveProperty('customer_id_hash')
})

// ═════════════════════════════════════════════════════════════════════════════
// FR-082: a direct DELETE on a customer with an appointment is RESTRICT-blocked
// ═════════════════════════════════════════════════════════════════════════════

test('direct DELETE on a customer with an appointment is blocked (FK RESTRICT)', async ({}) => {
  const email = `${CUST_PREFIX}restrict-${Date.now()}@example.com`
  const slot = nextBrusselsSlot(96, 11)
  const seeded = await seedAppointment(db, {
    email,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: slot,
    durationMin: 40,
  })

  let rejected = false
  try {
    await db`DELETE FROM customers WHERE id = ${seeded.customerId}`
  } catch (err) {
    rejected = true
    // pg foreign_key_violation
    expect((err as { code?: string }).code).toBe('23503')
  }
  expect(rejected, 'DELETE must be rejected by ON DELETE RESTRICT').toBe(true)

  // Customer still present (the RESTRICT held).
  const [{ c }] = await db<{ c: string }[]>`
    SELECT count(*)::text AS c FROM customers WHERE id = ${seeded.customerId}
  `
  expect(Number(c)).toBe(1)
})
