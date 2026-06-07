import type { ReactNode } from 'react'
import { getTranslations } from 'next-intl/server'
import { requireAdmin } from '@/lib/auth/session'
import { can, type Permission } from '@/lib/auth/permissions'
import { AdminChrome, type NavItem } from './AdminChrome'

// Guarded shell for every authenticated admin screen. requireAdmin() redirects
// to /admin/login when there is no session. Nav items are filtered by the role's
// permissions (FR-044 UI hiding) so a barber never sees owner-only links — the
// pages themselves additionally re-check server-side.

interface NavDef {
  href: string
  key: string
  perm: Permission
}

const NAV: NavDef[] = [
  { href: '/admin', key: 'calendar', perm: 'calendar.own' },
  { href: '/admin/uren', key: 'hours', perm: 'hours.own' },
  { href: '/admin/blokkades', key: 'blocks', perm: 'hours.own' },
  { href: '/admin/klanten', key: 'customers', perm: 'crm.view' },
  { href: '/admin/statistieken', key: 'stats', perm: 'stats.own' },
  { href: '/admin/diensten', key: 'services', perm: 'services.edit' },
  { href: '/admin/banner', key: 'banner', perm: 'content.banner' },
  { href: '/admin/mailing', key: 'mailing', perm: 'bulk.email' },
  { href: '/admin/instellingen', key: 'settings', perm: 'settings.edit' },
]

export default async function AdminAppLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin()
  const t = await getTranslations({ locale: 'nl', namespace: 'admin' })
  const role = session.user.role

  const nav: NavItem[] = NAV.filter((n) => can(role, n.perm)).map((n) => ({
    href: n.href,
    label: t(`nav.${n.key}`),
  }))

  return (
    <AdminChrome
      nav={nav}
      email={session.user.email ?? ''}
      roleLabel={t(`role.${role}`)}
    >
      {children}
    </AdminChrome>
  )
}
