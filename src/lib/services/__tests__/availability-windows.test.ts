import { describe, expect, it } from 'vitest'
import { validateWindows } from '../availability-windows'

describe('validateWindows', () => {
  it('accepts an empty window list', () => {
    expect(validateWindows([])).toEqual({ ok: true, errors: [] })
  })

  it('accepts a single valid window', () => {
    const result = validateWindows([{ dayOfWeek: 1, startTime: '09:00', endTime: '18:00' }])
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a window where start equals end', () => {
    const result = validateWindows([{ dayOfWeek: 2, startTime: '09:00', endTime: '09:00' }])
    expect(result.ok).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('startTime')
  })

  it('rejects a window where start is after end', () => {
    const result = validateWindows([{ dayOfWeek: 3, startTime: '18:00', endTime: '09:00' }])
    expect(result.ok).toBe(false)
    expect(result.errors[0]).toMatch(/startTime.*must be before.*endTime|endTime.*startTime/i)
  })

  it('rejects overlapping windows on the same day (full overlap)', () => {
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 1, startTime: '12:00', endTime: '16:00' },
    ])
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('overlap'))).toBe(true)
  })

  it('rejects overlapping windows on the same day (partial overlap)', () => {
    const result = validateWindows([
      { dayOfWeek: 2, startTime: '09:00', endTime: '14:00' },
      { dayOfWeek: 2, startTime: '13:00', endTime: '18:00' },
    ])
    expect(result.ok).toBe(false)
    expect(result.errors.some((e) => e.includes('overlap'))).toBe(true)
  })

  it('rejects adjacent windows that share a boundary (aEnd === bStart is NOT an overlap)', () => {
    // Adjacent windows touching at 13:00 do NOT overlap — the intervals are half-open [start, end)
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
      { dayOfWeek: 1, startTime: '13:00', endTime: '18:00' },
    ])
    expect(result.ok).toBe(true)
  })

  it('allows non-overlapping split shifts on the same day (D8)', () => {
    // Morning shift + afternoon shift = valid split shift
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
    ])
    expect(result.ok).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('allows overlapping times on DIFFERENT days', () => {
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 2, startTime: '09:00', endTime: '18:00' },
      { dayOfWeek: 3, startTime: '09:00', endTime: '18:00' },
    ])
    expect(result.ok).toBe(true)
  })

  it('collects multiple errors independently', () => {
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '18:00', endTime: '09:00' }, // bad start/end
      { dayOfWeek: 1, startTime: '08:00', endTime: '12:00' }, // overlaps with next
      { dayOfWeek: 1, startTime: '10:00', endTime: '14:00' }, // overlaps with previous
    ])
    expect(result.ok).toBe(false)
    expect(result.errors.length).toBeGreaterThanOrEqual(2)
  })

  it('handles three windows on the same day, two overlapping', () => {
    const result = validateWindows([
      { dayOfWeek: 4, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 4, startTime: '13:00', endTime: '17:00' },
      { dayOfWeek: 4, startTime: '16:00', endTime: '19:00' }, // overlaps window 2
    ])
    expect(result.ok).toBe(false)
    const overlapErrors = result.errors.filter((e) => e.includes('overlap'))
    expect(overlapErrors).toHaveLength(1)
  })

  it('accepts multiple barbers each with a split shift on the same weekday', () => {
    // Different barbers would have different dayOfWeek in the same list only if tested
    // together; for app-level validation the list is per-barber, so same days are fine.
    const result = validateWindows([
      { dayOfWeek: 1, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
      { dayOfWeek: 5, startTime: '09:00', endTime: '12:00' },
      { dayOfWeek: 5, startTime: '14:00', endTime: '18:00' },
    ])
    expect(result.ok).toBe(true)
  })
})
