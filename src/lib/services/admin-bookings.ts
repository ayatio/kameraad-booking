import { z } from 'zod'
import db from '../db/index'
import { getSettings } from '../db/queries/settings'
import { getServiceBySlug } from '../db/queries/services'
import { getActiveBarbers, getBarberServiceLinks } from '../db/queries/barbers'
import {
  getActiveWindows,
  getBlockedSlotsInRange,
  getNonCancelledAppointmentsInRange,
  getBusyAppointmentsExcluding,
  getAppointmentDayCountsPerBarber,
} from '../db/queries/availability'
import {
  getAppointmentById,
  insertAppointment,
} from '../db/queries/appointments'
import { upsertCustomer, createManualCustomer } from '../db/queries/customers'
import {
  getSlotsForBarber,
  getSlotsAnyBarber,
  assignBarber,
  type EngineSettings,
} from './availability'
import { onBookingConfirmed, onBookingCancelled, onBookingRescheduled } from './email-hooks'
import { writeAudit, AUDIT } from './audit'
import { ForbiddenError, canActOnBarber } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { Appointment, Service } from '../db/types'

export type { AdminActor }

// Admin booking management (FR-050..053). Reuses the Phase-2 slot engine + the
// exclusion-constraint→SLOT_TAKEN handling; adds admin-only powers: manual
// (walk-in/phone) creation, lead-time override on reschedule, window-ignoring
// cancel with optional notify, no-show toggle (D14), and complete (FR-053).

// ─── Scope ──────────────────────────────────────────────────────────────────

// Throws ForbiddenError (→ 403) when the actor may not MANAGE this barber's
// bookings. Owner: any; barber: only their own (§6.2 booking.manage.own).
function assertCanManageBarber(actor: AdminActor, targetBarberId: string): void {
  const ok = canActOnBarber({
    role: actor.role,
    actorBarberId: actor.barberId,
    targetBarberId,
    action: 'manage',
  })
  if (!ok) throw new ForbiddenError('Geen toegang tot deze afspraak.')
}

// ─── Settings / slot helpers ────────────────────────────────────────────────

function buildEngineSettings(
  raw: Record<string, unknown>,
  overrideLeadTime = false,
): EngineSettings {
  return {
    bufferMin: Number(raw['buffer_min'] ?? 0),
    minLeadTimeHours: overrideLeadTime ? 0 : Number(raw['min_lead_time_hours'] ?? 2),
    bookingHorizonDays: Number(raw['booking_horizon_days'] ?? 56),
  }
}

function localDateFromUtc(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function dateRangeUtc(startAt: Date, durationMin: number): { fromUtc: Date; toUtc: Date } {
  const bufferPad = 3 * 3_600_000
  const fromUtc = new Date(startAt.getTime() - bufferPad)
  const toUtc = new Date(startAt.getTime() + (durationMin + 60) * 60_000 + bufferPad)
  return { fromUtc, toUtc }
}

function isPostgresError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === code
  )
}

// ─── Result types ───────────────────────────────────────────────────────────

export type ManualBookingResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'SLOT_TAKEN' }
  | { ok: false; code: 'VALIDATION_ERROR'; issues: z.ZodIssue[] }
  | { ok: false; code: 'SERVICE_ERROR'; message: string }

export type AdminRescheduleResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'ALREADY_CANCELLED' }
  | { ok: false; code: 'SLOT_TAKEN' }

export type AdminCancelResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'ALREADY_CANCELLED' }

export type NoShowResult =
  | { ok: true; status: 'no_show' | 'confirmed'; noShowCount: number }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'TOO_EARLY' }
  | { ok: false; code: 'INVALID_STATE' }

export type CompleteResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'NOT_FOUND' }
  | { ok: false; code: 'TOO_EARLY' }
  | { ok: false; code: 'INVALID_STATE' }

// ─── Manual booking (FR-052) ────────────────────────────────────────────────

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const

