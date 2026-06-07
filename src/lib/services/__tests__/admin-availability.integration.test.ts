/**
 * Integration tests for the D10 block conflict flow (FR-055/056).
 * Real Postgres. Data prefixed 'test-adm-av-'. Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { commitBlock, previewBlockConflicts } from '../admin-availability'
import type { AdminActor } from '../actor'

const DB_URL = `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`
const sql = postgres(DB_URL, { max: 5 })

const PREFIX = 'test-adm-av-'
const ACTOR_EMAIL = 'test-adm-av-owner@example.com'
const OWNER: AdminActor = { role: 'owner', barberId: null, email: ACTOR_EMAIL }

let barberId: string
let serviceId: string

async function cleanup() {
  const barbers = await sql<{ id: string }[]>`SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
  const bIds = barbers.map((b) => b.id)
  if (bIds.length > 0) {
    const custRows = await sql<{ customer_id: string }[]>`
      SELECT DISTINCT customer_id FROM appointments WHERE barber_id = ANY(${bIds})
    `
    const custIds = custRows.map((r) => r.customer_id)
    await sql`DELETE FROM blocked_slots WHERE barber_id = ANY(${bIds})`
    await sql`DELETE FROM email_log WHERE appointment_id IN (SELECT id FROM appointments WHERE barber_id = ANY(${bIds}))`
    await sql`DELETE FROM appointments WHERE barber_id = ANY(${bIds})`
    if (custIds.length > 0) {
      await sql`DELETE FROM email_log WHERE customer_id = ANY(${custIds})`
      await sql`DELETE FROM customers WHERE id = ANY(${custIds})`
    }
  }
  await sql`DELETE FROM blocked_slots WHERE reason LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM customers WHERE email LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM availability WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM audit_log WHERE actor = ${ACTOR_EMAIL}`
}

async function seedConfirmed(startAt: Date, suffix: string): Promise<string> {
  const [cust] = await sql<{ id: string }[]>`
    INSERT INTO customers (first_name, last_name, email, preferred_language)
    VALUES (${'Block'}, ${'Cust'}, ${PREFIX + suffix + '@example.com'}, 'nl')
    RETURNING id
  `
  const endAt = new Date(startAt.getTime() + 3_600_000)
  const [appt] = await sql<{ id: string }[]>`
    INSERT INTO appointments (barber_id, service_id, customer_id, start_at, end_at, status)
    VALUES (${barberId}, ${serviceId}, ${cust.id}, ${startAt.toISOString()}, ${endAt.toISOString()}, 'confirmed')
    RETURNING id
  `
  return appt.id
}

beforeAll(async () => {
  await sql`SELECT 1`
  await cleanup()
  const [barber] = await sql<{ id: string }[]>`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${PREFIX + 'barber'}, ${'Av Barber'}, true, 91) RETURNING id
  `
  const [service] = await sql<{ id: string }[]>`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${PREFIX + 'svc'}, ${'Av Svc'}, ${'Av Svc'}, 60, 2500, true, false) RETURNING id
  `
  await sql`INSERT INTO barber_services (barber_id, service_id) VALUES (${barber.id}, ${service.id})`
  barberId = barber.id
  serviceId = service.id
})

afterAll(async () => {
  await cleanup()
  await sql.end()
})

describe('commitBlock D10 (FR-055/056)', () => {
  it('cancel_notify cancels + emails + audits; keep leaves the appointment confirmed', async () => {
    // Two confirmed appts inside the block window [07:00Z,10:00Z) = 09:00–12:00 local.
    const apptCancel = await seedConfirmed(new Date('2026-06-15T08:00:00.000Z'), 'cancel')
    const apptKeep = await seedConfirmed(new Date('2026-06-15T09:00:00.000Z'), 'keep')

    const startAt = new Date('2026-06-15T07:00:00.000Z')
    const endAt = new Date('2026-06-15T10:00:00.000Z')

    // Preview returns BOTH as conflicts, without mutating anything.
    const preview = await previewBlockConflicts({ barberId, startAt, endAt })
    expect(preview.map((c) => c.id).sort()).toEqual([apptCancel, apptKeep].sort())
    const [stillConfirmed] = await sql<{ status: string }[]>`SELECT status FROM appointments WHERE id = ${apptCancel}`
    expect(stillConfirmed.status).toBe('confirmed') // preview did not cancel

    const outcome = await commitBlock(
      {
        barberId,
        startAt,
        endAt,
        reason: PREFIX + 'vacation',
        resolutions: [
          { appointmentId: apptCancel, decision: 'cancel_notify' },
          { appointmentId: apptKeep, decision: 'keep' },
        ],
      },
      OWNER,
    )
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) return

    // The cancel_notify appt is cancelled with reason 'block'.
    const [cancelled] = await sql<{ status: string; cancellation_reason: string }[]>`
      SELECT status, cancellation_reason FROM appointments WHERE id = ${apptCancel}
    `
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.cancellation_reason).toBe('block')

    // A cancellation email was logged for it.
    const emails = await sql`
      SELECT id FROM email_log WHERE appointment_id = ${apptCancel} AND email_type = 'cancellation' AND status = 'sent'
    `
    expect(emails.length).toBeGreaterThanOrEqual(1)

    // BLOCK_CANCEL_APPT audit written.
    const audits = await sql`
      SELECT id FROM audit_log WHERE actor = ${ACTOR_EMAIL} AND action = 'block_cancel_appointment'
    `
    expect(audits.length).toBeGreaterThanOrEqual(1)

    // The kept appointment is untouched.
    const [kept] = await sql<{ status: string }[]>`SELECT status FROM appointments WHERE id = ${apptKeep}`
    expect(kept.status).toBe('confirmed')

    // The block itself was inserted.
    const blocks = await sql`SELECT id FROM blocked_slots WHERE id = ${outcome.result.block.id}`
    expect(blocks).toHaveLength(1)
    expect(outcome.result.summary.cancelled).toHaveLength(1)
    expect(outcome.result.summary.kept).toEqual([apptKeep])
  })
})
