import { requireAdmin } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { listAllServices } from '@/lib/services/admin-services'
import { NoAccess } from '@/components/admin/NoAccess'
import { ServicesEditor } from '@/components/admin/ServicesEditor'

export const dynamic = 'force-dynamic'

export default async function ServicesPage() {
  const session = await requireAdmin()
  // Server-side block: a barber typing this URL gets the 403 state, no data read.
  if (!can(session.user.role, 'services.edit')) return <NoAccess />
  const services = await listAllServices()
  return <ServicesEditor initialServices={services} />
}
