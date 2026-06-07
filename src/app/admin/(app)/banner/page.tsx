import { requireAdmin } from '@/lib/auth/session'
import { can } from '@/lib/auth/permissions'
import { getBanner } from '@/lib/services/admin-content'
import { NoAccess } from '@/components/admin/NoAccess'
import { BannerEditor } from '@/components/admin/BannerEditor'

export const dynamic = 'force-dynamic'

export default async function BannerPage() {
  const session = await requireAdmin()
  if (!can(session.user.role, 'content.banner')) return <NoAccess />
  const banner = await getBanner()
  return <BannerEditor initial={banner} />
}