export const manualBookingSchema = z.object({
  barberId: z.string().min(1), // a barber id, or 'any'
  serviceSlug: z.string().min(1),
  startAtUtc: z.string().datetime(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional(),
  phone: z.string().max(40).optional(),
  note: z.string().max(500).optional(),
  locale: z.enum(LOCALES).default('nl'),
})

export type ManualBookingInput = z.infer<typeof manualBookingSchema>

export async function adminCreateManualBooking(
  rawInput: unknown,
  actor: AdminActor,
): Promise<ManualBookingResult> {
  const parsed = manualBookingSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_ERROR', issues: parsed.error.issues }
  }
  const input = parsed.data
  const startAt = new Date(input.startAtUtc)

  const service = await getServiceBySlug(input.serviceSlug)
  if (!service) return { ok: false, code: 'SERVICE_ERROR', message: 'Service niet gevonden.' }
  if (!service.is_active)
    return { ok: false, code: 'SERVICE_ERROR', message: 'Service is niet beschikbaar.' }
  if (service.is_walk_in)
    return { ok: false, code: 'SERVICE_ERROR', message: 'Walk-in kan niet ingepland worden.' }

  const [settingsRaw, allBarbers, links] = await Promise.all([
    getSettings(),
    getActiveBarbers(),
    getBarberServiceLinks(),
  ])
  const settings = buildEngineSettings(settingsRaw)
  const now = new Date()

  // Candidate barbers offering this service.
  const serviceBarberIds = links
    .filter((l) => l.service_id === service.id)
    .map((l) => l.barber_id)
  let candidateIds = allBarbers.map((b) => b.id).filter((id) => serviceBarberIds.includes(id))

  // Scope: a barber may only create for themselves (§6.2). 'any' collapses to
  // their own id; a different explicit barber is forbidden.
  if (actor.role === 'barber') {
    if (actor.barberId === null) throw new ForbiddenError('Geen barbier gekoppeld aan account.')
    if (input.barberId !== 'any' && input.barberId !== actor.barberId) {
      throw new ForbiddenError('Een barbier kan enkel voor zichzelf inboeken.')
    }
    candidateIds = candidateIds.filter((id) => id === actor.barberId)
  } else if (input.barberId !== 'any') {
    candidateIds = candidateIds.filter((id) => id === input.barberId)
  }

  if (candidateIds.length === 0) {
    return { ok: false, code: 'SERVICE_ERROR', message: 'Geen barbier beschikbaar voor deze service.' }
  }

  // Re-validate the slot (race safety) and resolve the barber.
  const { fromUtc, toUtc } = dateRangeUtc(startAt, service.duration_min)
  const localDate = localDateFromUtc(startAt)
  const [windows, blocks, appointments, dayCounts] = await Promise.all([
    getActiveWindows(candidateIds),
    getBlockedSlotsInRange(fromUtc, toUtc, candidateIds),
    getNonCancelledAppointmentsInRange(fromUtc, toUtc, candidateIds),
    getAppointmentDayCountsPerBarber(localDate, candidateIds),
  ])

  const anySlots = getSlotsAnyBarber({
    barberIds: candidateIds,
    durationMin: service.duration_min,
    dateRange: { fromDate: localDate, toDate: localDate },
    now,
    windows,
    blocks,
    appointments,
    settings,
  })
  const matchingSlot = anySlots.find((s) => s.startAtUtc.getTime() === startAt.getTime())
  if (!matchingSlot) return { ok: false, code: 'SLOT_TAKEN' }

  const sortOrder: Record<string, number> = {}
  for (const b of allBarbers) sortOrder[b.id] = b.sort_order
  const resolvedBarberId = assignBarber({
    localDate,
    startAtUtc: startAt,
    candidateBarberIds: matchingSlot.candidateBarberIds,
    dayAppointmentCounts: dayCounts,
    sortOrder,
  })

  const endAt = new Date(startAt.getTime() + service.duration_min * 60_000)
  const hasEmail = typeof input.email === 'string' && input.email.length > 0

  let appointment: Appointment
  try {
    appointment = await db.begin(async (sql) => {
      const customer = hasEmail
        ? await upsertCustomer(
            {
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email as string,
              phone: input.phone ?? null,
              preferredLanguage: input.locale,
              consentGivenAt: null,
            },
            sql,
          )
        : await createManualCustomer(
            {
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone ?? null,
              preferredLanguage: input.locale,
            },
            sql,
          )

      return insertAppointment(
        {
          barberId: resolvedBarberId,
          serviceId: service.id,
          customerId: customer.id,
          startAt,
          endAt,
          customerNotes: input.note ?? null,
        },
        sql,
      )
    })
  } catch (err: unknown) {
    if (isPostgresError(err, '23P01') || isPostgresError(err, '23505')) {
      return { ok: false, code: 'SLOT_TAKEN' }
    }
    throw err
  }

  // Email only when a real address was given (email_missing customers get none).
  if (hasEmail) {
    await onBookingConfirmed(appointment).catch(() => {})
  }

  await writeAudit({
    actor: actor.email,
    action: AUDIT.MANUAL_BOOKING,
    payload: {
      appointment_id: appointment.id,
      barber_id: resolvedBarberId,
      email_missing: !hasEmail,
    },
  })

  return { ok: true, appointment }
}

