import db from '../db/index'
import {
  getAvailabilityForBarber,
  replaceAvailabilityForBarber,
  type HoursWindowRow,
} from '../db/queries/availability'
import {
  insertBlock,
  getBlockById,
  deleteBlockById,
  listBlocks as listBlocksQuery,
  getConflictingConfirmedAppointments,
  type ConflictAppointmentRow,
} from '../db/queries/blocks'
import { onBookingCancelled } from './email-hooks'
import { writeAudit, AUDIT } from './audit'
import { ForbiddenError, canActOnBarber } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { Appointment, BlockedSlot } from '../db/types'

// Admin availability editors (FR-054..056): weekly hours (D8: ≤2 windows/day)
// and blocked periods with the D10 conflict flow. Changes take effect for
// future slot generation immediately (the engine reads availability live; no
// caching).

// ─── Hours editor (FR-054, D8) ──────────────────────────────────────────────

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/
const MAX_WINDOWS_PER_DAY = 2 // D8

export interface HoursWindow {
  dayOfWeek: number // 0=Sun..6=Sat
  startTime: string // 'HH:MM'
  endTime: string // 'HH:MM'
}

export type HoursValidation =
  | { ok: true; windows: HoursWindow[] }
  | { ok: false; errors: string[] }

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// PURE validation (FR-054): per weekday at most 2 windows (D8), each start<end,
// and no overlap within a day. Returns NL error strings; never throws.
export function validateHours(windows: HoursWindow[]): HoursValidation {
  const errors: string[] = []

  for (const w of windows) {
    if (w.dayOfWeek < 0 || w.dayOfWeek > 6 || !Number.isInteger(w.dayOfWeek)) {
      errors.push(`Ongeldige weekdag: ${w.dayOfWeek}.`)
    }
    if (!HHMM.test(w.startTime) || !HHMM.test(w.endTime)) {
      errors.push(`Ongeldige tijd: ${w.startTime}–${w.endTime}.`)
      continue
    }
    if (toMinutes(w.startTime) >= toMinutes(w.endTime)) {
      errors.push(`Begintijd moet vóór eindtijd liggen (${w.startTime}–${w.endTime}).`)
    }
  }

  // Group by day for the per-day count + overlap checks.
  const byDay = new Map<number, HoursWindow[]>()
  for (const w of windows) {
    if (!byDay.has(w.dayOfWeek)) byDay.set(w.dayOfWeek, [])
    byDay.get(w.dayOfWeek)!.push(w)
  }

  for (const [day, dayWindows] of byDay) {
    if (dayWindows.length > MAX_WINDOWS_PER_DAY) {
      errors.push(`Maximaal ${MAX_WINDOWS_PER_DAY} blokken per dag (dag ${day}).`)
    }
    const sorted = [...dayWindows]
      .filter((w) => HHMM.test(w.startTime) && HHMM.test(w.endTime))
      .sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
    for (let i = 1; i < sorted.length; i++) {
      if (toMinutes(sorted[i].startTime) < toMinutes(sorted[i - 1].endTime)) {
        errors.push(`Overlappende blokken op dag ${day}.`)
        break
      }
    }
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, windows }
}

function assertCanEditBarberHours(actor: AdminActor, barberId: string): void {
  const ok = canActOnBarber({
    role: actor.role,
    actorBarberId: actor.barberId,
    targetBarberId: barberId,
    action: 'manage',
  })
  if (!ok) throw new ForbiddenError('Geen toegang tot deze uren.')
}

export async function getHoursForBarber(barberId: string): Promise<HoursWindow[]> {
  return getAvailabilityForBarber(barberId)
}

export type SetHoursResult = { ok: true; windows: HoursWindow[] } | { ok: false; errors: string[] }

export async function setHoursForBarber(
  barberId: string,
  windows: HoursWindow[],
  actor: AdminActor,
): Promise<SetHoursResult> {
  assertCanEditBarberHours(actor, barberId) // owner: any; barber: own only
  const validation = validateHours(windows)
  if (!validation.ok) return { ok: false, errors: validation.errors }

  await replaceAvailabilityForBarber(barberId, windows as HoursWindowRow[])
  await writeAudit({
    actor: actor.email,
    action: AUDIT.SETTINGS_UPDATE,
    payload: { kind: 'hours', barber_id: barberId, window_count: windows.length },
  })
  return { ok: true, windows }
}

// ─── Blocked periods (FR-055) + D10 conflict flow ───────────────────────────

export type { ConflictAppointmentRow }

export type BlockResolution = { appointmentId: string; decision: 'keep' | 'cancel_notify' }

// PURE D10 mapping: split the conflict list into keep vs cancel by the admin's
// per-appointment decision. Anything NOT explicitly 'cancel_notify' is kept —
// we NEVER silently cancel (FR-055). Exported for unit testing.
export function resolveBlockConflicts(
  conflicts: ConflictAppointmentRow[],
  resolutions: BlockResolution[],
): { toCancel: ConflictAppointmentRow[]; toKeep: ConflictAppointmentRow[] } {
  const decisionById = new Map(resolutions.map((r) => [r.appointmentId, r.decision]))
  const toCancel: ConflictAppointmentRow[] = []
  const toKeep: ConflictAppointmentRow[] = []
  for (const c of conflicts) {
    if (decisionById.get(c.id) === 'cancel_notify') toCancel.push(c)
    else toKeep.push(c)
  }
  return { toCancel, toKeep }
}

