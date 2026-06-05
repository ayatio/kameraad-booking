import { describe, it, expect } from 'vitest'
import {
  getSlotsForBarber,
  getSlotsAnyBarber,
  assignBarber,
  firstAvailableSlot,
  firstSlotPerDay,
  brusselsWallTimeToUtc,
  utcToBrusselsParts,
  type AvailabilityWindow,
  type BlockedSlot,
  type BusyAppointment,
  type EngineSettings,
} from '../availability'

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const B1 = 'barber-1'
const B2 = 'barber-2'

// Regular test day: 2026-01-05 (Monday, dow=1) in Brussels CET (UTC+1)
const MON = '2026-01-05'
const MON_DOW = 1

// now = Mon 06:00 UTC = Mon 07:00 CET Brussels
const NOW_MON = new Date('2026-01-05T06:00:00Z')

const NO_BLOCKS: BlockedSlot[] = []
const NO_APPTS: BusyAppointment[] = []

function window(barberId: string, dayOfWeek: number, startTime: string, endTime: string): AvailabilityWindow {
  return { barberId, dayOfWeek, startTime, endTime }
}

function block(barberId: string | null, startAt: Date, endAt: Date): BlockedSlot {
  return { barberId, startAt, endAt }
}

function appt(barberId: string, startAt: Date, endAt: Date): BusyAppointment {
  return { barberId, startAt, endAt }
}

function settings(overrides: Partial<EngineSettings> = {}): EngineSettings {
  return { bufferMin: 0, minLeadTimeHours: 0, bookingHorizonDays: 56, ...overrides }
}

// Convert Brussels wall time on MON to UTC (CET = UTC+1)
function monUtc(hhmm: string): Date {
  return brusselsWallTimeToUtc(MON, hhmm)!
}

// ─── Brussels helpers ──────────────────────────────────────────────────────────

describe('brusselsWallTimeToUtc', () => {
  it('converts a regular winter time (CET = UTC+1)', () => {
    const d = brusselsWallTimeToUtc('2026-01-05', '09:00')!
    expect(d).not.toBeNull()
    expect(d.toISOString()).toBe('2026-01-05T08:00:00.000Z')
  })

  it('converts a regular summer time (CEST = UTC+2)', () => {
    const d = brusselsWallTimeToUtc('2026-07-01', '09:00')!
    expect(d).not.toBeNull()
    expect(d.toISOString()).toBe('2026-07-01T07:00:00.000Z')
  })

  it('returns null for spring-forward gap (2026-03-29 02:30)', () => {
    expect(brusselsWallTimeToUtc('2026-03-29', '02:00')).toBeNull()
    expect(brusselsWallTimeToUtc('2026-03-29', '02:15')).toBeNull()
    expect(brusselsWallTimeToUtc('2026-03-29', '02:30')).toBeNull()
    expect(brusselsWallTimeToUtc('2026-03-29', '02:45')).toBeNull()
  })

  it('returns first occurrence (CEST) for fall-back ambiguous times', () => {
    // 02:00 on fall-back day: first occurrence = CEST = UTC+2 → 00:00 UTC
    const d = brusselsWallTimeToUtc('2026-10-25', '02:00')!
    expect(d).not.toBeNull()
    expect(d.toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })
})

describe('utcToBrusselsParts', () => {
  it('decomposes a winter UTC instant', () => {
    const p = utcToBrusselsParts(new Date('2026-01-05T08:00:00Z'))
    expect(p.date).toBe('2026-01-05')
    expect(p.time).toBe('09:00')
    expect(p.hour).toBe(9)
    expect(p.minute).toBe(0)
    expect(p.dayOfWeek).toBe(1) // Monday
  })
})

// ─── FR-011 / FR-012: Grid generation and slot end fitting ─────────────────────

describe('FR-011/FR-012: 15-min grid and slot end fitting', () => {
  const wins = [window(B1, MON_DOW, '09:00', '18:00')]

  it('generates candidates at :00 :15 :30 :45 only', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 60,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    const labels = slots.map((s) => s.localLabel)
    for (const l of labels) {
      const min = parseInt(l.split(':')[1])
      expect([0, 15, 30, 45]).toContain(min)
    }
  })

  it('last offered start for 40-min duration in 09:00–18:00 is 17:15', () => {
    // 17:15 + 40 = 17:55 ≤ 18:00 ✓; 17:30 + 40 = 18:10 > 18:00 ✗
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 40,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    const labels = slots.map((s) => s.localLabel)
    expect(labels).toContain('17:15')
    expect(labels).not.toContain('17:30')
  })

  it('customer-visible endAtUtc = startAtUtc + durationMin (no buffer)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    for (const s of slots) {
      expect(s.endAtUtc.getTime() - s.startAtUtc.getTime()).toBe(30 * 60_000)
    }
  })

  it('first slot starts at window start when it is a 15-min multiple', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    expect(slots[0].localLabel).toBe('09:00')
  })
})

