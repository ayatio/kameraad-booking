import type { Role } from '@/lib/auth/permissions'

// Lightweight DTOs the server page passes into the (client) calendar tree.

export interface BarberLite {
  id: string
  name: string
  service_ids: string[]
}

export interface ServiceLite {
  id: string
  slug: string
  name_nl: string
  color: string
  duration_min: number
  price_cents: number
  is_active: boolean
  is_walk_in: boolean
}

export interface ActorLite {
  role: Role
  barberId: string | null
  email: string
}

// Whether the actor may MANAGE (mutate) a given barber's bookings — mirrors
// canActOnBarber('manage'): owner → always; barber → own only.
export function canManage(actor: ActorLite, barberId: string): boolean {
  if (actor.role === 'owner') return true
  return actor.barberId !== null && actor.barberId === barberId
}
