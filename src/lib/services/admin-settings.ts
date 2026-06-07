import { getSettings } from '../db/queries/settings'
import { updateSettings } from '../db/queries/settings'
import { writeAudit, AUDIT } from './audit'
import { assertCan } from '../auth/permissions'
import type { AdminActor } from './actor'

// Settings (§2) editor — owner-only (settings.edit). The Phase-2 booking engine
// reads these at request time (force-dynamic), so an edit takes effect with no
// redeploy. Validation mirrors the documented ranges; every write is audited.

export interface SettingsValues {
  cancellation_window_hours: number
  buffer_min: number
  min_lead_time_hours: number
  booking_horizon_days: number
  rebooking_weeks: number
}

interface FieldSpec {
  key: keyof SettingsValues
  min: number
  max: number
  fallback: number
}

// Documented §2 ranges. cancellation_window_hours is 1–72 (FA §2); the rest use
// sensible operational bounds.
export const SETTINGS_SPECS: readonly FieldSpec[] = [
  { key: 'cancellation_window_hours', min: 1, max: 72, fallback: 24 },
  { key: 'buffer_min', min: 0, max: 120, fallback: 0 },
  { key: 'min_lead_time_hours', min: 0, max: 72, fallback: 2 },
  { key: 'booking_horizon_days', min: 1, max: 365, fallback: 56 },
  { key: 'rebooking_weeks', min: 1, max: 52, fallback: 6 },
]

export type SettingsValidation =
  | { ok: true; values: SettingsValues }
  | { ok: false; errors: string[] }

// PURE validation: each key must be an integer within its range. Returns NL
// error strings. Exported for unit testing.
export function validateSettings(raw: Record<string, unknown>): SettingsValidation {
  const errors: string[] = []
  const values = {} as SettingsValues
  for (const spec of SETTINGS_SPECS) {
    const n = Number(raw[spec.key])
    if (!Number.isInteger(n) || n < spec.min || n > spec.max) {
      errors.push(`${spec.key} moet een geheel getal tussen ${spec.min} en ${spec.max} zijn.`)
      continue
    }
    values[spec.key] = n
  }
  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, values }
}

export async function getSettingsValues(): Promise<SettingsValues> {
  const raw = await getSettings()
  const out = {} as SettingsValues
  for (const spec of SETTINGS_SPECS) {
    const n = Number(raw[spec.key])
    out[spec.key] = Number.isFinite(n) ? n : spec.fallback
  }
  return out
}

export type UpdateSettingsResult =
  | { ok: true; values: SettingsValues }
  | { ok: false; errors: string[] }

export async function updateSettingsValues(
  raw: Record<string, unknown>,
  actor: AdminActor,
): Promise<UpdateSettingsResult> {
  assertCan(actor.role, 'settings.edit') // owner-only; throws ForbiddenError otherwise
  const validation = validateSettings(raw)
  if (!validation.ok) return { ok: false, errors: validation.errors }

  await updateSettings({ ...validation.values })
  await writeAudit({
    actor: actor.email,
    action: AUDIT.SETTINGS_UPDATE,
    payload: { kind: 'settings', keys: SETTINGS_SPECS.map((s) => s.key) },
  })
  return { ok: true, values: validation.values }
}
