/**
 * Integration tests for GDPR purge (FR-058 / FR-080..083).
 * Real Postgres. Data prefixed 'test-adm-crm-'. Run: npm run test:integration
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import postgres from 'postgres'
import { purgeCustomer } from '../admin-crm'
import type { AdminActor } from '../actor'

const DB_URL = `postgresql://kameraad:${'kameraad' + '_dev'}@localhost:5432/kameraad`
const sql = postgres(DB_URL, { max: 5 })

const PREFIX = 'test-adm-crm-'
const ACTOR_EMAIL = 'test-adm-crm-owner@example.com'
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
    await sql`DELETE FROM email_log WHERE appointment_id IN (SELECT id FROM appointments WHERE barber_id = ANY(${bIds}))`
    await sql`DELETE FROM appointments WHERE barber_id = ANY(${bIds})`
    if (custIds.length > 0) {
      await sql`DELETE FROM email_log WHERE customer_id = ANY(${custIds})`
      await sql`DELETE FROM customers WHERE id = ANY(${custIds})`
    }
  }
  await sql`DELETE FROM customers WHERE email LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barber_services WHERE barber_id IN (SELECT id FROM barbers WHERE slug LIKE ${PREFIX + '%'})`
  await sql`DELETE FROM services WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM barbers WHERE slug LIKE ${PREFIX + '%'}`
  await sql`DELETE FROM audit_log WHERE actor = ${ACTOR_EMAIL}`
}

async function seedCustomerWithData(suffix: string, start: Date): Promise<string> {
  const [cust] = await sql<{ id: string }[]>`
    INSERT INTO customers (first_name, last_name, email, phone, preferred_language)
    VALUES (${'Purge'}, ${'Me'}, ${PREFIX + suffix + '@example.com'}, ${'+32470000000'}, 'nl')
    RETURNING id
  `
  const [appt] = await sql<{ id: string }[]>`
    INSERT INTO appointments (barber_id, service_id, customer_id, start_at, end_at, status)
    VALUES (${barberId}, ${serviceId}, ${cust.id}, ${start.toISOString()}, ${new Date(start.getTime() + 3_600_000).toISOString()}, 'completed')
    RETURNING id
  `
  await sql`
    INSERT INTO email_log (appointment_id, customer_id, email_type, to_email, subject, sent_at, status)
    VALUES (${appt.id}, ${cust.id}, 'confirmation', ${PREFIX + suffix + '@example.com'}, 'Test', NOW(), 'sent')
  `
  return cust.id
}

beforeAll(async () => {
  await sql`SELECT 1`
  await cleanup()
  const [barber] = await sql<{ id: string }[]>`
    INSERT INTO barbers (slug, name, is_active, sort_order)
    VALUES (${PREFIX + 'barber'}, ${'Crm Barber'}, true, 92) RETURNING id
  `
  const [service] = await sql<{ id: string }[]>`
    INSERT INTO services (slug, name_nl, name_en, duration_min, price_cents, is_active, is_walk_in)
    VALUES (${PREFIX + 'svc'}, ${'Crm Svc'}, ${'Crm Svc'}, 60, 2500, true, false) RETURNING id
  `
  barberId = barber.id
  serviceId = service.id
})

afterAll(async () => {
  await cleanup()
  await sql.end()
})

describe('purgeCustomer (FR-058/080..083)', () => {
  it('rejects a wrong confirmation phrase and deletes nothing', async () => {
    const custId = await seedCustomerWithData('wrong', new Date('2026-01-05T09:00:00.000Z'))
    const result = await purgeCustomer(custId, OWNER, 'verwijder') // wrong case
    expect(result).toEqual({ ok: false, code: 'CONFIRM_MISMATCH' })

    const rows = await sql`SELECT id FROM customers WHERE id = ${custId}`
    expect(rows).toHaveLength(1) // still there
  })

  it('with "VERWIJDER" leaves zero PII and writes exactly one audit event', async () => {
    const custId = await seedCustomerWithData('right', new Date('2026-01-05T11:00:00.000Z'))

    const result = await purgeCustomer(custId, OWNER, 'VERWIJDER')
    expect(result).toEqual({ ok: true })

    // Zero rows for the customer across all three tables.
    const cust = await sql`SELECT id FROM customers WHERE id = ${custId}`
    const appts = await sql`SELECT id FROM appointments WHERE customer_id = ${custId}`
    const logs = await sql`SELECT id FROM email_log WHERE customer_id = ${custId}`
    expect(cust).toHaveLength(0)
    expect(appts).toHaveLength(0)
    expect(logs).toHaveLength(0)

    // Exactly ONE gdpr_delete audit event (the function is the sole writer).
    const audits = await sql`
      SELECT payload FROM audit_log WHERE actor = ${ACTOR_EMAIL} AND action = 'gdpr_delete'
    `
    expect(audits).toHaveLength(1)
    // PII-free payload: a hash, not the email/name.
    const payload = audits[0].payload as Record<string, unknown>
    expect(payload).toHaveProperty('customer_id_hash')
    expect(JSON.stringify(payload)).not.toContain(PREFIX)
  })
})