// ─── FR-012: buffer_min shrinks offered set and extends appointment occupancy ──

describe('FR-012: buffer_min', () => {
  const wins = [window(B1, MON_DOW, '09:00', '12:00')]
  const s = settings({ bufferMin: 15, minLeadTimeHours: 0 })

  it('buffer shrinks last offered slot in window (duration=30, buffer=15, window=09:00-12:00)', () => {
    // occupancy = 45 min; last: gridMin + 45 ≤ 720 → gridMin ≤ 675 → 11:15
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).toContain('11:15')
    expect(labels).not.toContain('11:30') // 11:30+30+15=12:15 > 12:00
  })

  it('existing appointment occupancy includes buffer: candidate blocked until appt.endAt + buffer', () => {
    // Appointment 10:00–10:30, buffer=15 → occupancy ends at 10:45
    const a = appt(B1, monUtc('10:00'), monUtc('10:30'))
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: [a],
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    // 10:30 occupancy [10:30, 11:15) overlaps appt occupancy [10:00, 10:45) → blocked
    expect(labels).not.toContain('10:30')
    // 10:45 occupancy [10:45, 11:30) — does NOT overlap [10:00, 10:45) (touching) → offered
    expect(labels).toContain('10:45')
    // 09:45 occupancy [09:45, 10:30+15=10:45?] → wait: 09:45 occupancy = [09:45, 10:30). Does it overlap [10:00, 10:45)? 09:45 < 10:45 AND 10:00 < 10:30 → yes → blocked
    expect(labels).not.toContain('09:45')
    // 09:30 occupancy [09:30, 10:15) overlaps [10:00, 10:45) → blocked (10:00 < 10:15)
    expect(labels).not.toContain('09:30')
    // 09:00 occupancy [09:00, 09:45) — does NOT overlap [10:00, 10:45) → offered
    expect(labels).toContain('09:00')
  })

  it('endAtUtc is customer-visible (durationMin only, no buffer)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    for (const slot of slots) {
      expect(slot.endAtUtc.getTime() - slot.startAtUtc.getTime()).toBe(30 * 60_000)
    }
  })
})

// ─── FR-013: lead time ─────────────────────────────────────────────────────────

describe('FR-013: lead time', () => {
  // now = 2026-01-05T06:00:00Z (07:00 Brussels CET)
  // minLeadTimeHours=2 → cutoff = 08:00 UTC = 09:00 Brussels
  const wins = [window(B1, MON_DOW, '06:00', '18:00')]
  const s = settings({ minLeadTimeHours: 2 })

  it('slot exactly at now + 2h (09:00 Brussels = 08:00 UTC) IS offered', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).toContain('09:00')
  })

  it('slot one grid point before now + 2h (08:45 Brussels = 07:45 UTC) is NOT offered', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).not.toContain('08:45')
  })

  it('slots earlier than now are excluded', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    for (const slot of slots) {
      expect(slot.startAtUtc.getTime()).toBeGreaterThanOrEqual(NOW_MON.getTime() + 2 * 3_600_000)
    }
  })
})

// ─── FR-014: horizon ───────────────────────────────────────────────────────────

