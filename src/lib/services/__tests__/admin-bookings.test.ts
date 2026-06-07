import { describe, it, expect } from 'vitest'
import { canToggleNoShow } from '../admin-bookings'

// Pure unit test — no DB. D14: no-show may only be toggled once the slot starts.
describe('canToggleNoShow (FR-053 / D14)', () => {
  const start = new Date('2026-06-15T10:00:00Z')

  it('blocks toggling before the slot start', () => {
    expect(canToggleNoShow(new Date(start.getTime() - 1), start)).toBe(false)
    expect(canToggleNoShow(new Date(start.getTime() - 3_600_000), start)).toBe(false)
  })

  it('allows toggling exactly at start', () => {
    expect(canToggleNoShow(new Date(start.getTime()), start)).toBe(true)
  })

  it('allows toggling after start', () => {
    expect(canToggleNoShow(new Date(start.getTime() + 60_000), start)).toBe(true)
  })
})
