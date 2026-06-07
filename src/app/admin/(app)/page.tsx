import { requireAdmin } from '@/lib/auth/session'
import { getActiveBarbersWithServices } from '@/lib/db/queries/barbers'
import { listAllServices } from '@/lib/services/admin-services'
import { CalendarView } from '@/components/admin/calendar/CalendarView'
import type { BarberLite, ServiceLite, ActorLite } from '@/components/admin/calendar/types'

// Agenda is the admin landing page (FR-046..049). Live data → never prerendered.
export const dynamic = 'force-dynamic'

export default async function CalendarPage() {
  const session = await requireAdmin()
  const [barbers, services] = await Promise.all([
    getActiveBarbersWithServices(),
    listAllServices(),
  ])

  const barberLites: BarberLite[] = barbers.map((b) => ({
    id: b.id,
    name: b.name,
    service_ids: b.service_ids,
  }))
  const serviceLites: ServiceLite[] = services.map((s) => ({
    id: s.id,
    slug: s.slug,
    name_nl: s.name_nl,
    color: s.color,
    duration_min: s.duration_min,
    price_cents: s.price_cents,
    is_active: s.is_active,
    is_walk_in: s.is_walk_in,
  }))
  const actor: ActorLite = {
    role: session.user.role,
    barberId: session.user.barberId,
    email: session.user.email ?? '',
  }

  return <CalendarView barbers={barberLites} services={serviceLites} actor={actor} />
}
