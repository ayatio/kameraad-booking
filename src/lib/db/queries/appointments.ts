import db from '../index'
import type postgres from 'postgres'
import type { Appointment } from '../types'

type SqlClient = postgres.ISql<{}>

export interface InsertAppointmentInput {
  barberId: string
  serviceId: string
  customerId: string
  startAt: Date
  endAt: Date
  customerNotes: string | null
}

export async function insertAppointment(
  input: InsertAppointmentInput,
  sql: SqlClient,
): Promise<Appointment> {
  const { barberId, serviceId, customerId, startAt, endAt, customerNotes } = input
  const rows = await sql<Appointment[]>`
    INSERT INTO appointments
      (barber_id, service_id, customer_id, start_at, end_at, status, customer_notes)
    VALUES
      (${barberId}, ${serviceId}, ${customerId}, ${startAt.toISOString()}, ${endAt.toISOString()}, 'confirmed', ${customerNotes})
    RETURNING *
  `
  return rows[0]
}

export async function getAppointmentById(id: string): Promise<Appointment | null> {
  const rows = await db<Appointment[]>`SELECT * FROM appointments WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

export async function getAppointmentsByBarberAndDay(
  barberId: string,
  localDate: string,
): Promise<Appointment[]> {
  return db<Appointment[]>`
    SELECT * FROM appointments
    WHERE barber_id = ${barberId}
      AND status NOT IN ('cancelled')
      AND (start_at AT TIME ZONE 'Europe/Brussels')::date = ${localDate}::date
    ORDER BY start_at ASC
  `
}
