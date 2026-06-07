import { requireAdmin } from '@/lib/auth/session'
import { getActiveBarbers } from '@/lib/db/queries/barbers'
import { BlocksEditor } from '@/components/admin/BlocksEditor'

export const dynamic = 'force-dynamic'

export default async function BlocksPage() {
  const session = await requireAdmin()
  const barbers = await getActiveBarbers()
  return (
    <BlocksEditor
      barbers={barbers.map((b) => ({ id: b.id, name: b.name }))}
      role={session.user.role}
      ownBarberId={session.user.barberId}
    />
  )
}
