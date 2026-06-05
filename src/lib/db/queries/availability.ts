import db from '../index'
import type { Availability, BlockedSlot } from '../types'
import type {
  AvailabilityWindow,
  BlockedSlot as EngineBlockedSlot,
  BusyAppointment,
} from '../../services/availability'

export async function getActiveWindows(barberIds?: string[]): Promise<AvailabilityWindow[]> {
  const rows = barberIds
    ? await db<Availability[]>`
        SELECT * FROM availability
        WHERE is_active = true AND barber_id = ANY(${barberIds})
      `
    : await db<Availability[]>`
        SELECT * FROM availability WHERE is_active = true
      `

  return rows.map((r) => ({
    barberId: r.barber_id,
    dayOfWeek: r.day_of_week,
    startTime: r.start_time,
    endTime: r.end_time,
  }))
}

export async function getBlockedSlotsInRange(
  fromUtc: Date,
  toUtc: Date,
  barberIds?: string[],
): Promise<EngineBlockedSlot[]> {
  const rows = barberIds
    ? await db<BlockedSlot[]>`
        SELECT * FROM blocked_slots
        WHERE start_at < ${toUtc.toISOString()} AND end_at > ${fromUtc.toISOString()}
          AND (barber_id IS NULL OR barber_id = ANY(${barberIds}))
      `
    : await db<BlockedSlot[]>`
        SELECT * FROM blocked_slots
        WHERE start_at < ${toUtc.toISOString()} AND end_at > ${fromUtc.toISOString()}
      `

  return rows.map((r) => ({
    barberId: r.barber_id,
    startAt: new Date(r.start_at),
    endAt: new Date(r.end_at),
  }))
}

export async function getNonCancelledAppointmentsInRange(
  fromUtc: Date,
  toUtc: Date,
  barberIds?: string[],
): Promise<BusyAppointment[]> {
  const rows = barberIds
    ? await db<{ barber_id: string; start_at: string; end_at: string }[]>`
        SELECT barber_id, start_at, end_at FROM appointments
        WHERE status NOT IN ('cancelled')
          AND start_at < ${toUtc.toISOString()}
          AND end_at > ${fromUtc.toISOString()}
          AND barber_id = ANY(${barberIds})
      `
    : await db<{ barber_id: string; start_at: string; end_at: string }[]>`
        SELECT barber_id, start_at, end_at FROM appointments
        WHERE status NOT IN ('cancelled')
          AND start_at < ${toUtc.toISOString()}
          AND end_at > ${fromUtc.toISOString()}
      `

  return rows.map((r) => ({
    barberId: r.barber_id,
    startAt: new Date(r.start_at),
    endAt: new Date(r.end_at),
  }))
}

export async function getAppointmentDayCountsPerBarber(
  localDate: string,
  barberIds: string[],
): Promise<Record<string, number>> {
  // Count non-cancelled appointments on the Brussels calendar date for each barber.
  // We use a date range in UTC that covers the full Brussels day (CET=+1, CEST=+2).
  // Using AT TIME ZONE for correctness.
  const rows = await db<{ barber_id: string; cnt: string }[]>`
    SELECT barber_id, COUNT(*) AS cnt
    FROM appointments
    WHERE status NOT IN ('cancelled')
      AND barber_id = ANY(${barberIds})
      AND (start_at AT TIME ZONE 'Europe/Brussels')::date = ${localDate}::date
    GROUP BY barber_id
  `
  const result: Record<string, number> = {}
  for (const r of rows) {
    result[r.barber_id] = Number(r.cnt)
  }
  return result
}
