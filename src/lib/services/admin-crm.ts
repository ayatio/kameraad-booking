import db from '../db/index'
import {
  searchCustomers as searchCustomersQuery,
  getCustomerOverview,
  getCustomerAppointmentHistory,
  updateCustomerNotes as updateCustomerNotesQuery,
  updateCustomerOptins as updateCustomerOptinsQuery,
  getCustomerExport,
  type CustomerOverviewRow,
  type CustomerHistoryRow,
  type CustomerSort,
  type OptinFields,
  type CustomerExport,
} from '../db/queries/admin-crm'
import { writeAudit, AUDIT } from './audit'
import { assertCan } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { Customer } from '../db/types'

// CRM + GDPR service (FR-057..059, FR-080..083). Search/view/edit are available
// to barbers too (crm.view / crm.edit per §6.2); export + purge are owner-only.

export type { CustomerOverviewRow, CustomerHistoryRow, CustomerSort, OptinFields, CustomerExport }

// ─── Search / detail (FR-057) ───────────────────────────────────────────────

export async function searchCustomers(opts: {
  q?: string
  sort?: CustomerSort
}): Promise<CustomerOverviewRow[]> {
  return searchCustomersQuery(opts)
}

export interface CustomerDetail {
  customer: CustomerOverviewRow
  history: CustomerHistoryRow[]
}

export async function getCustomerDetail(id: string): Promise<CustomerDetail | null> {
  const customer = await getCustomerOverview(id)
  if (!customer) return null
  const history = await getCustomerAppointmentHistory(id)
  return { customer, history }
}

// ─── Edit (FR-057, crm.edit — barbers allowed) ──────────────────────────────

export async function updateCustomerNotes(
  id: string,
  notes: string | null,
  actor: AdminActor,
): Promise<Customer | null> {
  const updated = await updateCustomerNotesQuery(id, notes)
  if (updated) {
    await writeAudit({
      actor: actor.email,
      action: AUDIT.SETTINGS_UPDATE,
      payload: { kind: 'customer_notes', customer_id: id }, // note text omitted (PII)
    })
  }
  return updated
}

export async function updateCustomerOptins(
  id: string,
  optins: OptinFields,
  actor: AdminActor,
): Promise<Customer | null> {
  const updated = await updateCustomerOptinsQuery(id, optins)
  if (updated) {
    await writeAudit({
      actor: actor.email,
      action: AUDIT.SETTINGS_UPDATE,
      payload: {
        kind: 'customer_optins',
        customer_id: id,
        marketing: optins.marketing_opt_in,
        rebooking: optins.rebooking_opt_in,
        reminder: optins.reminder_opt_in,
      },
    })
  }
  return updated
}

// ─── GDPR export (FR-059, owner-only) ───────────────────────────────────────

export async function exportCustomerJson(
  id: string,
  actor: AdminActor,
): Promise<CustomerExport | null> {
  assertCan(actor.role, 'gdpr.delete') // export treated as owner-only (FR-059)
  const data = await getCustomerExport(id)
  if (!data) return null
  await writeAudit({
    actor: actor.email,
    action: AUDIT.GDPR_EXPORT,
    payload: { customer_id: id, appointment_count: data.appointments.length },
  })
  return data
}

// ─── GDPR purge (FR-058 / FR-080..083, owner-only) ──────────────────────────

export type PurgeResult =
  | { ok: true }
  | { ok: false; code: 'CONFIRM_MISMATCH' }

const CONFIRM_PHRASE = 'VERWIJDER' // FR-058 type-to-confirm

export async function purgeCustomer(
  id: string,
  actor: AdminActor,
  confirmText: string,
): Promise<PurgeResult> {
  assertCan(actor.role, 'gdpr.delete') // owner-only (FR-083); throws ForbiddenError otherwise
  if (confirmText !== CONFIRM_PHRASE) {
    return { ok: false, code: 'CONFIRM_MISMATCH' }
  }
  // gdpr_delete() is a single atomic transaction that deletes email_log →
  // appointments → customer AND writes the one PII-free audit event. It is the
  // SOLE audit writer for the purge — we deliberately do NOT writeAudit here.
  await db`SELECT gdpr_delete(${id}::uuid, ${actor.email})`
  return { ok: true }
}
