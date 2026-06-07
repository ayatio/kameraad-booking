import { requireAdmin } from '@/lib/auth/session'
import { StatsView } from '@/components/admin/StatsView'

export const dynamic = 'force-dynamic'

export default async function StatsPage() {
  const session = await requireAdmin()
  return <StatsView isOwner={session.user.role === 'owner'} />
}
