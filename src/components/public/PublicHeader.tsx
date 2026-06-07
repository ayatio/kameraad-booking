import Image from 'next/image'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'

// Shared public chrome: logo → home, nav (Services / About / Contact),
// a Book CTA, and the language switcher (FR-093). Solid ink bar so gold
// text always meets AA contrast regardless of the page beneath it.
export async function PublicHeader({ locale }: { locale: string }) {
  const t = await getTranslations('home')

  const navLinks = [
    { href: `/${locale}/diensten`, label: t('nav.services') },
    { href: `/${locale}/over-ons`, label: t('nav.about') },
    { href: `/${locale}/contact`, label: t('nav.contact') },
  ]

  return (
    <header className="pub-header">
      <div className="pub-header-inner">
        <Link href={`/${locale}`} aria-label="Kameraad Haarsnijder — home" className="shrink-0">
          <Image
            src="/img/logo-gold.png"
            alt="Kameraad Haarsnijder"
            width={298}
            height={133}
            priority
            style={{ height: 34, width: 'auto' }}
          />
        </Link>

        <nav className="pub-nav" aria-label={t('nav.primary')}>
          {navLinks.map((l) => (
            <Link key={l.href} href={l.href} className="pub-nav-link">
              {l.label}
            </Link>
          ))}
          <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary pub-btn-sm">
            {t('nav.book')}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  )
}
