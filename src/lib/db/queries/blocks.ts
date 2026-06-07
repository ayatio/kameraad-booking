import db from '../index'
import type postgres from 'postgres'
import type { BlockedSlot } from '../types'

type SqlClient = postgres.ISql<{}>

// blocked_slots CRUD + the D10 conflict lookup (FR-055/056).

export interface InsertBlockInput {
  barberId: string | null // null = all-barber block (D9)
  startAt: Date
  endAt: Date
  reason: string | null
}

export async function insertBlock(input: InsertBlockInput, sql: SqlClient = db): Promise<BlockedSlot> {
  const { barberId, startAt, endAt, reason } = input
  const rows = await sql<BlockedSlot[]>`
    INSERT INTO blocked_slots (barber_id, start_at, end_at, reason)
    VALUES (${barberId}, ${startAt.toISOString()}, ${endAt.toISOString()}, ${reason})
    RETURNING *
  `
  return rows[0]
}

export async function getBlockById(id: string): Promise<BlockedSlot | null> {
  const rows = await db<BlockedSlot[]>`SELECT * FROM blocked_slots WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

export async function deleteBlockById(id: string): Promise<void> {
  await db`DELETE FROM blocked_slots WHERE id = ${id}`
}

export async function listBlocks(opts: {
  barberId?: string | null
  fromUtc: Date
  toUtc: Date
}): Promise<BlockedSlot[]> {
  const { barberId, fromUtc, toUtc } = opts
  return db<BlockedSlot[]>`
    SELECT * FROM blocked_slots
    WHERE start_at < ${toUtc.toISOString()} AND end_at > ${fromUtc.toISOString()}
      ${
        barberId === undefined
          ? db``
          : barberId === null
            ? db`AND barber_id IS NULL`
            : db`AND (barber_id IS NULL OR barber_id = ${barberId})`
      }
    ORDER BY start_at ASC
  `
}

// D10: confirmed appointments overlapping [startAt, endAt) for the affected
// barber(s). A single-barber block (barberId set) hits only that barber; an
// all-barber block (barberId null) hits every barber.
export interface ConflictAppointmentRow {
  id: string
  barber_id: string
  barber_name: string
  start_at: string
  end_at: string
  service_name_nl: string
  customer_id: string
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_email_missing: boolean
}

export async function getConflictingConfirmedAppointments(opts: {
  barberId: string | null
  startAt: Date
  endAt: Date
}): Promise<ConflictAppointmentRow[]> {
  const { barberId, startAt, endAt } = opts
  return db<ConflictAppointmentRow[]>`
    SELECT
      a.id, a.barber_id, b.name AS barber_name, a.start_at, a.end_at,
      s.name_nl AS service_name_nl,
      c.id AS customer_id, c.first_name AS customer_first_name, c.last_name AS customer_last_name,
      c.email AS customer_email, c.email_missing AS customer_email_missing
    FROM appointments a
    JOIN barbers   b ON b.id = a.barber_id
    JOIN services  s ON s.id = a.service_id
    JOIN customers c ON c.id = a.customer_id
    WHERE a.status = 'confirmed'
      AND a.start_at < ${endAt.toISOString()}
      AND a.end_at   > ${startAt.toISOString()}
      ${barberId === null ? db`` : db`AND a.barber_id = ${barberId}`}
    ORDER BY a.start_at ASC
  `
}
