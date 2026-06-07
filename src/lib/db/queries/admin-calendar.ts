import db from '../index'
import type { BlockedSlot } from '../types'

// Read queries powering the admin agenda (FR-046..049). A flat denormalised row
// per appointment (barber + service + customer joined) is enough for the grid +
// detail drawer; the admin UI is NL-only (v1) so service_name_nl suffices.

export interface AdminAppointmentRow {
  id: string
  start_at: string
  end_at: string
  status: 'pending' | 'confirmed' | 'cancelled' | 'no_show' | 'completed'
  customer_notes: string | null
  admin_notes: string | null
  cancellation_reason: string | null
  ics_sequence: number
  barber_id: string
  barber_name: string
  service_id: string
  service_name_nl: string
  service_color: string
  service_duration_min: number
  service_price_cents: number
  customer_id: string
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_phone: string | null
  customer_email_missing: boolean
  customer_no_show_count: number
}

// Statuses shown on the calendar by default (FR-049). Cancelled is added only
// when the caller passes includeCancelled. 'pending' is never surfaced.
const VISIBLE_STATUSES = ['confirmed', 'completed', 'no_show'] as const

function statusFilter(includeCancelled: boolean): readonly string[] {
  return includeCancelled ? [...VISIBLE_STATUSES, 'cancelled'] : VISIBLE_STATUSES
}

export async function getAppointmentsInRange(opts: {
  fromUtc: Date
  toUtc: Date
  barberIds?: string[]
  includeCancelled: boolean
}): Promise<AdminAppointmentRow[]> {
  const { fromUtc, toUtc, barberIds, includeCancelled } = opts
  const statuses = statusFilter(includeCancelled)
  return db<AdminAppointmentRow[]>`
    SELECT
      a.id, a.start_at, a.end_at, a.status,
      a.customer_notes, a.admin_notes, a.cancellation_reason, a.ics_sequence,
      b.id AS barber_id, b.name AS barber_name,
      s.id AS service_id, s.name_nl AS service_name_nl, s.color AS service_color,
      s.duration_min AS service_duration_min, s.price_cents AS service_price_cents,
      c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
      c.email AS customer_email, c.phone AS customer_phone,
      c.email_missing AS customer_email_missing, c.no_show_count AS customer_no_show_count
    FROM appointments a
    JOIN barbers   b ON b.id = a.barber_id
    JOIN services  s ON s.id = a.service_id
    JOIN customers c ON c.id = a.customer_id
    WHERE a.start_at < ${toUtc.toISOString()}
      AND a.end_at   > ${fromUtc.toISOString()}
      AND a.status = ANY(${statuses as unknown as string[]})
      ${barberIds ? db`AND a.barber_id = ANY(${barberIds})` : db``}
    ORDER BY a.start_at ASC
  `
}

export async function getAppointmentDetailRow(
  appointmentId: string,
): Promise<AdminAppointmentRow | null> {
  const rows = await db<AdminAppointmentRow[]>`
    SELECT
      a.id, a.start_at, a.end_at, a.status,
      a.customer_notes, a.admin_notes, a.cancellation_reason, a.ics_sequence,
      b.id AS barber_id, b.name AS barber_name,
      s.id AS service_id, s.name_nl AS service_name_nl, s.color AS service_color,
      s.duration_min AS service_duration_min, s.price_cents AS service_price_cents,
      c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
      c.email AS customer_email, c.phone AS customer_phone,
      c.email_missing AS customer_email_missing, c.no_show_count AS customer_no_show_count
    FROM appointments a
    JOIN barbers   b ON b.id = a.barber_id
    JOIN services  s ON s.id = a.service_id
    JOIN customers c ON c.id = a.customer_id
    WHERE a.id = ${appointmentId}
    LIMIT 1
  `
  return rows[0] ?? null
}

// Blocked periods overlapping the range, rendered distinctly from appointments
// (FR-046/049). NULL barber_id = all-barber block (D9).
export async function getBlockedSlotsRowsInRange(opts: {
  fromUtc: Date
  toUtc: Date
  barberIds?: string[]
}): Promise<BlockedSlot[]> {
  const { fromUtc, toUtc, barberIds } = opts
  return db<BlockedSlot[]>`
    SELECT * FROM blocked_slots
    WHERE start_at < ${toUtc.toISOString()} AND end_at > ${fromUtc.toISOString()}
      ${barberIds ? db`AND (barber_id IS NULL OR barber_id = ANY(${barberIds}))` : db``}
    ORDER BY start_at ASC
  `
}

// Per-(Brussels-)day appointment counts for the month grid (FR-048). Cancelled
// excluded; counts the same visible statuses as the day/week views.
export async function getMonthDayCounts(opts: {
  fromUtc: Date
  toUtc: Date
  barberIds?: string[]
}): Promise<{ local_date: string; count: number }[]> {
  const { fromUtc, toUtc, barberIds } = opts
  const rows = await db<{ local_date: string; count: string }[]>`
    SELECT
      (start_at AT TIME ZONE 'Europe/Brussels')::date::text AS local_date,
      COUNT(*) AS count
    FROM appointments
    WHERE start_at >= ${fromUtc.toISOString()} AND start_at < ${toUtc.toISOString()}
      AND status = ANY(${VISIBLE_STATUSES as unknown as string[]})
      ${barberIds ? db`AND barber_id = ANY(${barberIds})` : db``}
    GROUP BY 1
    ORDER BY 1
  `
  return rows.map((r) => ({ local_date: r.local_date, count: Number(r.count) }))
}
