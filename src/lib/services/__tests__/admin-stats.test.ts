import { describe, it, expect } from 'vitest'
import { aggregateStats, statsRangeUtc } from '../admin-stats'
import type { StatsRow } from '../../db/queries/admin-stats'

// Pure unit test — no DB. FR-060 / D19 aggregation shaping on mocked rows.

function row(p: Partial<StatsRow> & Pick<StatsRow, 'status'>): StatsRow {
  return {
    barber_id: 'b1',
    barber_name: 'Adil',
    service_id: 's1',
    service_name_nl: 'Knippen',
    price_cents: 2500,
    ...p,
  }
}

const ROWS: StatsRow[] = [
  row({ status: 'completed' }), // b1/s1 €25 revenue
  row({ status: 'completed', service_id: 's2', service_name_nl: 'Baard', price_cents: 1500 }),
  row({ status: 'cancelled' }),
  row({ status: 'no_show' }),
  row({ status: 'confirmed', barber_id: 'b2', barber_name: 'Sam' }),
]

describe('aggregateStats (FR-060, D19)', () => {
  it('counts bookings/completed/cancelled/no_shows and sums revenue from completed only', () => {
    const s = aggregateStats(ROWS, true)
    expect(s.totals.bookings).toBe(5)
    expect(s.totals.completed).toBe(2)
    expect(s.totals.cancelled).toBe(1)
    expect(s.totals.noShows).toBe(1)
    // revenue = 2500 + 1500 (the two completed) only
    expect(s.totals.revenueCents).toBe(4000)
  })

  it('breaks down per barber and per service', () => {
    const s = aggregateStats(ROWS, true)
    const b1 = s.perBarber.find((b) => b.barberId === 'b1')!
    expect(b1.bookings).toBe(4)
    expect(b1.completed).toBe(2)
    expect(b1.revenueCents).toBe(4000)
    const b2 = s.perBarber.find((b) => b.barberId === 'b2')!
    expect(b2.bookings).toBe(1)
    expect(b2.revenueCents).toBe(0)

    const baard = s.perService.find((x) => x.serviceId === 's2')!
    expect(baard.completed).toBe(1)
    expect(baard.revenueCents).toBe(1500)
  })

  it('null-s out revenue when revenue is out of scope (barber stats.own)', () => {
    const s = aggregateStats(ROWS, false)
    expect(s.totals.revenueCents).toBeNull()
    expect(s.perBarber.every((b) => b.revenueCents === null)).toBe(true)
    expect(s.perService.every((x) => x.revenueCents === null)).toBe(true)
    // counts are still produced
    expect(s.totals.bookings).toBe(5)
  })
})

describe('statsRangeUtc', () => {
  it('day range spans exactly one Brussels day', () => {
    const { fromUtc, toUtc } = statsRangeUtc('day', '2026-06-15')
    expect(toUtc.getTime() - fromUtc.getTime()).toBe(24 * 3_600_000)
  })

  it('custom range treats `to` as inclusive (adds a day)', () => {
    const { fromUtc, toUtc } = statsRangeUtc('custom', '2026-06-15', '2026-06-16')
    // 15th 00:00 → 17th 00:00 = 2 days
    expect(toUtc.getTime() - fromUtc.getTime()).toBe(2 * 24 * 3_600_000)
  })
})
