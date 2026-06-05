import db from '../index'
import type { Barber, BarberService } from '../types'

export async function getActiveBarbers(): Promise<Barber[]> {
  return db<Barber[]>`
    SELECT * FROM barbers WHERE is_active = true ORDER BY sort_order ASC
  `
}

export interface BarberWithServices extends Barber {
  service_ids: string[]
}

type BarberServiceRow = Barber & { service_id: string | null }

export async function getActiveBarbersWithServices(): Promise<BarberWithServices[]> {
  const rows = await db<BarberServiceRow[]>`
    SELECT b.*, bs.service_id
    FROM barbers b
    LEFT JOIN barber_services bs ON bs.barber_id = b.id
    WHERE b.is_active = true
    ORDER BY b.sort_order ASC
  `
  const map = new Map<string, BarberWithServices>()
  for (const row of rows) {
    if (!map.has(row.id)) {
      const { service_id: _sid, ...barber } = row
      map.set(row.id, { ...barber, service_ids: [] })
    }
    if (row.service_id) {
      map.get(row.id)!.service_ids.push(row.service_id)
    }
  }
  return Array.from(map.values())
}

export async function getBarberServiceLinks(): Promise<BarberService[]> {
  return db<BarberService[]>`SELECT barber_id, service_id FROM barber_services`
}