function assertCanCreateBlock(actor: AdminActor, barberId: string | null): void {
  if (barberId === null) {
    // All-barber block → owner only (blocks.allbarber).
    if (actor.role !== 'owner') throw new ForbiddenError('Alleen de eigenaar kan een blok voor alle barbiers maken.')
    return
  }
  const ok = canActOnBarber({
    role: actor.role,
    actorBarberId: actor.barberId,
    targetBarberId: barberId,
    action: 'manage',
  })
  if (!ok) throw new ForbiddenError('Geen toegang tot dit blok.')
}

export async function previewBlockConflicts(opts: {
  barberId: string | null
  startAt: Date
  endAt: Date
}): Promise<ConflictAppointmentRow[]> {
  return getConflictingConfirmedAppointments(opts)
}

export interface CommitBlockResult {
  block: BlockedSlot
  summary: {
    cancelled: { appointmentId: string; customerEmail: string; notified: boolean }[]
    kept: string[] // appointment ids left intact
  }
}

export type CommitBlockOutcome =
  | { ok: true; result: CommitBlockResult }
  | { ok: false; code: 'INVALID_RANGE' }

export async function commitBlock(
  input: {
    barberId: string | null
    startAt: Date
    endAt: Date
    reason?: string | null
    resolutions?: BlockResolution[]
  },
  actor: AdminActor,
): Promise<CommitBlockOutcome> {
  const { barberId, startAt, endAt } = input
  if (startAt.getTime() >= endAt.getTime()) return { ok: false, code: 'INVALID_RANGE' }
  assertCanCreateBlock(actor, barberId)

  // Re-read conflicts at commit time (the preview may be stale) and split them.
  const conflicts = await getConflictingConfirmedAppointments({ barberId, startAt, endAt })
  const { toCancel } = resolveBlockConflicts(conflicts, input.resolutions ?? [])

  // Cancel the chosen appointments AND insert the block in ONE transaction, so
  // we never end up with a block but un-cancelled conflicts (or vice versa).
  const { block, cancelledAppts } = await db.begin(async (sql) => {
    const cancelled: Appointment[] = []
    for (const c of toCancel) {
      const rows = await sql<Appointment[]>`
        UPDATE appointments SET
          status              = 'cancelled',
          cancelled_at        = now(),
          cancellation_reason = 'block',
          updated_at          = now()
        WHERE id = ${c.id} AND status = 'confirmed'
        RETURNING *
      `
      if (rows[0]) cancelled.push(rows[0])
    }
    const inserted = await insertBlock(
      { barberId, startAt, endAt, reason: input.reason ?? null },
      sql,
    )
    return { block: inserted, cancelledAppts: cancelled }
  })

  // After commit: notify cancelled customers (best-effort) + audit each cancel
  // (BLOCK_CANCEL_APPT). email_missing customers get no email but are still
  // recorded as cancelled.
  const cancelledSummary: CommitBlockResult['summary']['cancelled'] = []
  for (const appt of cancelledAppts) {
    const conflict = toCancel.find((c) => c.id === appt.id)
    const notify = conflict ? !conflict.customer_email_missing : false
    if (notify) {
      await onBookingCancelled(appt).catch(() => {})
    }
    await writeAudit({
      actor: actor.email,
      action: AUDIT.BLOCK_CANCEL_APPT,
      payload: { appointment_id: appt.id, block_id: block.id, notified: notify },
    })
    cancelledSummary.push({
      appointmentId: appt.id,
      customerEmail: conflict?.customer_email ?? '',
      notified: notify,
    })
  }

  const cancelledIds = new Set(cancelledAppts.map((a) => a.id))
  const kept = conflicts.filter((c) => !cancelledIds.has(c.id)).map((c) => c.id)

  return { ok: true, result: { block, summary: { cancelled: cancelledSummary, kept } } }
}

export type DeleteBlockResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' }

export async function deleteBlock(id: string, actor: AdminActor): Promise<DeleteBlockResult> {
  const block = await getBlockById(id)
  if (!block) return { ok: false, code: 'NOT_FOUND' }
  // Same scope rules as creation (all-barber blocks are owner-only).
  assertCanCreateBlock(actor, block.barber_id)
  await deleteBlockById(id)
  await writeAudit({
    actor: actor.email,
    action: AUDIT.SETTINGS_UPDATE,
    payload: { kind: 'block_delete', block_id: id, all_barber: block.barber_id === null },
  })
  return { ok: true }
}

export async function listBlocks(opts: {
  barberId?: string | null
  fromUtc: Date
  toUtc: Date
}): Promise<BlockedSlot[]> {
  return listBlocksQuery(opts)
}
