import { brusselsWallTimeToUtc } from './availability'
import { getStatsRows, type StatsRow } from '../db/queries/admin-stats'

// Statistics (FR-060, D19). Revenue = Σ price_cents of COMPLETED only; walk-in
// excluded (D11, at the query). Owner: shop-wide incl. revenue (stats.shop);
// barber: own bookings/no-shows only, NO revenue (stats.own) — the caller sets
// scope + barberIds + includeRevenue accordingly.

export type StatsRange = 'day' | 'week' | 'month' | 'custom'
export type StatsScope = 'shop' | 'own'

export interface StatsTotals {
  bookings: number
  completed: number
  cancelled: number
  noShows: number
  revenueCents: number | null // null when revenue is out of scope (barber)
}

export interface BarberBreakdown {
  barberId: string
  barberName: string
  bookings: number
  completed: number
  cancelled: number
  noShows: number
  revenueCents: number | null
}

export interface ServiceBreakdown {
  serviceId: string
  serviceName: string
  bookings: number
  completed: number
  revenueCents: number | null
}

export interface StatsResult {
  totals: StatsTotals
  perBarber: BarberBreakdown[]
  perService: ServiceBreakdown[]
}

// ─── Pure aggregation ───────────────────────────────────────────────────────

// Shapes the raw rows into totals + per-barber + per-service breakdowns.
// `includeRevenue=false` zeroes/null-s every revenue field (barber scope).
// Exported for unit testing with mocked rows.
export function aggregateStats(rows: StatsRow[], includeRevenue: boolean): StatsResult {
  const totals: StatsTotals = {
    bookings: 0,
    completed: 0,
    cancelled: 0,
    noShows: 0,
    revenueCents: includeRevenue ? 0 : null,
  }
  const barbers = new Map<string, BarberBreakdown>()
  const services = new Map<string, ServiceBreakdown>()

  for (const r of rows) {
    const completed = r.status === 'completed'
    const cancelled = r.status === 'cancelled'
    const noShow = r.status === 'no_show'
    const revenue = completed ? r.price_cents : 0

    totals.bookings++
    if (completed) totals.completed++
    if (cancelled) totals.cancelled++
    if (noShow) totals.noShows++
    if (includeRevenue) totals.revenueCents = (totals.revenueCents ?? 0) + revenue

    let b = barbers.get(r.barber_id)
    if (!b) {
      b = {
        barberId: r.barber_id,
        barberName: r.barber_name,
        bookings: 0,
        completed: 0,
        cancelled: 0,
        noShows: 0,
        revenueCents: includeRevenue ? 0 : null,
      }
      barbers.set(r.barber_id, b)
    }
    b.bookings++
    if (completed) b.completed++
    if (cancelled) b.cancelled++
    if (noShow) b.noShows++
    if (includeRevenue) b.revenueCents = (b.revenueCents ?? 0) + revenue

    let s = services.get(r.service_id)
    if (!s) {
      s = {
        serviceId: r.service_id,
        serviceName: r.service_name_nl,
        bookings: 0,
        completed: 0,
        revenueCents: includeRevenue ? 0 : null,
      }
      services.set(r.service_id, s)
    }
    s.bookings++
    if (completed) s.completed++
    if (includeRevenue) s.revenueCents = (s.revenueCents ?? 0) + revenue
  }

  return {
    totals,
    perBarber: [...barbers.values()].sort((a, b) => b.bookings - a.bookings),
    perService: [...services.values()].sort((a, b) => b.bookings - a.bookings),
  }
}

// ─── Date range ─────────────────────────────────────────────────────────────

function addDays(localDate: string, days: number): string {
  const [y, mo, d] = localDate.split('-').map(Number)
  return new Date(Date.UTC(y, mo - 1, d + days)).toISOString().slice(0, 10)
}

function brusselsMidnightUtc(localDate: string): Date {
  const d = brusselsWallTimeToUtc(localDate, '00:00')
  if (!d) throw new Error(`Could not resolve Brussels midnight for ${localDate}`)
  return d
}

// Compute the [fromUtc, toUtc) half-open range for a stats request. `to` is an
// INCLUSIVE end date for custom ranges (we add a day to make it exclusive).
export function statsRangeUtc(range: StatsRange, from: string, to?: string): {
  fromUtc: Date
  toUtc: Date
} {
  switch (range) {
    case 'day':
      return { fromUtc: brusselsMidnightUtc(from), toUtc: brusselsMidnightUtc(addDays(from, 1)) }
    case 'week':
      return { fromUtc: brusselsMidnightUtc(from), toUtc: brusselsMidnightUtc(addDays(from, 7)) }
    case 'month': {
      const [y, mo] = from.split('-').map(Number)
      const first = `${y}-${String(mo).padStart(2, '0')}-01`
      const next = mo === 12 ? `${y + 1}-01-01` : `${y}-${String(mo + 1).padStart(2, '0')}-01`
      return { fromUtc: brusselsMidnightUtc(first), toUtc: brusselsMidnightUtc(next) }
    }
    case 'custom': {
      const end = to ?? from
      return { fromUtc: brusselsMidnightUtc(from), toUtc: brusselsMidnightUtc(addDays(end, 1)) }
    }
  }
}

// ─── Public ─────────────────────────────────────────────────────────────────

export async function getStats(opts: {
  range: StatsRange
  from: string // 'YYYY-MM-DD'
  to?: string // 'YYYY-MM-DD' (custom, inclusive)
  barberIds?: string[]
  scope: StatsScope
}): Promise<StatsResult> {
  const { fromUtc, toUtc } = statsRangeUtc(opts.range, opts.from, opts.to)
  const includeRevenue = opts.scope === 'shop' // only owner sees revenue
  const barberIds = opts.barberIds && opts.barberIds.length > 0 ? opts.barberIds : undefined
  const rows = await getStatsRows({ fromUtc, toUtc, barberIds })
  return aggregateStats(rows, includeRevenue)
}
