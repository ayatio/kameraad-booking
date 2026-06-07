import db from '../index'
import type postgres from 'postgres'
import type { Customer } from '../types'

// ISql<{}> is implemented by both Sql and TransactionSql with default type params.
type SqlClient = postgres.ISql<{}>

export async function getCustomerByEmail(email: string): Promise<Customer | null> {
  const rows = await db<Customer[]>`
    SELECT * FROM customers WHERE email = ${email} LIMIT 1
  `
  return rows[0] ?? null
}

export interface UpsertCustomerInput {
  firstName: string
  lastName: string
  email: string
  phone: string | null
  preferredLanguage: string
  consentGivenAt: Date | null
}

export async function getCustomerByUnsubscribeToken(token: string): Promise<Customer | null> {
  const rows = await db<Customer[]>`
    SELECT * FROM customers WHERE unsubscribe_token = ${token} LIMIT 1
  `
  return rows[0] ?? null
}

export async function updateCustomerPreferences(
  customerId: string,
  prefs: { reminders: boolean; rebooking: boolean; marketing: boolean },
): Promise<void> {
  await db`
    UPDATE customers SET
      reminder_opt_in  = ${prefs.reminders},
      rebooking_opt_in = ${prefs.rebooking},
      marketing_opt_in = ${prefs.marketing},
      updated_at       = now()
    WHERE id = ${customerId}
  `
}

export async function upsertCustomer(
  input: UpsertCustomerInput,
  sql: SqlClient,
): Promise<Customer> {
  const { firstName, lastName, email, phone, preferredLanguage, consentGivenAt } = input
  const rows = await sql<Customer[]>`
    INSERT INTO customers (first_name, last_name, email, phone, preferred_language, consent_given_at)
    VALUES (${firstName}, ${lastName}, ${email}, ${phone}, ${preferredLanguage}, ${consentGivenAt})
    ON CONFLICT (email) DO UPDATE SET
      first_name          = EXCLUDED.first_name,
      last_name           = EXCLUDED.last_name,
      phone               = COALESCE(EXCLUDED.phone, customers.phone),
      preferred_language  = EXCLUDED.preferred_language,
      consent_given_at    = COALESCE(EXCLUDED.consent_given_at, customers.consent_given_at),
      updated_at          = now()
    RETURNING *
  `
  return rows[0]
}
