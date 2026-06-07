import { brusselsWallTimeToUtc } from './availability'
import {
  getAppointmentsInRange,
  getAppointmentDetailRow,
  getBlockedSlotsRowsInRange,
  getMonthDayCounts,
  type AdminAppointmentRow,
} from '../db/queries/admin-calendar'
import type { BlockedSlot } from '../db/types'

// Admin agenda read service (FR-046..049). Pure-ish: only date→UTC-range maths
// here; all SQL lives in db/queries/admin-calendar. The SERVICE returns data for
// any requested barber (owner sees all; a barber may READ others' calendars per
// the §6.2 matrix) — the per-action WRITE guard (admin-bookings) is what stops a
// barber mutating someone else's appointment.

export type { AdminAppointmentRow }

export interface CalendarRangeResult {
  appointments: AdminAppointmentRow[]
  blocks: BlockedSlot[]
}

// Add `days` to a 'YYYY-MM-DD' string (UTC-based, handles month overflow).
function addDays(localDate: string, days: number): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10)
}

// UTC instant for Brussels local midnight of `localDate`. Midnight never falls
// in a DST gap, so brusselsWallTimeToUtc always resolves it.
function brusselsMidnightUtc(localDate: string): Date {
  const d = brusselsWallTimeToUtc(localDate, '00:00')
  if (!d) throw new Error(`Could not resolve Brussels midnight for ${localDate}`)
  return d
}

function normalizeBarberIds(barberIds?: string[]): string[] | undefined {
  return barberIds && barberIds.length > 0 ? barberIds : undefined
}

// ─── Day (FR-046) ───────────────────────────────────────────────────────────

export async function getDayView(opts: {
  date: string // 'YYYY-MM-DD' (Brussels)
  barberIds?: string[]
  includeCancelled?: boolean
}): Promise<CalendarRangeResult> {
  const fromUtc = brusselsMidnightUtc(opts.date)
  const toUtc = brusselsMidnightUtc(addDays(opts.date, 1))
  return loadRange(fromUtc, toUtc, opts.barberIds, opts.includeCancelled ?? false)
}

// ─── Week (FR-047) ──────────────────────────────────────────────────────────

export async function getWeekView(opts: {
  weekStartDate: string // 'YYYY-MM-DD' (Brussels) — caller decides Mon/Sun start
  barberIds?: string[]
  includeCancelled?: boolean
}): Promise<CalendarRangeResult> {
  const fromUtc = brusselsMidnightUtc(opts.weekStartDate)
  const toUtc = brusselsMidnightUtc(addDays(opts.weekStartDate, 7))
  return loadRange(fromUtc, toUtc, opts.barberIds, opts.includeCancelled ?? false)
}

// ─── Month counts (FR-048) ──────────────────────────────────────────────────

export async function getMonthCounts(opts: {
  year: number
  month: number // 1-12
  barberIds?: string[]
}): Promise<{ local_date: string; count: number }[]> {
  const first = `${opts.year}-${String(opts.month).padStart(2, '0')}-01`
  const fromUtc = brusselsMidnightUtc(first)
  const nextMonthFirst =
    opts.month === 12
      ? `${opts.year + 1}-01-01`
      : `${opts.year}-${String(opts.month + 1).padStart(2, '0')}-01`
  const toUtc = brusselsMidnightUtc(nextMonthFirst)
  return getMonthDayCounts({ fromUtc, toUtc, barberIds: normalizeBarberIds(opts.barberIds) })
}

// ─── Detail drawer ──────────────────────────────────────────────────────────

export async function getAppointmentDetail(
  appointmentId: string,
): Promise<AdminAppointmentRow | null> {
  return getAppointmentDetailRow(appointmentId)
}

// ─── Shared loader ──────────────────────────────────────────────────────────

async function loadRange(
  fromUtc: Date,
  toUtc: Date,
  rawBarberIds: string[] | undefined,
  includeCancelled: boolean,
): Promise<CalendarRangeResult> {
  const barberIds = normalizeBarberIds(rawBarberIds)
  const [appointments, blocks] = await Promise.all([
    getAppointmentsInRange({ fromUtc, toUtc, barberIds, includeCancelled }),
    getBlockedSlotsRowsInRange({ fromUtc, toUtc, barberIds }),
  ])
  return { appointments, blocks }
}
