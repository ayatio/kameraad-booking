import db from '../db/index'
import type { Appointment, Barber, Customer, Service } from '../db/types'
import { sendAppointmentEmail } from '../email/send'

// SEQUENCE (FR-071): the counter is persisted on appointments.ics_sequence
// (migration 004). confirmation → 0 (initial REQUEST); every reschedule does
// `ics_sequence = ics_sequence + 1` (manage.ts / admin-bookings.ts) and the
// reschedule/cancel email reads the CURRENT row value — so a second reschedule
// correctly emits SEQUENCE:2 and a later CANCEL never regresses below the last
// REQUEST (RFC 5545 §3.8.7.4).

async function fetchDeps(
  appointment: Appointment,
): Promise<{ customer: Customer; barber: Barber; service: Service } | null> {
  const [customers, barbers, services] = await Promise.all([
    db<Customer[]>`SELECT * FROM customers WHERE id = ${appointment.customer_id} LIMIT 1`,
    db<Barber[]>`SELECT * FROM barbers WHERE id = ${appointment.barber_id} LIMIT 1`,
    db<Service[]>`SELECT * FROM services WHERE id = ${appointment.service_id} LIMIT 1`,
  ])
  const customer = customers[0]
  const barber = barbers[0]
  const service = services[0]
  if (!customer || !barber || !service) return null
  return { customer, barber, service }
}

export async function onBookingConfirmed(appointment: Appointment): Promise<void> {
  const deps = await fetchDeps(appointment)
  if (!deps) return
  await sendAppointmentEmail({ type: 'confirmation', appointment, ...deps, sequence: 0 })
}

export async function onBookingCancelled(appointment: Appointment): Promise<void> {
  const deps = await fetchDeps(appointment)
  if (!deps) return
  // CANCEL carries the current persisted sequence (no further bump).
  await sendAppointmentEmail({
    type: 'cancellation',
    appointment,
    ...deps,
    sequence: appointment.ics_sequence,
  })
}

export async function onBookingRescheduled(appointment: Appointment): Promise<void> {
  const deps = await fetchDeps(appointment)
  if (!deps) return
  // The reschedule already bumped ics_sequence; read the new value off the row.
  await sendAppointmentEmail({
    type: 'reschedule',
    appointment,
    ...deps,
    sequence: appointment.ics_sequence,
  })
}
