/**
 * Integration tests for admin booking management (FR-050..053, FR-071).
 * Real Postgres. All data prefixed 'test-adm-bk-' and cleaned up before+after.
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import {
  adminCreateManualBooking,
  adminCancel,
  adminReschedule,
  toggleNoShow,
  type AdminActor,
} from '../admin-bookings'

const DB_URL = `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`
const sql = postgres(DB_URL, { max: 5 })

const PREFIX = 'test-adm-bk-'
const ACTOR_EMAIL = 'test-adm-bk-owner@example.com'
const OWNER: AdminActor = { role: 'owner', barberId: null, email: ACTOR_EMAIL }

const H = 3_600_000
// Monday 2026-06-15 in Brussels (CEST, UTC+2). 08:00Z = 10:00 local.
const MON_10_UTC = new Date('2026-06-15T08:00:00.000Z')

let barberId: string
let serviceId: string
let serviceSlug: string

async function cleanup() {
  const barbers = await sql<{ id: string }[]>`SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
  const bIds = barbers.map((b) => b.id)
  if (bIds.length > 0) {
    const custRows = await sql<{ customer_id: string }[]>`
      SELECT DISTINCT customer_id FROM appointments WHERE barber_id = ANY(${bIds})
    `
    const custIds = custRows.map((r) => r.customer_id)
    await sql`DELETE FROM email_log WHERE appointment_id IN (SELECT id FROM appointments WHERE barber_id = ANY(${bIds}))`
    await sql`DELETE FROM appointments WHERE barber_id = ANY(${bIds})`
    if (custIds.length > 0) {
      await sql`DELETE FROM email_log WHERE customer_id = ANY(${custIds})`
      await sql`DELETE FROM customers WHERE id = ANY(${custIds})`
    }
  }
  await sql`DELETE FROM customers WHERE email LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM availability WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM audit_log WHERE actor = ${ACTOR_EMAIL}`
}

async function seed() {
  const [barber] = await sql<{ id: string }[]>`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${PREFIX + 'barber'}, ${'Adm Test Barber'}, true, 90)
    RETURNING id
  `
  const [service] = await sql<{ id: string }[]>`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${PREFIX + 'svc'}, ${'Adm Svc'}, ${'Adm Svc'}, 60, 2500, true, false)
    RETURNING id
  `
  await sql`INSERT INTO barber_services (barber_id, service_id) VALUES (${barber.id}, ${service.id})`
  // Monday (dow=1) 09:00–18:00
  await sql`
    INSERT INTO availability (barber_id, day_of_week, start_time, end_time, is_active)
    VALUES (${barber.id}, 1, '09:00', '18:00', true)
  `
  // Settings the engine reads (generous horizon, 2h lead, no buffer).
  for (const [k, v] of [
    ['min_lead_time_hours', '2'],
    ['buffer_min', '0'],
    ['booking_horizon_days', '365'],
    ['cancellation_window_hours', '24'],
  ]) {
    await sql`INSERT INTO settings (key, value) VALUES (${k}, ${v}) ON CONFLICT (key) DO UPDATE SET value = ${v}`
  }
  barberId = barber.id
  serviceId = service.id
  serviceSlug = PREFIX + 'svc'
}

// Insert a confirmed appointment directly (bypasses the engine) with a real
// customer email. Returns ids. `startAt` chosen by the caller.
async function seedConfirmed(startAt: Date, emailSuffix: string): Promise<{ apptId: string; customerId: string }> {
  const [cust] = await sql<{ id: string }[]>`
    INSERT INTO customers (first_name, last_name, email, preferred_language)
    VALUES (${'Real'}, ${'Customer'}, ${PREFIX + emailSuffix + '@example.com'}, 'nl')
    RETURNING id
  `
  const endAt = new Date(startAt.getTime() + H)
  const [appt] = await sql<{ id: string }[]>`
    INSERT INTO appointments (barber_id, service_id, customer_id, start_at, end_at, status)
    VALUES (${barberId}, ${serviceId}, ${cust.id}, ${startAt.toISOString()}, ${endAt.toISOString()}, 'confirmed')
    RETURNING id
  `
  return { apptId: appt.id, customerId: cust.id }
}

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch (err) {
    throw new Error(`Cannot connect to Postgres.\n${String(err)}`)
  }
  await cleanup()
  await seed()
})

afterAll(async () => {
  await cleanup()
  await sql.end()
})

describe('adminCreateManualBooking without email (FR-052)', () => {
  it('creates an email_missing customer with a synthetic address and sends NO email', async () => {
    const result = await adminCreateManualBooking(
      {
        barberId,
        serviceSlug,
        startAtUtc: MON_10_UTC.toISOString(),
        firstName: 'Walk',
        lastName: 'In',
        locale: 'nl',
      },
      OWNER,
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const [cust] = await sql<{ email: string; email_missing: boolean }[]>`
      SELECT email, email_missing FROM customers WHERE id =
        (SELECT customer_id FROM appointments WHERE id = ${result.appointment.id})
    `
    expect(cust.email_missing).toBe(true)
    expect(cust.email).toMatch(/^manual\+.*@no-email\.kameraad\.local$/)

    // No email logged for this appointment.
    const logs = await sql`SELECT id FROM email_log WHERE appointment_id = ${result.appointment.id}`
    expect(logs).toHaveLength(0)

    // Audit written.
    const audits = await sql`SELECT id FROM audit_log WHERE actor = ${ACTOR_EMAIL} AND action = 'manual_booking'`
    expect(audits.length).toBeGreaterThanOrEqual(1)
  })
})

describe('adminCancel notify=false (FR-051)', () => {
  it('cancels the appointment and suppresses the cancellation email', async () => {
    const { apptId } = await seedConfirmed(new Date('2026-06-15T09:00:00.000Z'), 'cancel-noemail')

    const result = await adminCancel(apptId, OWNER, { notify: false, reason: 'test reason' })
    expect(result.ok).toBe(true)

    const [row] = await sql<{ status: string; cancellation_reason: string }[]>`
      SELECT status, cancellation_reason FROM appointments WHERE id = ${apptId}
    `
    expect(row.status).toBe('cancelled')
    expect(row.cancellation_reason).toBe('test reason')

    const logs = await sql`SELECT id FROM email_log WHERE appointment_id = ${apptId}`
    expect(logs).toHaveLength(0)
  })
})

describe('toggleNoShow (FR-053 / D14)', () => {
  it('is blocked before the slot start (TOO_EARLY)', async () => {
    // Far-future appointment → now < start.
    const { apptId } = await seedConfirmed(new Date('2026-12-21T09:00:00.000Z'), 'noshow-early')
    const result = await toggleNoShow(apptId, OWNER, new Date())
    expect(result).toEqual({ ok: false, code: 'TOO_EARLY' })
  })

  it('sets no_show and increments customers.no_show_count once started', async () => {
    // Past appointment → now >= start.
    const { apptId, customerId } = await seedConfirmed(new Date('2026-01-05T09:00:00.000Z'), 'noshow-ok')
    const before = await sql<{ no_show_count: number }[]>`SELECT no_show_count FROM customers WHERE id = ${customerId}`

    const result = await toggleNoShow(apptId, OWNER, new Date())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status).toBe('no_show')

    const [row] = await sql<{ status: string }[]>`SELECT status FROM appointments WHERE id = ${apptId}`
    expect(row.status).toBe('no_show')
    const [after] = await sql<{ no_show_count: number }[]>`SELECT no_show_count FROM customers WHERE id = ${customerId}`
    expect(after.no_show_count).toBe(before[0].no_show_count + 1)

    // Toggle back restores confirmed and decrements.
    const back = await toggleNoShow(apptId, OWNER, new Date())
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(back.status).toBe('confirmed')
    const [restored] = await sql<{ no_show_count: number }[]>`SELECT no_show_count FROM customers WHERE id = ${customerId}`
    expect(restored.no_show_count).toBe(before[0].no_show_count)
  })
})

describe('adminReschedule bumps ics_sequence (FR-071)', () => {
  it('a second reschedule yields ics_sequence = 2', async () => {
    // Confirmed at Mon 14:00 local (12:00Z), reschedule to 15:00 then 16:00.
    const { apptId } = await seedConfirmed(new Date('2026-06-15T12:00:00.000Z'), 'resched')

    const r1 = await adminReschedule(apptId, new Date('2026-06-15T13:00:00.000Z'), OWNER, {})
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.appointment.ics_sequence).toBe(1)

    const r2 = await adminReschedule(apptId, new Date('2026-06-15T14:00:00.000Z'), OWNER, {})
    expect(r2.ok).toBe(true)
    if (!r2.ok) return
    expect(r2.appointment.ics_sequence).toBe(2)
  })
})
