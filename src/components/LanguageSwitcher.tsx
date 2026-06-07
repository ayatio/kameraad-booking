'use client'

import Link from 'next/link'
import { useLocale } from 'next-intl'
import { usePathname } from 'next/navigation'

const LOCALES = [
  { code: 'nl', label: 'NL' },
  { code: 'en', label: 'EN' },
  { code: 'fr', label: 'FR' },
  { code: 'es', label: 'ES' },
  { code: 'le', label: 'Leuvens' },
] as const

// FR-093: switches locale while preserving the current path segment.
export function LanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <nav aria-label="Language switcher" className="flex gap-3">
      {LOCALES.map(({ code, label }) => {
        // pathname starts with /locale/...; replace the leading locale segment
        const rest = pathname.replace(new RegExp(`^/${locale}`), '') || '/'
        const href = `/${code}${rest === '/' ? '' : rest}`
        const isCurrent = locale === code

        return (
          <Link
            key={code}
            href={href}
            aria-current={isCurrent ? 'page' : undefined}
            className={
              isCurrent
                ? 'font-bold text-gold-600'
                : 'text-gold-400 hover:text-gold-300'
            }
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
