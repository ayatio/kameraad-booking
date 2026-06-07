import { describe, it, expect } from 'vitest'
import { validateHours, resolveBlockConflicts } from '../admin-availability'
import type { ConflictAppointmentRow } from '../../db/queries/blocks'

// Pure unit tests — no DB. Hours validation (FR-054/D8) + D10 conflict mapping.

describe('validateHours (FR-054, D8)', () => {
  it('accepts a valid single window', () => {
    const r = validateHours([{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }])
    expect(r.ok).toBe(true)
  })

  it('accepts two non-overlapping windows on the same day (split shift)', () => {
    const r = validateHours([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '18:00' },
    ])
    expect(r.ok).toBe(true)
  })

  it('rejects a third window on the same day (>2 cap, D8)', () => {
    const r = validateHours([
      { dayOfWeek: 1, startTime: '09:00', endTime: '10:00' },
      { dayOfWeek: 1, startTime: '11:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '14:00' },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Maximaal 2/)
  })

  it('rejects start >= end', () => {
    const r = validateHours([{ dayOfWeek: 2, startTime: '14:00', endTime: '14:00' }])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/vóór eindtijd/)
  })

  it('rejects overlapping windows within a day', () => {
    const r = validateHours([
      { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 3, startTime: '12:00', endTime: '17:00' },
    ])
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.join(' ')).toMatch(/Overlappende/)
  })

  it('allows touching windows (end === next start) — no overlap', () => {
    const r = validateHours([
      { dayOfWeek: 4, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 4, startTime: '12:00', endTime: '15:00' },
    ])
    expect(r.ok).toBe(true)
  })

  it('rejects malformed time strings', () => {
    const r = validateHours([{ dayOfWeek: 1, startTime: '9am', endTime: '25:00' }])
    expect(r.ok).toBe(false)
  })

  it('windows on different days never collide', () => {
    const r = validateHours([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
    ])
    expect(r.ok).toBe(true)
  })
})

describe('resolveBlockConflicts (D10)', () => {
  function appt(id: string): ConflictAppointmentRow {
    return {
      id,
      barber_id: 'b1',
      barber_name: 'Test',
      start_at: '2026-06-15T10:00:00Z',
      end_at: '2026-06-15T10:30:00Z',
      service_name_nl: 'Knippen',
      customer_id: `c-${id}`,
      customer_first_name: 'A',
      customer_last_name: 'B',
      customer_email: `${id}@example.com`,
      customer_email_missing: false,
    }
  }

  it('cancels only those explicitly marked cancel_notify; everything else is kept', () => {
    const conflicts = [appt('1'), appt('2'), appt('3')]
    const { toCancel, toKeep } = resolveBlockConflicts(conflicts, [
      { appointmentId: '1', decision: 'cancel_notify' },
      { appointmentId: '2', decision: 'keep' },
    ])
    expect(toCancel.map((a) => a.id)).toEqual(['1'])
    // '2' explicitly kept; '3' has no decision → defaults to keep (never silent cancel)
    expect(toKeep.map((a) => a.id).sort()).toEqual(['2', '3'])
  })

  it('defaults to keep when resolutions is empty (NEVER silently cancels)', () => {
    const conflicts = [appt('1'), appt('2')]
    const { toCancel, toKeep } = resolveBlockConflicts(conflicts, [])
    expect(toCancel).toHaveLength(0)
    expect(toKeep).toHaveLength(2)
  })

  it('ignores resolutions for non-conflicting appointment ids', () => {
    const conflicts = [appt('1')]
    const { toCancel } = resolveBlockConflicts(conflicts, [
      { appointmentId: '999', decision: 'cancel_notify' },
    ])
    expect(toCancel).toHaveLength(0)
  })
})
