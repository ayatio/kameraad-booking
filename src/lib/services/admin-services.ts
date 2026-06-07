import {
  listAllServices as listAllServicesQuery,
  getServiceById,
  updateServiceFields,
  insertService,
  type ServiceUpdateFields,
  type ServiceInsertFields,
} from '../db/queries/services'
import { writeAudit, AUDIT } from './audit'
import { assertCan } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { Service } from '../db/types'

// Services & prices editor (FR-061). Owner-only (services.edit). Per-locale
// names/descriptions, price, duration, colour, active, sort. NOTE: a duration
// change affects only FUTURE bookings — existing appointments keep their stored
// start/end; we never rewrite them. PROVISIONAL seed copy is left untouched
// unless the owner explicitly edits a field.

export type { ServiceUpdateFields }

export async function listAllServices(): Promise<Service[]> {
  return listAllServicesQuery()
}

export type UpdateServiceResult =
  | { ok: true; service: Service }
  | { ok: false; code: 'NOT_FOUND' }

export async function updateService(
  id: string,
  fields: ServiceUpdateFields,
  actor: AdminActor,
): Promise<UpdateServiceResult> {
  assertCan(actor.role, 'services.edit') // owner-only; throws ForbiddenError otherwise
  const existing = await getServiceById(id)
  if (!existing) return { ok: false, code: 'NOT_FOUND' }

  const updated = await updateServiceFields(id, fields)
  if (!updated) return { ok: false, code: 'NOT_FOUND' }

  await writeAudit({
    actor: actor.email,
    action: AUDIT.SERVICE_UPDATE,
    // Only the changed keys — no copy dumps (keeps the audit PII/clutter-free).
    payload: { service_id: id, changed: Object.keys(fields) },
  })
  return { ok: true, service: updated }
}

export async function createService(
  fields: ServiceInsertFields,
  actor: AdminActor,
): Promise<Service> {
  assertCan(actor.role, 'services.edit')
  const created = await insertService(fields)
  await writeAudit({
    actor: actor.email,
    action: AUDIT.SERVICE_UPDATE,
    payload: { service_id: created.id, created: true },
  })
  return created
}
