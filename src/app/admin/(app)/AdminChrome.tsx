'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { cn } from '@/components/admin/ui'
import { logoutAction } from '../actions'

export interface NavItem {
  href: string
  label: string
}

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === '/admin'
  return pathname === href || pathname.startsWith(href + '/')
}

export function AdminChrome({
  nav,
  email,
  roleLabel,
  children,
}: {
  nav: NavItem[]
  email: string
  roleLabel: string
  children: ReactNode
}) {
  const t = useTranslations('admin')
  const pathname = usePathname()
  const [mobileOpen, setMobileOpen] = useState(false)

  const navLinks = (onNavigate?: () => void) =>
    nav.map((item) => {
      const active = isActive(pathname, item.href)
      return (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          aria-current={active ? 'page' : undefined}
          className={cn(
            'block rounded-md px-3 py-2 font-display text-[0.8rem] uppercase tracking-display transition-colors',
            active ? 'bg-gold/15 text-gold-deep' : 'text-paper/70 hover:bg-ink-2 hover:text-paper',
          )}
        >
          {item.label}
        </Link>
      )
    })

  const brand = (
    <div className="px-3 py-1">
      <div className="font-serif text-[1.4rem] leading-none text-gold-pale">{t('brand')}</div>
      <div className="font-display text-[0.6rem] uppercase tracking-eyebrow text-gold/60">
        {t('brandSub')}
      </div>
    </div>
  )

  const userBlock = (
    <div className="border-t border-ink-3 px-3 pt-4">
      <div className="truncate text-[0.82rem] text-paper/90" title={email}>
        {email}
      </div>
      <div className="mb-3 font-display text-[0.62rem] uppercase tracking-eyebrow text-gold/60">
        {roleLabel}
      </div>
      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded-md border border-ink-3 px-3 py-1.5 text-[0.78rem] font-display uppercase tracking-display text-paper/80 hover:border-gold hover:text-gold"
        >
          {t('nav.logout')}
        </button>
      </form>
    </div>
  )

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col gap-1 overflow-y-auto bg-ink p-4 lg:flex">
        {brand}
        <nav className="mt-4 flex flex-1 flex-col gap-1">{navLinks()}</nav>
        {userBlock}
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line-paper bg-ink px-4 py-3 lg:hidden">
          <div className="font-serif text-[1.2rem] text-gold-pale">{t('brand')}</div>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Menu"
            className="grid h-9 w-9 place-content-center rounded-md border border-ink-3 text-paper"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </header>

        {mobileOpen ? (
          <div className="border-b border-line-paper bg-ink px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">{navLinks(() => setMobileOpen(false))}</nav>
            <div className="mt-3">{userBlock}</div>
          </div>
        ) : null}

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mx-auto max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
