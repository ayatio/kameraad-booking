import db from '../index'
import type { Customer, EmailLog } from '../types'

// CRM read/write + GDPR export queries (FR-057..059). Search runs over
// v_customers_overview (FR-057); the purge itself is the gdpr_delete() DB
// function (called from the service), not here.

export interface CustomerOverviewRow extends Customer {
  total_appointments: number
  last_appointment_at: string | null
  first_appointment_at: string | null
  total_spent_cents: number
}

export type CustomerSort = 'last_visit' | 'name'

export async function searchCustomers(opts: {
  q?: string
  sort?: CustomerSort
}): Promise<CustomerOverviewRow[]> {
  const q = opts.q?.trim()
  const like = q ? `%${q}%` : null
  const sort = opts.sort ?? 'last_visit'
  return db<CustomerOverviewRow[]>`
    SELECT * FROM v_customers_overview
    ${
      like
        ? db`WHERE first_name ILIKE ${like}
             OR last_name ILIKE ${like}
             OR (first_name || ' ' || last_name) ILIKE ${like}
             OR email ILIKE ${like}
             OR phone ILIKE ${like}`
        : db``
    }
    ORDER BY ${
      sort === 'name'
        ? db`last_name ASC, first_name ASC`
        : db`last_appointment_at DESC NULLS LAST`
    }
    LIMIT 500
  `
}

export async function getCustomerOverview(id: string): Promise<CustomerOverviewRow | null> {
  const rows = await db<CustomerOverviewRow[]>`
    SELECT * FROM v_customers_overview WHERE id = ${id} LIMIT 1
  `
  return rows[0] ?? null
}

export interface CustomerHistoryRow {
  id: string
  start_at: string
  end_at: string
  status: string
  barber_name: string
  service_name_nl: string
  service_price_cents: number
}

export async function getCustomerAppointmentHistory(
  customerId: string,
): Promise<CustomerHistoryRow[]> {
  return db<CustomerHistoryRow[]>`
    SELECT
      a.id, a.start_at, a.end_at, a.status,
      b.name AS barber_name, s.name_nl AS service_name_nl, s.price_cents AS service_price_cents
    FROM appointments a
    JOIN barbers  b ON b.id = a.barber_id
    JOIN services s ON s.id = a.service_id
    WHERE a.customer_id = ${customerId}
    ORDER BY a.start_at DESC
  `
}

export async function updateCustomerNotes(id: string, notes: string | null): Promise<Customer | null> {
  const rows = await db<Customer[]>`
    UPDATE customers SET notes = ${notes}, updated_at = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

export interface OptinFields {
  marketing_opt_in: boolean
  rebooking_opt_in: boolean
  reminder_opt_in: boolean
}

export async function updateCustomerOptins(
  id: string,
  optins: OptinFields,
): Promise<Customer | null> {
  const rows = await db<Customer[]>`
    UPDATE customers SET
      marketing_opt_in = ${optins.marketing_opt_in},
      rebooking_opt_in = ${optins.rebooking_opt_in},
      reminder_opt_in  = ${optins.reminder_opt_in},
      updated_at       = now()
    WHERE id = ${id}
    RETURNING *
  `
  return rows[0] ?? null
}

// FR-059: every stored datum for one customer, for the GDPR access-request JSON.
export interface CustomerExport {
  customer: Customer
  appointments: unknown[]
  email_log: EmailLog[]
}

export async function getCustomerExport(id: string): Promise<CustomerExport | null> {
  const customers = await db<Customer[]>`SELECT * FROM customers WHERE id = ${id} LIMIT 1`
  const customer = customers[0]
  if (!customer) return null
  const [appointments, emailLog] = await Promise.all([
    db`SELECT * FROM appointments WHERE customer_id = ${id} ORDER BY start_at ASC`,
    db<EmailLog[]>`SELECT * FROM email_log WHERE customer_id = ${id} ORDER BY sent_at ASC`,
  ])
  return { customer, appointments: appointments as unknown[], email_log: emailLog }
}
