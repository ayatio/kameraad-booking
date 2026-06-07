import { requireAdmin } from '@/lib/auth/session'
import { getActiveBarbers } from '@/lib/db/queries/barbers'
import { HoursEditor } from '@/components/admin/HoursEditor'

export const dynamic = 'force-dynamic'

export default async function HoursPage() {
  const session = await requireAdmin()
  const barbers = await getActiveBarbers()
  return (
    <HoursEditor
      barbers={barbers.map((b) => ({ id: b.id, name: b.name }))}
      role={session.user.role}
      ownBarberId={session.user.barberId}
    />
  )
}
