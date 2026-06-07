import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Card } from './ui'

// Rendered by owner-only pages when a barber reaches the URL directly. The
// server-side permission check happens BEFORE any privileged data is fetched, so
// this is a true block (FR-044) — the matching API routes also return 403.
export async function NoAccess() {
  const t = await getTranslations({ locale: 'nl', namespace: 'admin' })
  return (
    <Card className="mx-auto max-w-md p-8 text-center">
      <h1 className="font-display text-[1.3rem] uppercase tracking-display text-ink">
        {t('noAccess.title')}
      </h1>
      <p className="mt-2 text-[0.9rem] text-smoke">{t('noAccess.body')}</p>
      <Link
        href="/admin"
        className="mt-5 inline-flex items-center justify-center rounded-md bg-gold px-4 py-2 font-display text-[0.8rem] uppercase tracking-display text-ink hover:bg-gold-bright"
      >
        {t('noAccess.back')}
      </Link>
    </Card>
  )
}
