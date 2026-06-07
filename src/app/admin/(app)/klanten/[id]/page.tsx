import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getCustomerDetail } from '@/lib/services/admin-crm'
import { CustomerDetailView } from '@/components/admin/CustomerDetailView'

export const dynamic = 'force-dynamic'

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const session = await requireAdmin() // crm.view: all roles
  const detail = await getCustomerDetail(params.id)
  if (!detail) notFound()
  return <CustomerDetailView detail={detail} canDelete={can(session.user.role, 'gdpr.delete')} />
}