// ─── Reschedule (FR-050) ────────────────────────────────────────────────────

export async function adminReschedule(
  appointmentId: string,
  newStartUtc: Date,
  actor: AdminActor,
  opts: { overrideLeadTime?: boolean } = {},
): Promise<AdminRescheduleResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'NOT_FOUND' }
  assertCanManageBarber(actor, appt.barber_id)
  if (appt.status === 'cancelled') return { ok: false, code: 'ALREADY_CANCELLED' }

  const service = await getServiceForAppointment(appt.service_id)
  if (!service) return { ok: false, code: 'NOT_FOUND' }

  const settingsRaw = await getSettings()
  const settings = buildEngineSettings(settingsRaw, opts.overrideLeadTime ?? false)
  const now = new Date()

  const { fromUtc, toUtc } = dateRangeUtc(newStartUtc, service.duration_min)
  const localDate = localDateFromUtc(newStartUtc)
  const [windows, blocks, busy] = await Promise.all([
    getActiveWindows([appt.barber_id]),
    getBlockedSlotsInRange(fromUtc, toUtc, [appt.barber_id]),
    // Exclude THIS appointment so it doesn't conflict with its own current slot.
    getBusyAppointmentsExcluding(fromUtc, toUtc, [appt.barber_id], appt.id),
  ])

  const slots = getSlotsForBarber({
    barberId: appt.barber_id,
    durationMin: service.duration_min,
    dateRange: { fromDate: localDate, toDate: localDate },
    now,
    windows,
    blocks,
    appointments: busy,
    settings,
  })
  if (!slots.find((s) => s.startAtUtc.getTime() === newStartUtc.getTime())) {
    return { ok: false, code: 'SLOT_TAKEN' }
  }

  const newEndAt = new Date(newStartUtc.getTime() + service.duration_min * 60_000)
  let updated: Appointment
  try {
    const rows = await db<Appointment[]>`
      UPDATE appointments SET
        start_at     = ${newStartUtc.toISOString()},
        end_at       = ${newEndAt.toISOString()},
        ics_sequence = ics_sequence + 1,
        updated_at   = now()
      WHERE id = ${appt.id}
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
  await writeAudit({
    actor: actor.email,
    action: AUDIT.BOOKING_RESCHEDULE,
    payload: {
      appointment_id: updated.id,
      override_lead_time: opts.overrideLeadTime ?? false,
      ics_sequence: updated.ics_sequence,
    },
  })
  return { ok: true, appointment: updated }
}

// ─── Cancel (FR-051) ────────────────────────────────────────────────────────

export async function adminCancel(
  appointmentId: string,
  actor: AdminActor,
  opts: { notify?: boolean; reason?: string } = {},
): Promise<AdminCancelResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'NOT_FOUND' }
  assertCanManageBarber(actor, appt.barber_id)
  if (appt.status === 'cancelled') return { ok: false, code: 'ALREADY_CANCELLED' }

  const notify = opts.notify ?? true
  const reason = opts.reason && opts.reason.trim().length > 0 ? opts.reason.trim() : 'admin'
  const now = new Date()

  const rows = await db<Appointment[]>`
    UPDATE appointments SET
      status              = 'cancelled',
      cancelled_at        = ${now.toISOString()},
      cancellation_reason = ${reason},
      updated_at          = now()
    WHERE id = ${appt.id}
    RETURNING *
  `
  const updated = rows[0]

  // Admin cancel IGNORES the customer modification window; notify is opt-out.
  if (notify) {
    await onBookingCancelled(updated).catch(() => {})
  }

  await writeAudit({
    actor: actor.email,
    action: AUDIT.BOOKING_CANCEL,
    payload: { appointment_id: updated.id, notify }, // reason text is omitted (free text → PII risk)
  })
  return { ok: true }
}

// ─── No-show toggle (FR-053 / D14) ──────────────────────────────────────────

// Pure timing rule (D14): a no-show may only be toggled once the slot has
// STARTED. Exported for unit testing with an injected clock.
export function canToggleNoShow(now: Date, startAt: Date): boolean {
  return now.getTime() >= startAt.getTime()
}

export async function toggleNoShow(
  appointmentId: string,
  actor: AdminActor,
  now: Date,
): Promise<NoShowResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'NOT_FOUND' }
  assertCanManageBarber(actor, appt.barber_id)

  if (!canToggleNoShow(now, new Date(appt.start_at))) {
    return { ok: false, code: 'TOO_EARLY' }
  }

  // Toggle semantics: confirmed/completed → no_show (+1 no_show_count);
  // no_show → confirmed (−1, floored at 0). Cancelled is not toggleable.
  const goingToNoShow = appt.status !== 'no_show'
  if (appt.status === 'cancelled') return { ok: false, code: 'INVALID_STATE' }

  const newStatus: 'no_show' | 'confirmed' = goingToNoShow ? 'no_show' : 'confirmed'
  const delta = goingToNoShow ? 1 : -1

  const noShowCount = await db.begin(async (sql) => {
    await sql`
      UPDATE appointments SET status = ${newStatus}, updated_at = now()
      WHERE id = ${appt.id}
    `
    const rows = await sql<{ no_show_count: number }[]>`
      UPDATE customers
      SET no_show_count = GREATEST(0, no_show_count + ${delta}), updated_at = now()
      WHERE id = ${appt.customer_id}
      RETURNING no_show_count
    `
    return rows[0]?.no_show_count ?? 0
  })

  await writeAudit({
    actor: actor.email,
    action: AUDIT.NO_SHOW,
    payload: { appointment_id: appt.id, status: newStatus },
  })
  return { ok: true, status: newStatus, noShowCount }
}

// ─── Mark completed (FR-053) ────────────────────────────────────────────────

export async function markCompleted(
  appointmentId: string,
  actor: AdminActor,
  now: Date = new Date(),
): Promise<CompleteResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'NOT_FOUND' }
  assertCanManageBarber(actor, appt.barber_id)
  if (appt.status === 'cancelled') return { ok: false, code: 'INVALID_STATE' }
  // Completed is only settable after the slot has started (no auto-complete).
  if (now.getTime() < new Date(appt.start_at).getTime()) {
    return { ok: false, code: 'TOO_EARLY' }
  }

  const rows = await db<Appointment[]>`
    UPDATE appointments SET status = 'completed', updated_at = now()
    WHERE id = ${appt.id}
    RETURNING *
  `
  await writeAudit({
    actor: actor.email,
    action: AUDIT.COMPLETE,
    payload: { appointment_id: appt.id },
  })
  return { ok: true, appointment: rows[0] }
}

// ─── Admin notes (FR-050: edit admin-only notes) ────────────────────────────

export type UpdateNotesResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'NOT_FOUND' }

export async function updateAdminNotes(
  appointmentId: string,
  notes: string | null,
  actor: AdminActor,
): Promise<UpdateNotesResult> {
  const appt = await getAppointmentById(appointmentId)
  if (!appt) return { ok: false, code: 'NOT_FOUND' }
  assertCanManageBarber(actor, appt.barber_id)
  const clean = notes && notes.trim().length > 0 ? notes : null
  const rows = await db<Appointment[]>`
    UPDATE appointments SET admin_notes = ${clean}, updated_at = now()
    WHERE id = ${appt.id}
    RETURNING *
  `
  await writeAudit({
    actor: actor.email,
    action: AUDIT.SETTINGS_UPDATE,
    payload: { kind: 'admin_notes', appointment_id: appt.id }, // note text omitted (PII)
  })
  return { ok: true, appointment: rows[0] }
}

// ─── internal ───────────────────────────────────────────────────────────────

async function getServiceForAppointment(serviceId: string): Promise<Service | null> {
  const rows = await db<Service[]>`SELECT * FROM services WHERE id = ${serviceId} LIMIT 1`
  return rows[0] ?? null
}