describe('FR-014: booking horizon', () => {
  // now = 2026-01-05 (Monday), horizon = 7 days → cap at 2026-01-12
  const s = settings({ bookingHorizonDays: 7, minLeadTimeHours: 0 })
  const winFn = (dow: number) => window(B1, dow, '09:00', '10:00')

  it('slot on today + horizonDays (2026-01-12) IS offered', () => {
    // Jan 12 = Monday = dow 1
    const wins = [winFn(1)]
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: '2026-01-12', toDate: '2026-01-12' },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.length).toBeGreaterThan(0)
  })

  it('slot on today + horizonDays + 1 (2026-01-13) is NOT offered', () => {
    // Jan 13 = Tuesday = dow 2
    const wins = [winFn(2)]
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: '2026-01-13', toDate: '2026-01-13' },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.length).toBe(0)
  })

  it('date range is clamped to the horizon', () => {
    const wins = [winFn(1), winFn(2), winFn(3), winFn(4), winFn(5)]
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: '2026-01-05', toDate: '2026-01-20' }, // beyond horizon
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    for (const slot of slots) {
      expect(slot.localDate <= '2026-01-12').toBe(true)
    }
  })
})

// ─── FR-012: blocks ────────────────────────────────────────────────────────────

describe('FR-012: blocks', () => {
  const wins = [window(B1, MON_DOW, '09:00', '18:00')]
  const s = settings({ minLeadTimeHours: 0 })

  it('barber-specific block removes overlapping slots', () => {
    // Block 10:00–11:00
    const bl = block(B1, monUtc('10:00'), monUtc('11:00'))
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: [bl], appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    // 10:00 occupancy [10:00, 10:30) overlaps block [10:00, 11:00) → blocked
    expect(labels).not.toContain('10:00')
    // 10:30 occupancy [10:30, 11:00) — does overlap [10:00, 11:00)? 10:30 < 11:00 && 10:00 < 11:00 → yes → blocked
    expect(labels).not.toContain('10:30')
    // 09:30 occupancy [09:30, 10:00) — touching block start: 09:30 < 11:00 && 10:00 < 10:00 = false → NOT blocked
    expect(labels).toContain('09:30')
    // 11:00 occupancy [11:00, 11:30) — touching block end: 11:00 < 11:00 = false → NOT blocked
    expect(labels).toContain('11:00')
  })

  it('all-barber block (barberId=null) blocks all barbers', () => {
    const bl = block(null, monUtc('10:00'), monUtc('11:00'))
    const slotsB1 = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: [window(B1, MON_DOW, '09:00', '18:00')],
      blocks: [bl], appointments: NO_APPTS, settings: s,
    })
    const slotsB2 = getSlotsForBarber({
      barberId: B2, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: [window(B2, MON_DOW, '09:00', '18:00')],
      blocks: [bl], appointments: NO_APPTS, settings: s,
    })
    expect(slotsB1.map((x) => x.localLabel)).not.toContain('10:00')
    expect(slotsB2.map((x) => x.localLabel)).not.toContain('10:00')
  })

  it('barber-specific block does NOT affect other barbers', () => {
    const bl = block(B1, monUtc('10:00'), monUtc('11:00'))
    const slots = getSlotsForBarber({
      barberId: B2, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: [window(B2, MON_DOW, '09:00', '18:00')],
      blocks: [bl], appointments: NO_APPTS, settings: s,
    })
    expect(slots.map((x) => x.localLabel)).toContain('10:00')
  })

  it('touching block boundary does NOT conflict ([10:00,10:30) vs block [10:30,11:00))', () => {
    const bl = block(B1, monUtc('10:30'), monUtc('11:00'))
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: [bl], appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.map((x) => x.localLabel)).toContain('10:00')
  })
})

// ─── FR-012: existing appointments ────────────────────────────────────────────

describe('FR-012: existing appointments', () => {
  const wins = [window(B1, MON_DOW, '09:00', '18:00')]
  const s = settings({ minLeadTimeHours: 0 })

  it('appointment removes overlapping candidate slots', () => {
    // Appointment 10:00–10:30
    const a = appt(B1, monUtc('10:00'), monUtc('10:30'))
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: [a],
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).not.toContain('10:00')
    // 09:30 candidate occupancy [09:30, 10:00): touches appt start → NOT blocked
    expect(labels).toContain('09:30')
    // 10:30 candidate occupancy [10:30, 11:00): touches appt end → NOT blocked
    expect(labels).toContain('10:30')
  })

  // Cancelled appointments are not passed in by the caller; no special handling needed in engine.
  it('appointment for a different barber does not block current barber', () => {
    const a = appt(B2, monUtc('10:00'), monUtc('10:30'))
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: [a],
      settings: s,
    })
    expect(slots.map((x) => x.localLabel)).toContain('10:00')
  })
})

