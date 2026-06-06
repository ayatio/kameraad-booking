import db from '../db/index'
import type { Appointment, Barber, Customer, Service } from '../db/types'
import { sendAppointmentEmail } from '../email/send'

// SEQUENCE simplification: we do not store a sequence counter in the schema.
// confirmation → SEQUENCE:0 (initial REQUEST)
// reschedule   → SEQUENCE:1 (METHOD:REQUEST, bumped once)
// cancellation → SEQUENCE:1 (METHOD:CANCEL)
// This is sufficient for RFC 5545 §3.7.4 — calendar clients accept monotonic bumps.

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
  await sendAppointmentEmail({ type: 'cancellation', appointment, ...deps })
}

export async function onBookingRescheduled(appointment: Appointment): Promise<void> {
  const deps = await fetchDeps(appointment)
  if (!deps) return
  await sendAppointmentEmail({ type: 'reschedule', appointment, ...deps, sequence: 1 })
}
