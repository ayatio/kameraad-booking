import db from '../db/index'
import { getSetting, getSettings } from '../db/queries/settings'
import {
  getActiveWindows,
  getBlockedSlotsInRange,
  getNonCancelledAppointmentsInRange,
} from '../db/queries/availability'
import { getSlotsForBarber, type EngineSettings } from './availability'
import { onBookingCancelled, onBookingRescheduled } from './email-hooks'
import type { Appointment, Barber, Service, Customer } from '../db/types'

// ─── Shared types ─────────────────────────────────────────────────────────────

export interface AppointmentDetail {
  appointment: Appointment
  barber: Barber
  service: Service
  customer: Customer
}

// ─── Token lookups ────────────────────────────────────────────────────────────

export async function getAppointmentByCancelToken(
  token: string,
): Promise<AppointmentDetail | null> {
  const appts = await db<Appointment[]>`
    SELECT * FROM appointments WHERE cancel_token = ${token} LIMIT 1
  `
  return loadDetail(appts[0] ?? null)
}

export async function getAppointmentByRescheduleToken(
  token: string,
): Promise<AppointmentDetail | null> {
  const appts = await db<Appointment[]>`
    SELECT * FROM appointments WHERE reschedule_token = ${token} LIMIT 1
  `
  return loadDetail(appts[0] ?? null)
}

async function loadDetail(appt: Appointment | null): Promise<AppointmentDetail | null> {
  if (!appt) return null
  const [customers, barbers, services] = await Promise.all([
    db<Customer[]>`SELECT * FROM customers WHERE id = ${appt.customer_id} LIMIT 1`,
    db<Barber[]>`SELECT * FROM barbers WHERE id = ${appt.barber_id} LIMIT 1`,
    db<Service[]>`SELECT * FROM services WHERE id = ${appt.service_id} LIMIT 1`,
  ])
  const customer = customers[0]
  const barber = barbers[0]
  const service = services[0]
  if (!customer || !barber || !service) return null
  return { appointment: appt, barber, service, customer }
}

// ─── Modification window ──────────────────────────────────────────────────────

// Returns true when the appointment can still be modified.
// FA rule: now < start_at − windowHours (strict). At exactly start_at−window: NOT modifiable.
export function canModify(appointment: Appointment, now: Date, windowHours: number): boolean {
  const startAt = new Date(appointment.start_at)
  return now.getTime() < startAt.getTime() - windowHours * 3_600_000
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

export type CancelResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'ALREADY_CANCELLED' }
  | { ok: false; code: 'OUTSIDE_WINDOW'; windowHours: number }

export async function cancelAppointment(token: string, now: Date): Promise<CancelResult> {
  const detail = await getAppointmentByCancelToken(token)
  if (!detail) return { ok: false, code: 'NOT_FOUND' }

  const { appointment } = detail

  // FR-031: idempotent — already cancelled is not an error, just a signal
  if (appointment.status === 'cancelled') {
    return { ok: false, code: 'ALREADY_CANCELLED' }
  }

  // Read window LIVE (FR-008)
  const windowHours = Number((await getSetting('cancellation_window_hours')) ?? 24)

  // FR-034: server-side enforcement
  if (!canModify(appointment, now, windowHours)) {
    return { ok: false, code: 'OUTSIDE_WINDOW', windowHours }
  }

  await db`
    UPDATE appointments SET
      status              = 'cancelled',
      cancelled_at        = ${now.toISOString()},
      cancellation_reason = 'customer',
      updated_at          = now()
    WHERE id = ${appointment.id}
  `

  const updated: Appointment = {
    ...appointment,
    status: 'cancelled',
    cancelled_at: now.toISOString(),
    cancellation_reason: 'customer',
  }
  await onBookingCancelled(updated).catch(() => {})

  return { ok: true }
}

// ─── Reschedule ───────────────────────────────────────────────────────────────

export type RescheduleResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'ALREADY_CANCELLED' }
  | { ok: false; code: 'OUTSIDE_WINDOW'; windowHours: number }
  | { ok: false; code: 'SLOT_TAKEN' }

function buildEngineSettings(raw: Record<string, unknown>): EngineSettings {
  return {
    bufferMin: Number(raw['buffer_min'] ?? 0),
    minLeadTimeHours: Number(raw['min_lead_time_hours'] ?? 2),
    bookingHorizonDays: Number(raw['booking_horizon_days'] ?? 56),
  }
}

export async function rescheduleAppointment(
  token: string,
  newStartAtUtc: Date,
  now: Date,
): Promise<RescheduleResult> {
  const detail = await getAppointmentByRescheduleToken(token)
  if (!detail) return { ok: false, code: 'NOT_FOUND' }

  const { appointment, barber, service } = detail

  if (appointment.status === 'cancelled') {
    return { ok: false, code: 'ALREADY_CANCELLED' }
  }

  const settingsRaw = await getSettings()
  const windowHours = Number(settingsRaw['cancellation_window_hours'] ?? 24)

  // FR-032: window rule applies to the ORIGINAL start, not the new slot
  if (!canModify(appointment, now, windowHours)) {
    return { ok: false, code: 'OUTSIDE_WINDOW', windowHours }
  }

  // Re-validate new slot via slot engine for the same barber + service
  const bufferPad = 3 * 3_600_000
  const fromUtc = new Date(newStartAtUtc.getTime() - bufferPad)
  const toUtc = new Date(
    newStartAtUtc.getTime() + (service.duration_min + 60) * 60_000 + bufferPad,
  )
  const localDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(newStartAtUtc)

  const [windows, blocks, busyAppts] = await Promise.all([
    getActiveWindows([barber.id]),
    getBlockedSlotsInRange(fromUtc, toUtc, [barber.id]),
    getNonCancelledAppointmentsInRange(fromUtc, toUtc, [barber.id]),
  ])

  const slots = getSlotsForBarber({
    barberId: barber.id,
    durationMin: service.duration_min,
    dateRange: { fromDate: localDate, toDate: localDate },
    now,
    windows,
    blocks,
    appointments: busyAppts,
    settings: buildEngineSettings(settingsRaw),
  })

  if (!slots.find((s) => s.startAtUtc.getTime() === newStartAtUtc.getTime())) {
    return { ok: false, code: 'SLOT_TAKEN' }
  }

  const newEndAt = new Date(newStartAtUtc.getTime() + service.duration_min * 60_000)

  let updated: Appointment
  try {
    const rows = await db<Appointment[]>`
      UPDATE appointments SET
        start_at     = ${newStartAtUtc.toISOString()},
        end_at       = ${newEndAt.toISOString()},
        ics_sequence = ics_sequence + 1,
        updated_at   = now()
      WHERE id = ${appointment.id}
      RETURNING *
    `
    updated = rows[0]
  } catch (err: unknown) {
    if (isPostgresError(err, '23P01') || isPostgresError(err, '23505')) {
      return { ok: false, code: 'SLOT_TAKEN' }
    }
    throw err
  }

  await onBookingRescheduled(updated).catch(() => {})

  return { ok: true, appointment: updated }
}

function isPostgresError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === code
  )
}
