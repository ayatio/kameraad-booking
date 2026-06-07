import db from '../index'

// Raw rows for the statistics aggregator (FR-060). Walk-in is excluded at the
// source (D11). Aggregation happens in the service (pure + testable).

export interface StatsRow {
  status: string
  barber_id: string
  barber_name: string
  service_id: string
  service_name_nl: string
  price_cents: number
}

export async function getStatsRows(opts: {
  fromUtc: Date
  toUtc: Date
  barberIds?: string[]
}): Promise<StatsRow[]> {
  const { fromUtc, toUtc, barberIds } = opts
  return db<StatsRow[]>`
    SELECT
      a.status,
      a.barber_id, b.name AS barber_name,
      a.service_id, s.name_nl AS service_name_nl, s.price_cents
    FROM appointments a
    JOIN barbers  b ON b.id = a.barber_id
    JOIN services s ON s.id = a.service_id
    WHERE a.start_at >= ${fromUtc.toISOString()} AND a.start_at < ${toUtc.toISOString()}
      AND s.is_walk_in = false
      ${barberIds ? db`AND a.barber_id = ANY(${barberIds})` : db``}
  `
}
