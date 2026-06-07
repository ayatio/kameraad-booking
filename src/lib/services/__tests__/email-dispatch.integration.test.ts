/**
 * Integration smoke test for email-dispatch against the real Postgres DB.
 * Uses DryRun transport (no RESEND_API_KEY needed).
 * All test data is prefixed 'test-cron-' and cleaned up before+after.
 *
 * Run with: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { runDispatch } from '../email-dispatch'

const DB_URL =
  process.env.DATABASE_URL ??
  `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`

const sql = postgres(DB_URL, { max: 5 })

const PREFIX = 'test-cron-'

// ─── Seed / cleanup ───────────────────────────────────────────────────────────

interface SeedResult {
  barberId: string
  serviceId: string
  customerId: string
  appointmentId: string
}

async function seed(): Promise<SeedResult> {
  const now = new Date()
  // Appointment 23h from now — squarely in the 24h reminder window
  const startAt = new Date(now.getTime() + 23 * 60 * 60 * 1000)
  const endAt = new Date(startAt.getTime() + 30 * 60 * 1000)
  // created_at 48h ago so it satisfies: created_at ≤ start_at − 24h
  const createdAt = new Date(now.getTime() - 48 * 60 * 60 * 1000)

  const [barber] = await sql`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${PREFIX + 'barber'}, ${'Cron Test Barber'}, true, 99)
    ON CONFLICT (slug) DO UPDATE SET is_active = true
    RETURNING id
  `

  const [service] = await sql`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${PREFIX + 'service'}, ${'Cron Test Service'}, ${'Cron Test Service'}, 30, 2500, true, false)
    ON CONFLICT (slug) DO UPDATE SET is_active = true
    RETURNING id
  `

  await sql`
    INSERT INTO barber_services (barber_id, service_id)
    VALUES (${barber.id}, ${service.id})
    ON CONFLICT DO NOTHING
  `

  const [customer] = await sql`
    INSERT INTO customers
      (first_name, last_name, email, reminder_opt_in, rebooking_opt_in, marketing_opt_in,
       preferred_language, consent_given_at)
    VALUES
      ('Cron', 'Tester', ${PREFIX + 'customer@example.com'},
       true, true, false, 'nl', NOW())
    ON CONFLICT (email) DO UPDATE SET reminder_opt_in = true
    RETURNING id
  `

  const [appointment] = await sql`
    INSERT INTO appointments
      (barber_id, service_id, customer_id, start_at, end_at, status, created_at, updated_at)
    VALUES
      (${barber.id}, ${service.id}, ${customer.id},
       ${startAt.toISOString()}, ${endAt.toISOString()},
       'confirmed', ${createdAt.toISOString()}, ${createdAt.toISOString()})
    RETURNING id
  `

  return {
    barberId: barber.id,
    serviceId: service.id,
    customerId: customer.id,
    appointmentId: appointment.id,
  }
}

async function cleanup() {
  // email_log rows for the test appointment
  await sql`
    DELETE FROM email_log
    WHERE appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      WHERE c.email LIKE ${PREFIX + '%'}
    )
  `
  await sql`
    DELETE FROM appointments
    WHERE customer_id IN (SELECT id FROM customers WHERE email LIKE ${PREFIX + '%'})
  `
  await sql`DELETE FROM customers WHERE email LIKE ${PREFIX + '%'}`
  await sql`
    DELETE FROM barber_services
    WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})
       OR service_id IN (SELECT id FROM services WHERE slug LIKE ${PREFIX + '%'})
  `
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
}

// ─── Test state ───────────────────────────────────────────────────────────────

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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FR-070: cron dispatch idempotency smoke test', () => {
  it('first run: sends exactly 1 reminder_24h email', async () => {
    const counts = await runDispatch({ now: new Date() })

    expect(counts.reminder_24h.sent).toBe(1)
    expect(counts.reminder_24h.skipped).toBe(0)

    const rows = await sql<{ id: string; status: string }[]>`
      SELECT id, status FROM email_log
      WHERE appointment_id = ${seed_.appointmentId}
        AND email_type = 'reminder_24h'
        AND status = 'sent'
    `
    expect(rows).toHaveLength(1)
  })

  it('second run: no new sends — exactly 1 email_log row total', async () => {
    const counts = await runDispatch({ now: new Date() })

    // Real DB has NOT EXISTS filter; second run finds no candidates
    expect(counts.reminder_24h.sent).toBe(0)
    expect(counts.reminder_24h.skipped).toBe(0)

    const rows = await sql<{ id: string }[]>`
      SELECT id FROM email_log
      WHERE appointment_id = ${seed_.appointmentId}
        AND email_type = 'reminder_24h'
        AND status = 'sent'
    `
    expect(rows).toHaveLength(1)
  })
})
