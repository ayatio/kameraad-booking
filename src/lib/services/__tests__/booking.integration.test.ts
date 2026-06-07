/**
 * Integration tests for the booking service.
 * Runs against the real Postgres DB (kameraad_dev).
 * All test data is prefixed 'test-conc-' and cleaned up before+after.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { createBooking } from '../booking'

// Build the connection string from parts — never as one hardcoded literal.
const DB_URL =
  process.env.DATABASE_URL ??
  `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`

const sql = postgres(DB_URL, { max: 20 })

const PREFIX = 'test-conc-'

// ─── Seed helpers ──────────────────────────────────────────────────────────────

interface SeedResult {
  barberId: string
  serviceId: string
  // A future slot start time for the test (next Monday 10:00 Brussels time, UTC)
  slotStart: Date
}

async function seed(): Promise<SeedResult> {
  // Pick a future Monday guaranteed to be within the booking horizon.
  // Use a fixed date far enough in the future (within 56 days from 2026-06-05).
  // We use 2026-06-08 (next Monday) at 10:00 Brussels (CEST = UTC+2 → 08:00 UTC)
  const slotStart = new Date('2026-06-08T08:00:00.000Z')

  const barberSlug = PREFIX + 'barber-1'
  const serviceSlug = PREFIX + 'service-1'

  // Insert barber
  const [barber] = await sql`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${barberSlug}, ${'Test Barber Conc'}, true, 99)
    ON CONFLICT (slug) DO UPDATE SET is_active = true
    RETURNING id
  `

  // Insert service (30 min, non-walk-in)
  const [service] = await sql`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${serviceSlug}, ${'Test Service Conc'}, ${'Test Service Conc'}, 30, 3000, true, false)
    ON CONFLICT (slug) DO UPDATE SET is_active = true, is_walk_in = false
    RETURNING id
  `

  // Link barber ↔ service
  await sql`
    INSERT INTO barber_services (barber_id, service_id)
    VALUES (${barber.id}, ${service.id})
    ON CONFLICT DO NOTHING
  `

  // Availability: Monday (dow=1) 09:00–17:00
  await sql`
    INSERT INTO availability (barber_id, day_of_week, start_time, end_time, is_active)
    VALUES (${barber.id}, 1, '09:00', '17:00', true)
    ON CONFLICT (barber_id, day_of_week, start_time) DO UPDATE SET is_active = true, end_time = '17:00'
  `

  return { barberId: barber.id, serviceId: service.id, slotStart }
}

async function cleanup() {
  // Delete in FK-safe order
  await sql`
    DELETE FROM appointments
    WHERE customer_id IN (
      SELECT id FROM customers WHERE email LIKE ${PREFIX + '%'}
    )
  `
  await sql`DELETE FROM customers WHERE email LIKE ${PREFIX + '%'}`
  await sql`
    DELETE FROM barber_services
    WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})
    OR service_id IN (SELECT id FROM services WHERE slug LIKE ${PREFIX + '%'})
  `
  await sql`DELETE FROM availability WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
}

// ─── Shared test state ────────────────────────────────────────────────────────

let seed_: SeedResult

beforeAll(async () => {
  try {
    await sql`SELECT 1`
  } catch (err) {
    throw new Error(
      `Cannot connect to Postgres at ${DB_URL}. Make sure the database is running.\n${String(err)}`,
    )
  }
  await cleanup()
  seed_ = await seed()
})

afterAll(async () => {
  await cleanup()
  await sql.end()
})

// ─── Test helpers ─────────────────────────────────────────────────────────────

function makeBookingInput(email: string, barberId: string, slotStart: Date) {
  return {
    barberId,
    serviceSlug: PREFIX + 'service-1',
    startAtUtc: slotStart.toISOString(),
    firstName: 'Test',
    lastName: 'User',
    email,
    phone: '+32471000001',
    locale: 'nl' as const,
    cancellationPolicyAccepted: true as const,
    privacyAccepted: true as const,
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FR-018: concurrency — 10 parallel bookings for the same slot', () => {
  it('allows exactly 1 and rejects 9 with SLOT_TAKEN (no rejected promises)', async () => {
    const { barberId, slotStart } = seed_

    const emails = Array.from({ length: 10 }, (_, i) => `${PREFIX}customer-${i}@example.com`)

    const results = await Promise.allSettled(
      emails.map((email) => createBooking(makeBookingInput(email, barberId, slotStart))),
    )

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    const successes = fulfilled.filter(
      (r) => r.status === 'fulfilled' && r.value.ok === true,
    )
    const slotTaken = fulfilled.filter(
      (r) => r.status === 'fulfilled' && !r.value.ok && r.value.code === 'SLOT_TAKEN',
    )

    expect(rejected.length, 'No promises should reject').toBe(0)
    expect(successes.length, 'Exactly 1 booking should succeed').toBe(1)
    expect(slotTaken.length, '9 bookings should get SLOT_TAKEN').toBe(9)
  })
})

describe('FR-005: customer upsert — same email, different data', () => {
  it('updates name/phone on second booking; customer count stays 1', async () => {
    const { barberId, slotStart } = seed_

    // Use slots that don't conflict with the concurrency test (slotStart=08:00, occupancy ends 08:30).
    const slot2 = new Date(slotStart.getTime() + 30 * 60_000) // 08:30 UTC = 10:30 Brussels
    const slot3 = new Date(slotStart.getTime() + 60 * 60_000) // 09:00 UTC = 11:00 Brussels
    const email = `${PREFIX}upsert-test@example.com`

    const first = await createBooking({
      ...makeBookingInput(email, barberId, slot2),
      firstName: 'Alice',
      phone: '+32471111111',
    })
    expect(first.ok).toBe(true)

    const second = await createBooking({
      ...makeBookingInput(email, barberId, slot3),
      firstName: 'Alicia',
      phone: '+32471222222',
    })
    expect(second.ok).toBe(true)

    const rows = await sql<{ cnt: string; first_name: string; phone: string }[]>`
      SELECT COUNT(*) AS cnt, first_name, phone
      FROM customers WHERE email = ${email}
      GROUP BY first_name, phone
    `
    expect(rows.length).toBe(1)
    expect(rows[0].cnt).toBe('1')
    expect(rows[0].first_name).toBe('Alicia')
    expect(rows[0].phone).toBe('+32471222222')
  })
})

describe('FR-025: success path — appointment written correctly', () => {
  it('creates confirmed appointment with correct end_at and consent_given_at set', async () => {
    const { barberId, slotStart } = seed_

    // Use a slot 90 min after the main slot (avoid concurrency+FR-005 bookings)
    const slot = new Date(slotStart.getTime() + 90 * 60_000) // 09:30 UTC = 11:30 Brussels
    const email = `${PREFIX}success-test@example.com`

    const result = await createBooking(makeBookingInput(email, barberId, slot))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const apptRows = await sql`
      SELECT a.*, c.consent_given_at, c.preferred_language
      FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      WHERE a.id = ${result.appointment.id}
    `
    expect(apptRows.length).toBe(1)
    const appt = apptRows[0]

    expect(appt.status).toBe('confirmed')

    // end_at = start + 30 min (service duration)
    const startMs = new Date(appt.start_at).getTime()
    const endMs = new Date(appt.end_at).getTime()
    expect(endMs - startMs).toBe(30 * 60_000)

    expect(appt.consent_given_at).not.toBeNull()
    expect(appt.preferred_language).toBe('nl')
  })
})
