import db from '../index'
import type postgres from 'postgres'
import type { Availability, BlockedSlot } from '../types'
import type {
  AvailabilityWindow,
  BlockedSlot as EngineBlockedSlot,
  BusyAppointment,
} from '../../services/availability'

type SqlClient = postgres.ISql<{}>

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

// ─── Hours editor (FR-054) ──────────────────────────────────────────────────

export interface HoursWindowRow {
  dayOfWeek: number
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
}

export async function getAvailabilityForBarber(barberId: string): Promise<HoursWindowRow[]> {
  const rows = await db<Availability[]>`
    SELECT * FROM availability
    WHERE barber_id = ${barberId} AND is_active = true
    ORDER BY day_of_week ASC, start_time ASC
  `
  return rows.map((r) => ({
    dayOfWeek: r.day_of_week,
    // Postgres returns time as 'HH:MM:SS' — trim to 'HH:MM'.
    startTime: r.start_time.slice(0, 5),
    endTime: r.end_time.slice(0, 5),
  }))
}

// Replace the FULL weekly schedule for a barber (delete-then-insert) in one
// transaction. Caller validates before calling (see admin-availability).
export async function replaceAvailabilityForBarber(
  barberId: string,
  windows: HoursWindowRow[],
): Promise<void> {
  await db.begin(async (sql: SqlClient) => {
    await sql`DELETE FROM availability WHERE barber_id = ${barberId}`
    for (const w of windows) {
      await sql`
        INSERT INTO availability (barber_id, day_of_week, start_time, end_time, is_active)
        VALUES (${barberId}, ${w.dayOfWeek}, ${w.startTime}, ${w.endTime}, true)
      `
    }
  })
}

// Like getNonCancelledAppointmentsInRange but excludes one appointment — used by
// admin reschedule so an appointment doesn't conflict with ITS OWN current slot
// when validating the target time.
export async function getBusyAppointmentsExcluding(
  fromUtc: Date,
  toUtc: Date,
  barberIds: string[],
  excludeAppointmentId: string,
): Promise<BusyAppointment[]> {
  const rows = await db<{ barber_id: string; start_at: string; end_at: string }[]>`
    SELECT barber_id, start_at, end_at FROM appointments
    WHERE status NOT IN ('cancelled')
      AND id <> ${excludeAppointmentId}
      AND start_at < ${toUtc.toISOString()}
      AND end_at   > ${fromUtc.toISOString()}
      AND barber_id = ANY(${barberIds})
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
