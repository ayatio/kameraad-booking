import db from '../db/index'
import type { Appointment, Customer, Barber, Service } from '../db/types'
import { sendAppointmentEmail } from '../email/send'
import type { SendEmailParams, SendEmailResult } from '../email/send'

export interface CandidateRow {
  appointment: Appointment
  customer: Customer
  barber: Barber
  service: Service
}

export interface DispatchDb {
  getReminderCandidates(type: 'reminder_24h' | 'reminder_2h', now: Date): Promise<CandidateRow[]>
  getRebookingCandidates(cutoff: Date): Promise<CandidateRow[]>
  getRebookingWeeks(): Promise<number>
  customerHasFutureBooking(customerId: string, after: Date): Promise<boolean>
}

export interface DispatchCounts {
  reminder_24h: { sent: number; skipped: number }
  reminder_2h: { sent: number; skipped: number }
  rebooking: { sent: number; skipped: number }
}

export type SendFn = (params: SendEmailParams) => Promise<SendEmailResult>

async function batchFetchDeps(appts: Appointment[]): Promise<CandidateRow[]> {
  if (!appts.length) return []

  const customerIds = [...new Set(appts.map(a => a.customer_id))]
  const barberIds = [...new Set(appts.map(a => a.barber_id))]
  const serviceIds = [...new Set(appts.map(a => a.service_id))]

  const [customers, barbers, services] = await Promise.all([
    db<Customer[]>`SELECT * FROM customers WHERE id = ANY(${customerIds})`,
    db<Barber[]>`SELECT * FROM barbers WHERE id = ANY(${barberIds})`,
    db<Service[]>`SELECT * FROM services WHERE id = ANY(${serviceIds})`,
  ])

  const cm = new Map(customers.map(c => [c.id, c]))
  const bm = new Map(barbers.map(b => [b.id, b]))
  const sm = new Map(services.map(s => [s.id, s]))

  return appts.flatMap(a => {
    const customer = cm.get(a.customer_id)
    const barber = bm.get(a.barber_id)
    const service = sm.get(a.service_id)
    if (!customer || !barber || !service) return []
    return [{ appointment: a, customer, barber, service }]
  })
}

const realDb: DispatchDb = {
  async getReminderCandidates(type, now) {
    const windowMs = type === 'reminder_24h' ? 24 * 60 * 60 * 1000 : 2 * 60 * 60 * 1000
    const windowEnd = new Date(now.getTime() + windowMs)

    const appts = await db<Appointment[]>`
      SELECT a.*
      FROM appointments a
      WHERE a.status = 'confirmed'
        AND a.start_at > ${now.toISOString()}
        AND a.start_at <= ${windowEnd.toISOString()}
        AND NOT EXISTS (
          SELECT 1 FROM email_log el
          WHERE el.appointment_id = a.id
            AND el.email_type = ${type}
            AND el.status = 'sent'
        )
    `

    // JS-side filter: booking must have been created at least windowMs before start_at
    const filtered = appts.filter(a => {
      const startMs = new Date(a.start_at).getTime()
      const createdMs = new Date(a.created_at).getTime()
      return createdMs <= startMs - windowMs
    })

    return batchFetchDeps(filtered)
  },

  async getRebookingCandidates(cutoff) {
    const appts = await db<Appointment[]>`
      SELECT a.*
      FROM appointments a
      WHERE a.status = 'completed'
        AND a.start_at <= ${cutoff.toISOString()}
        AND NOT EXISTS (
          SELECT 1 FROM email_log el
          WHERE el.appointment_id = a.id
            AND el.email_type = 'rebooking'
            AND el.status = 'sent'
        )
    `
    return batchFetchDeps(appts)
  },

  async getRebookingWeeks() {
    const row = await db<{ value: unknown }[]>`
      SELECT value FROM settings WHERE key = 'rebooking_weeks' LIMIT 1
    `
    return row.length > 0 ? Number(row[0].value) : 5
  },

  async customerHasFutureBooking(customerId, after) {
    const rows = await db<{ id: string }[]>`
      SELECT id FROM appointments
      WHERE customer_id = ${customerId}
        AND status NOT IN ('cancelled', 'no_show')
        AND start_at > ${after.toISOString()}
      LIMIT 1
    `
    return rows.length > 0
  },
}

export async function runDispatch(opts: {
  now: Date
  db?: DispatchDb
  send?: SendFn
}): Promise<DispatchCounts> {
  const { now, db: dispatchDb = realDb, send = sendAppointmentEmail } = opts

  const counts: DispatchCounts = {
    reminder_24h: { sent: 0, skipped: 0 },
    reminder_2h: { sent: 0, skipped: 0 },
    rebooking: { sent: 0, skipped: 0 },
  }

  for (const type of ['reminder_24h', 'reminder_2h'] as const) {
    const candidates = await dispatchDb.getReminderCandidates(type, now)
    for (const { appointment, customer, barber, service } of candidates) {
      if (!customer.reminder_opt_in) {
        counts[type].skipped++
        continue
      }
      try {
        const result = await send({ type, appointment, customer, barber, service })
        if (result.skipped) counts[type].skipped++
        else counts[type].sent++
      } catch {
        counts[type].skipped++
      }
    }
  }

  const rebookingWeeks = await dispatchDb.getRebookingWeeks()
  const cutoffMs = rebookingWeeks * 7 * 24 * 60 * 60 * 1000
  const rebookingCutoff = new Date(now.getTime() - cutoffMs)
  const rebookingCandidates = await dispatchDb.getRebookingCandidates(rebookingCutoff)

  for (const { appointment, customer, barber, service } of rebookingCandidates) {
    if (!customer.rebooking_opt_in) {
      counts.rebooking.skipped++
      continue
    }
    const hasFuture = await dispatchDb.customerHasFutureBooking(customer.id, now)
    if (hasFuture) {
      counts.rebooking.skipped++
      continue
    }
    try {
      const result = await send({ type: 'rebooking', appointment, customer, barber, service })
      if (result.skipped) counts.rebooking.skipped++
      else counts.rebooking.sent++
    } catch {
      counts.rebooking.skipped++
    }
  }

  return counts
}
