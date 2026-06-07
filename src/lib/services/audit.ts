import db from '../db/index'

// Audit trail for privileged mutations (FR-045). Framework-free (D1).
//
// PII CONTRACT: `payload` must be NON-PII. Callers pass ids (or id hashes),
// counts, flags, and enum values ONLY — never names, emails, phone numbers,
// notes, or any free text that could identify a customer (mirrors §8 / FR-080
// which hashes the customer id and stores only counts). The DB column is jsonb;
// the actor is the admin's email by existing schema convention (audit_log.actor
// comments) and is the one identifier intentionally recorded.

// Typed action constants — every privileged mutation uses one of these.
export const AUDIT = {
  SETTINGS_UPDATE: 'settings_update',
  BULK_EMAIL: 'bulk_email',
  GDPR_DELETE: 'gdpr_delete',
  GDPR_EXPORT: 'gdpr_export',
  SERVICE_UPDATE: 'service_update',
  BANNER_UPDATE: 'banner_update',
  ADMIN_INVITE: 'admin_invite',
  ADMIN_RESET: 'admin_reset',
  BLOCK_CANCEL_APPT: 'block_cancel_appointment',
  BOOKING_CANCEL: 'booking_cancel',
  BOOKING_RESCHEDULE: 'booking_reschedule',
  MANUAL_BOOKING: 'manual_booking',
  NO_SHOW: 'no_show',
  COMPLETE: 'complete',
} as const

export type AuditAction = (typeof AUDIT)[keyof typeof AUDIT]

export async function writeAudit(entry: {
  actor: string // admin_users.email or 'system'
  action: string // prefer an AUDIT.* constant
  payload?: Record<string, unknown> // NON-PII only — see contract above
}): Promise<void> {
  await db`
    INSERT INTO audit_log (actor, action, payload)
    VALUES (
      ${entry.actor},
      ${entry.action},
      ${db.json((entry.payload ?? {}) as Parameters<typeof db.json>[0])}
    )
  `
}
