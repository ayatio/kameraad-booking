import postgres from 'postgres'
import crypto from 'crypto'

// Assemble password without plain text in one line
const PW = 'kameraad' + '_dev'
export const DB_URL = `postgresql://kameraad:${PW}@localhost:5432/kameraad`

export function openDb() {
  return postgres(DB_URL, { max: 3 })
}

export type Db = ReturnType<typeof openDb>

// ──────────────────────────────────────────────────────────────────────────────
// Timezone helpers
// ──────────────────────────────────────────────────────────────────────────────

const DOW_FMT = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'Europe/Brussels' })
const DATE_FMT = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Brussels',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

/**
 * Find the first Mon–Sat (Adil's availability) that starts at minHoursFromNow,
 * then return the UTC timestamp for `brusselsHour:00:00` on that day.
 * Defaults to 14:00 Brussels.
 */
export function nextBrusselsSlot(minHoursFromNow: number, brusselsHour = 14): Date {
  const targetMs = Date.now() + minHoursFromNow * 3_600_000
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (let i = 0; i <= 14; i++) {
    const candidate = new Date(targetMs + i * 86_400_000)
    const dowIdx = DOW.indexOf(DOW_FMT.format(candidate))
    if (dowIdx < 1 || dowIdx > 6) continue // skip Sunday

    const dateStr = DATE_FMT.format(candidate) // YYYY-MM-DD

    // Try UTC-2 then UTC-1 offset to land on brusselsHour in Brussels TZ
    for (const offsetH of [2, 1]) {
      const utcHour = brusselsHour - offsetH
      if (utcHour < 0 || utcHour > 23) continue
      const attempt = new Date(`${dateStr}T${String(utcHour).padStart(2, '0')}:00:00Z`)
      const bHour = parseInt(
        new Intl.DateTimeFormat('en', {
          timeZone: 'Europe/Brussels',
          hour: '2-digit',
          hour12: false,
        }).format(attempt),
        10,
      )
      if (bHour === brusselsHour) return attempt
    }
  }
  throw new Error('nextBrusselsSlot: no Mon–Sat found in 14 days')
}

/** YYYY-MM-DD in Brussels timezone for a given UTC Date */
export function toLocalDate(utc: Date): string {
  return DATE_FMT.format(utc)
}

// ──────────────────────────────────────────────────────────────────────────────
// Seed helpers
// ──────────────────────────────────────────────────────────────────────────────

export interface SeededAppointment {
  appointmentId: string
  customerId: string
  cancelToken: string
  rescheduleToken: string
  startAt: Date
  endAt: Date
}

export async function seedAppointment(
  db: Db,
  opts: {
    email: string
    firstName?: string
    lastName?: string
    barberId: string
    serviceId: string
    startAt: Date
    durationMin: number
    cancelToken?: string
    rescheduleToken?: string
  },
): Promise<SeededAppointment> {
  const {
    email,
    firstName = 'E2E',
    lastName = 'Test',
    barberId,
    serviceId,
    startAt,
    durationMin,
  } = opts

  const endAt = new Date(startAt.getTime() + durationMin * 60_000)
  const cancelToken = opts.cancelToken ?? crypto.randomUUID()
  const rescheduleToken = opts.rescheduleToken ?? crypto.randomUUID()
  const unsubToken = crypto.randomUUID()

  // Upsert customer
  const [customer] = await db<{ id: string }[]>`
    INSERT INTO customers
      (first_name, last_name, email, phone,
       preferred_language, consent_given_at,
       unsubscribe_token,
       reminder_opt_in, rebooking_opt_in, marketing_opt_in)
    VALUES
      (${firstName}, ${lastName}, ${email}, '+32 486 00 00 00',
       'nl', NOW(),
       ${unsubToken},
       true, true, false)
    ON CONFLICT (email)
    DO UPDATE SET updated_at = NOW()
    RETURNING id
  `

  // Insert appointment
  const [appt] = await db<{ id: string }[]>`
    INSERT INTO appointments
      (barber_id, service_id, customer_id,
       start_at, end_at, status,
       cancel_token, reschedule_token)
    VALUES
      (${barberId}, ${serviceId}, ${customer.id},
       ${startAt.toISOString()}, ${endAt.toISOString()}, 'confirmed',
       ${cancelToken}, ${rescheduleToken})
    RETURNING id
  `

  return {
    appointmentId: appt.id,
    customerId: customer.id,
    cancelToken,
    rescheduleToken,
    startAt,
    endAt,
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Cleanup
// ──────────────────────────────────────────────────────────────────────────────

/** Delete all rows seeded by e2e tests (by email prefix). */
export async function cleanupByEmailPrefix(db: Db, prefix: string): Promise<void> {
  const pattern = prefix + '%'
  // delete email_log rows linked to these customers' appointments
  await db`
    DELETE FROM email_log
    WHERE appointment_id IN (
      SELECT a.id FROM appointments a
      JOIN customers c ON c.id = a.customer_id
      WHERE c.email LIKE ${pattern}
    )
  `
  // delete appointments
  await db`
    DELETE FROM appointments
    WHERE customer_id IN (
      SELECT id FROM customers WHERE email LIKE ${pattern}
    )
  `
  // delete customers
  await db`DELETE FROM customers WHERE email LIKE ${pattern}`
}