// ─── D8: Split shifts ──────────────────────────────────────────────────────────

describe('D8: split shifts', () => {
  const wins = [
    window(B1, MON_DOW, '09:00', '12:00'),
    window(B1, MON_DOW, '14:00', '18:00'),
  ]
  const s = settings({ minLeadTimeHours: 0 })

  it('no slots are offered during the gap (12:00–14:00)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    const gapSlots = labels.filter((l) => l >= '12:00' && l < '14:00')
    expect(gapSlots).toHaveLength(0)
  })

  it('slot whose occupancy crosses the window end is not offered', () => {
    // Duration=30: 11:45 + 30 = 12:15 > 12:00 → must NOT be offered
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.map((x) => x.localLabel)).not.toContain('11:45')
  })

  it('last slot in first window is 11:30 (11:30+30=12:00 ≤ 12:00)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.map((x) => x.localLabel)).toContain('11:30')
  })

  it('first slot in second window starts at 14:00', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slots.map((x) => x.localLabel)).toContain('14:00')
  })
})

// ─── FR-015: DST spring-forward 2026-03-29 ────────────────────────────────────

describe('FR-015 DST spring-forward 2026-03-29', () => {
  // Clocks jump from 02:00 CET → 03:00 CEST; 02:xx local times do not exist.
  const DST_DATE = '2026-03-29'
  const DST_DOW = 0 // Sunday
  const now = new Date('2026-03-28T00:00:00Z')
  const wins = [window(B1, DST_DOW, '01:00', '05:00')]
  const s = settings({ minLeadTimeHours: 0, bookingHorizonDays: 90 })

  it('02:00–02:45 local times are NOT emitted', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).not.toContain('02:00')
    expect(labels).not.toContain('02:15')
    expect(labels).not.toContain('02:30')
    expect(labels).not.toContain('02:45')
  })

  it('01:45 and 03:00 ARE emitted', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).toContain('01:45')
    expect(labels).toContain('03:00')
  })

  it('01:45 local (CET) = 00:45 UTC', () => {
    const d = brusselsWallTimeToUtc(DST_DATE, '01:45')!
    expect(d.toISOString()).toBe('2026-03-29T00:45:00.000Z')
  })

  it('03:00 local (CEST) = 01:00 UTC', () => {
    const d = brusselsWallTimeToUtc(DST_DATE, '03:00')!
    expect(d.toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('slot count: 11 slots offered (15 grid points minus 4 non-existent)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    // Grid 01:00..04:30 = 15 points; 4 non-existent (02:00–02:45) = 11
    expect(slots.length).toBe(11)
  })
})

// ─── FR-015: DST fall-back 2026-10-25 ─────────────────────────────────────────

describe('FR-015 DST fall-back 2026-10-25', () => {
  // Clocks fall from 03:00 CEST → 02:00 CET; 02:xx local times happen twice.
  const DST_DATE = '2026-10-25'
  const DST_DOW = 0 // Sunday
  const now = new Date('2026-10-24T00:00:00Z')
  const wins = [window(B1, DST_DOW, '01:00', '05:00')]
  const s = settings({ minLeadTimeHours: 0, bookingHorizonDays: 90 })

  it('02:00–02:45 are offered exactly once each (no duplicates)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    const count = (l: string) => labels.filter((x) => x === l).length
    expect(count('02:00')).toBe(1)
    expect(count('02:15')).toBe(1)
    expect(count('02:30')).toBe(1)
    expect(count('02:45')).toBe(1)
  })

  it('02:00 local = FIRST occurrence (CEST) = 00:00 UTC', () => {
    const d = brusselsWallTimeToUtc(DST_DATE, '02:00')!
    expect(d.toISOString()).toBe('2026-10-25T00:00:00.000Z')
  })

  it('no duplicate localLabel values', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })

  it('total slot count is 15 (no skipped times)', () => {
    const slots = getSlotsForBarber({
      barberId: B1, durationMin: 30,
      dateRange: { fromDate: DST_DATE, toDate: DST_DATE },
      now, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS, settings: s,
    })
    // Grid 01:00..04:30 = 15 grid points, all valid on fall-back day
    expect(slots.length).toBe(15)
  })
})

