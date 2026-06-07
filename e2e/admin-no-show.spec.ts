/**
 * admin-no-show.spec.ts — PHASES box 5 (D14: no-show only after start time).
 * Desktop-chromium only.
 *
 * D14: a no-show can only be set AFTER the appointment's start. The server is
 * the source of truth (the drawer toggle mirrors this) — a future appointment
 * is rejected with 409 too_early; a past one toggles to no_show and bumps the
 * customer's no_show_count.
 */
import { test, expect } from '@playwright/test'
import {
  openDb,
  seedAppointment,
  cleanupByEmailPrefix,
  nextBrusselsSlot,
  type Db,
} from './helpers/db'
import { seedAdmin, loginAs, cleanupAdmins } from './helpers/admin'

const ADMIN_PREFIX = 'e2e-admin-'
const OWNER_EMAIL = 'e2e-admin-owner-noshow@example.com'
const PASSWORD = 'noshow-passw0rd-xyz'
const CUST_PREFIX = 'e2e-admin-noshow-'

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

test('no-show: future appointment rejected (too_early); past appointment toggles + increments', async ({
  page,
}) => {
  await loginAs(page, OWNER_EMAIL, PASSWORD)

  // ── Future appointment → no-show unavailable (409 too_early) ────────────────
  const future = await seedAppointment(db, {
    email: `${CUST_PREFIX}future-${Date.now()}@example.com`,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: nextBrusselsSlot(72, 9),
    durationMin: 40,
  })
  const earlyRes = await page.request.post(`/api/admin/bookings/${future.appointmentId}/no-show`)
  expect(earlyRes.status(), 'future appointment cannot be marked no-show').toBe(409)
  expect((await earlyRes.json()).error).toBe('too_early')

  // ── Past appointment → no-show allowed; status + no_show_count update ────────
  const start = new Date(Date.now() - 2 * 60 * 60 * 1000) // 2h ago
  const past = await seedAppointment(db, {
    email: `${CUST_PREFIX}past-${Date.now()}@example.com`,
    barberId: ADIL_ID,
    serviceId: HAIRCUT_ID,
    startAt: start,
    durationMin: 40,
  })

  const [before] = await db<{ no_show_count: number }[]>`
    SELECT no_show_count FROM customers WHERE id = ${past.customerId}
  `

  const okRes = await page.request.post(`/api/admin/bookings/${past.appointmentId}/no-show`)
  expect(okRes.status(), 'past appointment can be marked no-show').toBe(200)
  const body = (await okRes.json()) as { status: string; noShowCount: number }
  expect(body.status).toBe('no_show')

  const [appt] = await db<{ status: string }[]>`
    SELECT status FROM appointments WHERE id = ${past.appointmentId}
  `
  expect(appt.status).toBe('no_show')

  const [after] = await db<{ no_show_count: number }[]>`
    SELECT no_show_count FROM customers WHERE id = ${past.customerId}
  `
  expect(after.no_show_count, 'no_show_count incremented by 1').toBe(before.no_show_count + 1)
})
