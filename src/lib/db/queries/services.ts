import db from '../index'
import type { Service } from '../types'

// ─── Admin services editor (FR-061) ─────────────────────────────────────────

// ALL services incl. inactive + walk-in (the editor needs the full list).
export async function listAllServices(): Promise<Service[]> {
  return db<Service[]>`SELECT * FROM services ORDER BY sort_order ASC, name_nl ASC`
}

export async function getServiceById(id: string): Promise<Service | null> {
  const rows = await db<Service[]>`SELECT * FROM services WHERE id = ${id} LIMIT 1`
  return rows[0] ?? null
}

// Columns the editor may set. Locale name/description, price, duration, colour,
// active flag, sort order. (Slug + is_walk_in are intentionally immutable here.)
export interface ServiceUpdateFields {
  name_nl?: string
  name_en?: string
  name_fr?: string | null
  name_es?: string | null
  name_le?: string | null
  description_nl?: string | null
  description_en?: string | null
  description_fr?: string | null
  description_es?: string | null
  description_le?: string | null
  price_cents?: number
  duration_min?: number
  color?: string
  is_active?: boolean
  sort_order?: number
}

export async function updateServiceFields(
  id: string,
  fields: ServiceUpdateFields,
): Promise<Service | null> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return getServiceById(id)
  const patch = Object.fromEntries(entries)
  const rows = await db<Service[]>`
    UPDATE services SET ${db(patch)} WHERE id = ${id} RETURNING *
  `
  return rows[0] ?? null
}

export interface ServiceInsertFields extends ServiceUpdateFields {
  slug: string
  name_nl: string
  name_en: string
  price_cents: number
  duration_min: number
}

export async function insertService(fields: ServiceInsertFields): Promise<Service> {
  const entries = Object.entries(fields).filter(([, v]) => v !== undefined)
  const patch = Object.fromEntries(entries)
  const rows = await db<Service[]>`INSERT INTO services ${db(patch)} RETURNING *`
  return rows[0]
}

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
