import db from '../index'
import type { Service } from '../types'

export async function getActiveServices(): Promise<Service[]> {
  return db<Service[]>`
    SELECT * FROM services WHERE is_active = true ORDER BY sort_order ASC
  `
}

export async function getServiceBySlug(slug: string): Promise<Service | null> {
  const rows = await db<Service[]>`
    SELECT * FROM services WHERE slug = ${slug} AND is_active = true LIMIT 1
  `
  return rows[0] ?? null
}

export async function getServicesForBarber(barberId: string): Promise<Service[]> {
  return db<Service[]>`
    SELECT s.*
    FROM services s
    JOIN barber_services bs ON bs.service_id = s.id AND bs.barber_id = ${barberId}
    WHERE s.is_active = true
    ORDER BY s.sort_order ASC
  `
}