// ─── FR-016: no-preference / getSlotsAnyBarber / assignBarber ─────────────────

describe('FR-016: any-barber slots and assignBarber', () => {
  const s = settings({ minLeadTimeHours: 0 })
  const winsB1 = [window(B1, MON_DOW, '09:00', '12:00')]
  const winsB2 = [window(B2, MON_DOW, '10:00', '13:00')]
  const allWins = [...winsB1, ...winsB2]

  it('union includes slots from both barbers', () => {
    const slots = getSlotsAnyBarber({
      barberIds: [B1, B2], durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: allWins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    expect(labels).toContain('09:00') // only B1
    expect(labels).toContain('12:00') // only B2
    expect(labels).toContain('10:00') // both
  })

  it('each local time appears only once in the union', () => {
    const slots = getSlotsAnyBarber({
      barberIds: [B1, B2], durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: allWins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const labels = slots.map((x) => x.localLabel)
    const unique = new Set(labels)
    expect(unique.size).toBe(labels.length)
  })

  it('slot offered by both barbers has both in candidateBarberIds', () => {
    const slots = getSlotsAnyBarber({
      barberIds: [B1, B2], durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: allWins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const shared = slots.find((x) => x.localLabel === '10:00' && x.localDate === MON)
    expect(shared?.candidateBarberIds).toContain(B1)
    expect(shared?.candidateBarberIds).toContain(B2)
  })

  it('slot offered only by B1 (09:00) has only B1 in candidateBarberIds', () => {
    const slots = getSlotsAnyBarber({
      barberIds: [B1, B2], durationMin: 30,
      dateRange: { fromDate: MON, toDate: MON },
      now: NOW_MON, windows: allWins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    const onlyB1 = slots.find((x) => x.localLabel === '09:00')
    expect(onlyB1?.candidateBarberIds).toEqual([B1])
  })

  it('assignBarber picks barber with fewest appointments that day', () => {
    const result = assignBarber({
      localDate: MON,
      startAtUtc: monUtc('10:00'),
      candidateBarberIds: [B1, B2],
      dayAppointmentCounts: { [B1]: 3, [B2]: 1 },
      sortOrder: { [B1]: 0, [B2]: 1 },
    })
    expect(result).toBe(B2)
  })

  it('assignBarber breaks tie by sort_order (lower wins)', () => {
    const result = assignBarber({
      localDate: MON,
      startAtUtc: monUtc('10:00'),
      candidateBarberIds: [B1, B2],
      dayAppointmentCounts: { [B1]: 2, [B2]: 2 },
      sortOrder: { [B1]: 5, [B2]: 2 },
    })
    expect(result).toBe(B2)
  })

  it('assignBarber with missing counts treats missing as 0', () => {
    const result = assignBarber({
      localDate: MON,
      startAtUtc: monUtc('10:00'),
      candidateBarberIds: [B1, B2],
      dayAppointmentCounts: { [B1]: 1 },
      sortOrder: { [B1]: 0, [B2]: 1 },
    })
    expect(result).toBe(B2) // B2 has 0 (< B1's 1)
  })
})

// ─── FR-017a: firstAvailableSlot ──────────────────────────────────────────────

describe('FR-017a: firstAvailableSlot', () => {
  it('returns first slot when available today', () => {
    const wins = [window(B1, MON_DOW, '10:00', '18:00')]
    const s = settings({ minLeadTimeHours: 0 })
    const slot = firstAvailableSlot({
      barberId: B1, durationMin: 30,
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: s,
    })
    expect(slot).not.toBeNull()
    expect(slot!.localLabel).toBe('10:00')
    expect(slot!.localDate).toBe(MON)
  })

  it('skips blocked days and finds slot on next available day', () => {
    // Block entire Monday
    const bl = block(B1, new Date('2026-01-05T00:00:00Z'), new Date('2026-01-06T00:00:00Z'))
    // Tuesday = dow 2
    const wins = [window(B1, MON_DOW, '09:00', '18:00'), window(B1, 2, '09:00', '18:00')]
    const s = settings({ minLeadTimeHours: 0 })
    const slot = firstAvailableSlot({
      barberId: B1, durationMin: 30,
      now: NOW_MON, windows: wins, blocks: [bl], appointments: NO_APPTS,
      settings: s,
    })
    expect(slot).not.toBeNull()
    expect(slot!.localDate).toBe('2026-01-06') // Tuesday
  })

  it('returns null when no slot found within horizon', () => {
    // No windows at all
    const slot = firstAvailableSlot({
      barberId: B1, durationMin: 30,
      now: NOW_MON, windows: [], blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ bookingHorizonDays: 7, minLeadTimeHours: 0 }),
    })
    expect(slot).toBeNull()
  })

  it('does not return slots beyond the horizon', () => {
    // Window only on a weekday 10 days away
    const wins = [window(B1, 3, '09:00', '18:00')] // Wednesday
    const slot = firstAvailableSlot({
      barberId: B1, durationMin: 30,
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ bookingHorizonDays: 3, minLeadTimeHours: 0 }),
    })
    // Within 3 days of Mon Jan 5: Tue Jan 6, Wed Jan 7 — Jan 7 is within horizon (today+3=Jan 8)
    // Actually Jan 7 is within [Jan5, Jan8] inclusive
    if (slot) {
      expect(slot.localDate <= '2026-01-08').toBe(true)
    }
  })
})

// ─── FR-017b: firstSlotPerDay ─────────────────────────────────────────────────

describe('FR-017b: firstSlotPerDay', () => {
  it('returns per-day earliest slot across barbers', () => {
    // B1 available from 10:00, B2 from 09:00 on Monday
    const wins = [window(B1, MON_DOW, '10:00', '18:00'), window(B2, MON_DOW, '09:00', '18:00')]
    const result = firstSlotPerDay({
      barberIds: [B1, B2], durationMin: 30,
      fromDate: MON, days: 1,
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    expect(result[MON]).not.toBeNull()
    expect(result[MON]!.localLabel).toBe('09:00')
    expect(result[MON]!.barberId).toBe(B2)
  })

  it('returns null for a day with no windows (e.g. Sunday with no availability)', () => {
    const wins = [window(B1, MON_DOW, '09:00', '18:00')] // only Monday
    const result = firstSlotPerDay({
      barberIds: [B1], durationMin: 30,
      fromDate: '2026-01-04', days: 1, // Sunday Jan 4
      now: new Date('2026-01-04T06:00:00Z'),
      windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    expect(result['2026-01-04']).toBeNull()
  })

  it('returns null for a fully-booked day', () => {
    const wins = [window(B1, MON_DOW, '09:00', '10:00')]
    // One appointment filling the whole window (09:00–10:00 with duration 60)
    const a = appt(B1, monUtc('09:00'), monUtc('10:00'))
    const result = firstSlotPerDay({
      barberIds: [B1], durationMin: 60,
      fromDate: MON, days: 1,
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: [a],
      settings: settings({ minLeadTimeHours: 0 }),
    })
    expect(result[MON]).toBeNull()
  })

  it('returns null for days beyond the horizon', () => {
    const wins = [window(B1, MON_DOW, '09:00', '18:00')]
    const result = firstSlotPerDay({
      barberIds: [B1], durationMin: 30,
      fromDate: '2026-01-12', days: 2, // Jan 12 within horizon, Jan 13 beyond (horizon=7 days)
      now: NOW_MON, windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ bookingHorizonDays: 7, minLeadTimeHours: 0 }),
    })
    // Jan 13 is beyond horizon (today=Jan5, horizon=Jan12) → null
    expect(result['2026-01-13']).toBeNull()
  })

  it('spans multiple days correctly', () => {
    // Monday and Wednesday windows; Tuesday has none
    const wins = [
      window(B1, 1, '09:00', '10:00'), // Mon
      window(B1, 3, '09:00', '10:00'), // Wed
    ]
    const result = firstSlotPerDay({
      barberIds: [B1], durationMin: 30,
      fromDate: '2026-01-05', days: 3,
      now: new Date('2026-01-05T00:00:00Z'),
      windows: wins, blocks: NO_BLOCKS, appointments: NO_APPTS,
      settings: settings({ minLeadTimeHours: 0 }),
    })
    expect(result['2026-01-05']).not.toBeNull()  // Monday
    expect(result['2026-01-06']).toBeNull()       // Tuesday — no window
    expect(result['2026-01-07']).not.toBeNull()   // Wednesday
  })
})
