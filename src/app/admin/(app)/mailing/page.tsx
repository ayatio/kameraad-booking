import { requireAdmin } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { NoAccess } from '@/components/admin/NoAccess'
import { MailingView } from '@/components/admin/MailingView'

export const dynamic = 'force-dynamic'

export default async function MailingPage() {
  const session = await requireAdmin()
  if (!can(session.user.role, 'bulk.email')) return <NoAccess />
  return <MailingView />
}
