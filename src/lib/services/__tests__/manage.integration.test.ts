/**
 * Integration tests for the manage service (FR-030..034).
 * Runs against the real Postgres DB.
 * All test data is prefixed 'test-mng-' and cleaned up before+after.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import {
  getAppointmentByCancelToken,
  getAppointmentByRescheduleToken,
  canModify,
  cancelAppointment,
  rescheduleAppointment,
} from '../manage'
import { getOfferedSlots } from '../slots'

const DB_URL =
  process.env.DATABASE_URL ??
  `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`

const sql = postgres(DB_URL, { max: 5 })

const PREFIX = 'test-mng-'

// ─── Seed helpers ─────────────────────────────────────────────────────────────

interface SeedResult {
  barberId: string
  serviceId: string
  serviceSlug: string
  // Non-overlapping 1-hour slots on Monday 2026-06-15 (Brussels time).
  // Each test uses its own slot(s) so no cross-test appointment conflicts.
  slotToken: Date   // 10:00 Brussels — used by getAppointmentByCancelToken test
  slotCancelOk: Date   // 11:00 — cancel inside window (freed after)
  slotCancelBlocked: Date // 12:00 — cancel outside window (stays confirmed)
  slotIdempotent: Date    // 13:00 — cancel idempotent test
  slotRescheduleFrom: Date // 14:00 — reschedule FROM
  slotRescheduleTo: Date   // 15:00 — reschedule TO (no other test uses this)
  slotRescheduleBlocked: Date // 16:00 — reschedule outside window FROM
}

async function seed(): Promise<SeedResult> {
  // Monday 2026-06-15, non-overlapping 1-hour slots in Brussels (UTC+2 CEST)
  const H = 3_600_000
  const base = new Date('2026-06-15T08:00:00.000Z') // 10:00 Brussels
  const slotToken = base
  const slotCancelOk = new Date(base.getTime() + 1 * H)        // 11:00
  const slotCancelBlocked = new Date(base.getTime() + 2 * H)   // 12:00
  const slotIdempotent = new Date(base.getTime() + 3 * H)      // 13:00
  const slotRescheduleFrom = new Date(base.getTime() + 4 * H)  // 14:00
  const slotRescheduleTo = new Date(base.getTime() + 5 * H)    // 15:00
  const slotRescheduleBlocked = new Date(base.getTime() + 6 * H) // 16:00

  // Alias for backwards-compat with the test bodies
  const slotA = slotCancelOk
  const slotB = slotRescheduleTo
  void slotA; void slotB

  const barberSlug = PREFIX + 'barber'
  const serviceSlug = PREFIX + 'service'

  const [barber] = await sql`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${barberSlug}, ${'Manage Test Barber'}, true, 99)
    ON CONFLICT (slug) DO UPDATE SET is_active = true
    RETURNING id
  `

  const [service] = await sql`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${serviceSlug}, ${'Manage Test Service'}, ${'Manage Test Service'}, 60, 2500, true, false)
    ON CONFLICT (slug) DO UPDATE SET is_active = true, is_walk_in = false, duration_min = 60
    RETURNING id
  `

  await sql`
    INSERT INTO barber_services (barber_id, service_id)
    VALUES (${barber.id}, ${service.id})
    ON CONFLICT DO NOTHING
  `

  // Monday (dow=1) 09:00–18:00
  await sql`
    INSERT INTO availability (barber_id, day_of_week, start_time, end_time, is_active)
    VALUES (${barber.id}, 1, '09:00', '18:00', true)
    ON CONFLICT (barber_id, day_of_week, start_time) DO UPDATE SET is_active = true, end_time = '18:00'
  `

  // Ensure cancellation_window_hours is set to 24
  await sql`
    INSERT INTO settings (key, value) VALUES ('cancellation_window_hours', '24')
    ON CONFLICT (key) DO UPDATE SET value = '24'
  `

  return {
    barberId: barber.id,
    serviceId: service.id,
    serviceSlug,
    slotToken,
    slotCancelOk,
    slotCancelBlocked,
    slotIdempotent,
    slotRescheduleFrom,
    slotRescheduleTo,
    slotRescheduleBlocked,
  }
}

async function cleanup() {
  await sql`
    DELETE FROM appointments
    WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})
  `
  await sql`DELETE FROM email_log WHERE appointment_id IS NULL AND customer_id IS NULL`
  await sql`
    DELETE FROM barber_services
    WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})
    OR service_id IN (SELECT id FROM services WHERE slug LIKE ${PREFIX + '%'})
  `
  await sql`DELETE FROM availability WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
}

async function insertAppointment(
  barberId: string,
  serviceId: string,
  startAt: Date,
  endAt: Date,
): Promise<{ id: string; cancel_token: string; reschedule_token: string }> {
  // Insert a dummy customer first
  const email = `${PREFIX}${Date.now()}@example.com`
  const [cust] = await sql`
    INSERT INTO customers (first_name, last_name, email, preferred_language)
    VALUES (${'Test'}, ${'Manage'}, ${email}, 'nl')
    RETURNING id
  `
  const cancelToken = `ct-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  const rescheduleToken = `rt-${Date.now()}-${Math.floor(Math.random() * 1e9)}`
  const [appt] = await sql`
    INSERT INTO appointments
      (barber_id, service_id, customer_id, start_at, end_at, status, cancel_token, reschedule_token)
    VALUES
      (${barberId}, ${serviceId}, ${cust.id}, ${startAt.toISOString()}, ${endAt.toISOString()},
       'confirmed', ${cancelToken}, ${rescheduleToken})
    RETURNING id, cancel_token, reschedule_token
  `
  return appt as { id: string; cancel_token: string; reschedule_token: string }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let seed_: SeedResult

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch (err) {
    throw new Error(`Cannot connect to Postgres. Make sure the database is running.\n${String(err)}`)
  }
  await cleanup()
  seed_ = await seed()
})

afterAll(async () => {
  await cleanup()
  await sql.end()
})

// ─── getAppointmentByCancelToken ──────────────────────────────────────────────

describe('getAppointmentByCancelToken', () => {
  it('returns null for unknown token', async () => {
    const result = await getAppointmentByCancelToken('nonexistent-token')
    expect(result).toBeNull()
  })

  it('returns appointment detail for a valid token', async () => {
    const { barberId, serviceId, slotToken } = seed_
    const endAt = new Date(slotToken.getTime() + 60 * 60_000)
    const { cancel_token } = await insertAppointment(barberId, serviceId, slotToken, endAt)

    const detail = await getAppointmentByCancelToken(cancel_token)
    expect(detail).not.toBeNull()
    expect(detail!.appointment.cancel_token).toBe(cancel_token)
    expect(detail!.barber.id).toBe(barberId)
    expect(detail!.service.id).toBe(serviceId)
    expect(detail!.customer).toBeDefined()
  })
})

describe('getAppointmentByRescheduleToken', () => {
  it('returns null for unknown token', async () => {
    const result = await getAppointmentByRescheduleToken('nonexistent-token')
    expect(result).toBeNull()
  })
})

// ─── cancelAppointment ────────────────────────────────────────────────────────

describe('cancelAppointment — inside window (FR-030/031)', () => {
  it('sets status to cancelled and frees the slot', async () => {
    const { barberId, serviceId, serviceSlug, slotCancelOk } = seed_
    const endAt = new Date(slotCancelOk.getTime() + 60 * 60_000)
    const { cancel_token } = await insertAppointment(barberId, serviceId, slotCancelOk, endAt)

    // now is well before start_at − 24h window
    const now = new Date(slotCancelOk.getTime() - 48 * 3_600_000)

    const result = await cancelAppointment(cancel_token, now)
    expect(result).toEqual({ ok: true })

    // Verify DB state
    const [row] = await sql`SELECT status, cancelled_at FROM appointments
      WHERE cancel_token = ${cancel_token}`
    expect(row.status).toBe('cancelled')
    expect(row.cancelled_at).not.toBeNull()

    // Slot is now offered again via the slots service
    const fromDate = slotCancelOk.toISOString().slice(0, 10)
    const slots = await getOfferedSlots({ barberId, serviceSlug, fromDate, toDate: fromDate, now })
    expect(slots.some((s) => s.startAtUtc.getTime() === slotCancelOk.getTime())).toBe(true)
  })
})

describe('cancelAppointment — outside window (FR-034)', () => {
  it('returns OUTSIDE_WINDOW and leaves appointment unchanged', async () => {
    const { barberId, serviceId, slotCancelBlocked } = seed_
    const endAt = new Date(slotCancelBlocked.getTime() + 60 * 60_000)
    const { cancel_token } = await insertAppointment(barberId, serviceId, slotCancelBlocked, endAt)

    // now is only 20h before start_at (inside 24h block zone)
    const now = new Date(slotCancelBlocked.getTime() - 20 * 3_600_000)

    const result = await cancelAppointment(cancel_token, now)
    expect(result).toMatchObject({ ok: false, code: 'OUTSIDE_WINDOW' })

    const [row] = await sql`SELECT status FROM appointments WHERE cancel_token = ${cancel_token}`
    expect(row.status).toBe('confirmed')
  })
})

describe('cancelAppointment — idempotent (FR-031)', () => {
  it('returns ALREADY_CANCELLED on second call', async () => {
    const { barberId, serviceId, slotIdempotent } = seed_
    const endAt = new Date(slotIdempotent.getTime() + 60 * 60_000)
    const { cancel_token } = await insertAppointment(barberId, serviceId, slotIdempotent, endAt)

    const now = new Date(slotIdempotent.getTime() - 48 * 3_600_000)

    const first = await cancelAppointment(cancel_token, now)
    expect(first).toEqual({ ok: true })

    const second = await cancelAppointment(cancel_token, now)
    expect(second).toEqual({ ok: false, code: 'ALREADY_CANCELLED' })
  })
})

// ─── rescheduleAppointment ────────────────────────────────────────────────────

describe('rescheduleAppointment — inside window (FR-032)', () => {
  it('moves appointment atomically and old slot becomes bookable', async () => {
    const { barberId, serviceId, serviceSlug, slotRescheduleFrom, slotRescheduleTo } = seed_
    const endFrom = new Date(slotRescheduleFrom.getTime() + 60 * 60_000)
    const { reschedule_token } = await insertAppointment(
      barberId, serviceId, slotRescheduleFrom, endFrom,
    )

    // now is well before original start_at − 24h
    const now = new Date(slotRescheduleFrom.getTime() - 48 * 3_600_000)

    const result = await rescheduleAppointment(reschedule_token, slotRescheduleTo, now)
    expect(result).toMatchObject({ ok: true })
    if (!result.ok) return

    expect(new Date(result.appointment.start_at).getTime()).toBe(slotRescheduleTo.getTime())

    // Old slot (slotRescheduleFrom) should now be offered again
    const fromDate = slotRescheduleFrom.toISOString().slice(0, 10)
    const slots = await getOfferedSlots({ barberId, serviceSlug, fromDate, toDate: fromDate, now })
    expect(
      slots.some((s) => s.startAtUtc.getTime() === slotRescheduleFrom.getTime()),
      'old slot should be offered again after reschedule',
    ).toBe(true)
  })
})

describe('rescheduleAppointment — outside window', () => {
  it('returns OUTSIDE_WINDOW based on ORIGINAL start (FR-032)', async () => {
    const { barberId, serviceId, slotRescheduleBlocked, slotRescheduleTo } = seed_
    const endBlocked = new Date(slotRescheduleBlocked.getTime() + 60 * 60_000)
    const { reschedule_token } = await insertAppointment(
      barberId, serviceId, slotRescheduleBlocked, endBlocked,
    )

    // now is only 20h before slotRescheduleBlocked (inside 24h window)
    const now = new Date(slotRescheduleBlocked.getTime() - 20 * 3_600_000)

    const result = await rescheduleAppointment(reschedule_token, slotRescheduleTo, now)
    expect(result).toMatchObject({ ok: false, code: 'OUTSIDE_WINDOW' })
  })
})

describe('rescheduleAppointment — unknown token', () => {
  it('returns NOT_FOUND', async () => {
    const result = await rescheduleAppointment('no-such-token', new Date(), new Date())
    expect(result).toEqual({ ok: false, code: 'NOT_FOUND' })
  })
})

// ─── canModify — boundary ─────────────────────────────────────────────────────

describe('canModify boundary (pure, no DB)', () => {
  const NOW_PURE = new Date('2026-06-10T12:00:00.000Z')
  const H_PURE = 3_600_000

  function apptAt(offsetMs: number) {
    return {
      id: 'a',
      barber_id: 'b',
      service_id: 's',
      customer_id: 'c',
      start_at: new Date(NOW_PURE.getTime() + offsetMs).toISOString(),
      end_at: '',
      status: 'confirmed' as const,
      customer_notes: null,
      admin_notes: null,
      cancel_token: null,
      reschedule_token: null,
      cancelled_at: null,
      cancellation_reason: null,
      created_at: '',
      updated_at: '',
    }
  }

  it('exactly at boundary (now === start − window) → NOT modifiable', () => {
    expect(canModify(apptAt(24 * H_PURE), NOW_PURE, 24)).toBe(false)
  })

  it('1ms before boundary → modifiable', () => {
    const oneMsBefore = new Date(NOW_PURE.getTime() - 1)
    expect(canModify(apptAt(24 * H_PURE), oneMsBefore, 24)).toBe(true)
  })

  it('1ms after boundary → NOT modifiable', () => {
    const oneMs = new Date(NOW_PURE.getTime() + 1)
    expect(canModify(apptAt(24 * H_PURE), oneMs, 24)).toBe(false)
  })
})
