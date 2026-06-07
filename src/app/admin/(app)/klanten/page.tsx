import { requireAdmin } from '@/lib/auth/session'
import { CustomerList } from '@/components/admin/CustomerList'

export const dynamic = 'force-dynamic'

export default async function CustomersPage() {
  await requireAdmin() // crm.view is granted to every admin role
  return <CustomerList />
}
