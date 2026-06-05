import { z } from 'zod'
import db from '../db/index'
import { getSettings } from '../db/queries/settings'
import { getServiceBySlug } from '../db/queries/services'
import { getActiveBarbers, getBarberServiceLinks } from '../db/queries/barbers'
import {
  getActiveWindows,
  getBlockedSlotsInRange,
  getNonCancelledAppointmentsInRange,
  getAppointmentDayCountsPerBarber,
} from '../db/queries/availability'
import { upsertCustomer } from '../db/queries/customers'
import { insertAppointment } from '../db/queries/appointments'
import {
  getSlotsForBarber,
  getSlotsAnyBarber,
  assignBarber,
  type EngineSettings,
} from './availability'
import { onBookingConfirmed } from './email-hooks'
import type { Appointment } from '../db/types'

// ─── Validation schema ─────────────────────────────────────────────────────────

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const

// Accept Belgian formats: 04xx xxxxxx, +32 4xx xxxxxx, 0xx xxx xxxx, +32 x xxx xxxx
// E.164 format (+32…) or local 0… form, digits and spaces/hyphens stripped.
const phoneRegex = /^(\+32|0)\d[\d\s\-./]{6,14}\d$/

export const bookingInputSchema = z.object({
  barberId: z.string().min(1),
  serviceSlug: z.string().min(1),
  startAtUtc: z.string().datetime(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().regex(phoneRegex, 'Invalid phone number (use Belgian or E.164 format)'),
  note: z.string().max(500).optional(),
  locale: z.enum(LOCALES),
  cancellationPolicyAccepted: z.literal(true),
  privacyAccepted: z.literal(true),
})

export type BookingInput = z.infer<typeof bookingInputSchema>

// ─── Result types ──────────────────────────────────────────────────────────────

export type BookingResult =
  | { ok: true; appointment: Appointment }
  | { ok: false; code: 'SLOT_TAKEN' }
  | { ok: false; code: 'VALIDATION_ERROR'; issues: z.ZodIssue[] }
  | { ok: false; code: 'SERVICE_ERROR'; message: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEngineSettings(raw: Record<string, unknown>): EngineSettings {
  return {
    bufferMin: Number(raw['buffer_min'] ?? 0),
    minLeadTimeHours: Number(raw['min_lead_time_hours'] ?? 2),
    bookingHorizonDays: Number(raw['booking_horizon_days'] ?? 56),
  }
}

function dateRangeUtc(startAt: Date, durationMin: number): { fromUtc: Date; toUtc: Date } {
  const bufferPad = 3 * 3_600_000
  const fromUtc = new Date(startAt.getTime() - bufferPad)
  const toUtc = new Date(startAt.getTime() + (durationMin + 60) * 60_000 + bufferPad)
  return { fromUtc, toUtc }
}

function localDateFromUtc(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// ─── Main service ──────────────────────────────────────────────────────────────

export async function createBooking(rawInput: unknown): Promise<BookingResult> {
  // 1. Zod validation
  const parsed = bookingInputSchema.safeParse(rawInput)
  if (!parsed.success) {
    return { ok: false, code: 'VALIDATION_ERROR', issues: parsed.error.issues }
  }
  const input = parsed.data
  const startAt = new Date(input.startAtUtc)

  // 2. Load service + barbers
  const service = await getServiceBySlug(input.serviceSlug)
  if (!service) return { ok: false, code: 'SERVICE_ERROR', message: 'Service not found.' }
  if (!service.is_active)
    return { ok: false, code: 'SERVICE_ERROR', message: 'Service is not available.' }
  if (service.is_walk_in)
    return { ok: false, code: 'SERVICE_ERROR', message: 'Walk-in service cannot be booked online.' }

  const [settingsRaw, allBarbers, barberServiceLinks] = await Promise.all([
    getSettings(),
    getActiveBarbers(),
    getBarberServiceLinks(),
  ])
  const settings = buildEngineSettings(settingsRaw)
  const now = new Date()

  // 3. Resolve barber
  let resolvedBarberId: string

  if (input.barberId === 'any') {
    const serviceBarberIds = barberServiceLinks
      .filter((bs) => bs.service_id === service.id)
      .map((bs) => bs.barber_id)
    const candidateIds = allBarbers
      .map((b) => b.id)
      .filter((id) => serviceBarberIds.includes(id))

    if (candidateIds.length === 0) {
      return { ok: false, code: 'SERVICE_ERROR', message: 'No barber available for this service.' }
    }

    // 3a. Re-validate that the slot is actually offered (race safety)
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

    const matchingSlot = anySlots.find(
      (s) => s.startAtUtc.getTime() === startAt.getTime(),
    )

    if (!matchingSlot) {
      // Slot no longer available — return SLOT_TAKEN
      return { ok: false, code: 'SLOT_TAKEN' }
    }

    const sortOrder: Record<string, number> = {}
    for (const b of allBarbers) sortOrder[b.id] = b.sort_order

    resolvedBarberId = assignBarber({
      localDate,
      startAtUtc: startAt,
      candidateBarberIds: matchingSlot.candidateBarberIds,
      dayAppointmentCounts: dayCounts,
      sortOrder,
    })
  } else {
    const barber = allBarbers.find((b) => b.id === input.barberId)
    if (!barber) {
      return { ok: false, code: 'SERVICE_ERROR', message: 'Barber not found or not active.' }
    }

    const offersService = barberServiceLinks.some(
      (bs) => bs.barber_id === input.barberId && bs.service_id === service.id,
    )
    if (!offersService) {
      return { ok: false, code: 'SERVICE_ERROR', message: 'Barber does not offer this service.' }
    }

    // Re-validate slot
    const { fromUtc, toUtc } = dateRangeUtc(startAt, service.duration_min)
    const localDate = localDateFromUtc(startAt)

    const [windows, blocks, appointments] = await Promise.all([
      getActiveWindows([input.barberId]),
      getBlockedSlotsInRange(fromUtc, toUtc, [input.barberId]),
      getNonCancelledAppointmentsInRange(fromUtc, toUtc, [input.barberId]),
    ])

    const slots = getSlotsForBarber({
      barberId: input.barberId,
      durationMin: service.duration_min,
      dateRange: { fromDate: localDate, toDate: localDate },
      now,
      windows,
      blocks,
      appointments,
      settings,
    })

    const matchingSlot = slots.find((s) => s.startAtUtc.getTime() === startAt.getTime())
    if (!matchingSlot) {
      return { ok: false, code: 'SLOT_TAKEN' }
    }

    resolvedBarberId = input.barberId
  }

  // 4. Transactional: upsert customer + insert appointment
  const endAt = new Date(startAt.getTime() + service.duration_min * 60_000)
  const consentAt = input.privacyAccepted ? new Date() : null

  let appointment: Appointment
  try {
    appointment = await db.begin(async (sql) => {
      const customer = await upsertCustomer(
        {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          preferredLanguage: input.locale,
          consentGivenAt: consentAt,
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
    // 5. Handle exclusion constraint (23P01) and unique violation (23505)
    if (isPostgresError(err, '23P01') || isPostgresError(err, '23505')) {
      return { ok: false, code: 'SLOT_TAKEN' }
    }
    throw err
  }

  // 6. Fire email hook (best effort — don't fail the booking on hook error)
  await onBookingConfirmed(appointment).catch(() => {})

  return { ok: true, appointment }
}

function isPostgresError(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === code
  )
}
