import { requireAdmin } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getSettingsValues } from '@/lib/services/admin-settings'
import { NoAccess } from '@/components/admin/NoAccess'
import { SettingsEditor } from '@/components/admin/SettingsEditor'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const session = await requireAdmin()
  if (!can(session.user.role, 'settings.edit')) return <NoAccess />
  const values = await getSettingsValues()
  return <SettingsEditor initial={values} />
}
