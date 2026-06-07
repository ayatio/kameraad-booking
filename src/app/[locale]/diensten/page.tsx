import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getActiveServices } from '@/lib/db/queries/services'
import { PublicShell } from '@/components/public/PublicShell'
import {
  localizeServiceName,
  localizeServiceDesc,
  formatPrice,
  formatDuration,
} from '@/components/public/localize'

// Reads live services (prices/duration are admin-editable, FR-061) so this
// renders at request time rather than being frozen into the build.
export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'services' })
  return { title: t('meta.title'), description: t('meta.description') }
}

export default async function ServicesPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const [t, services] = await Promise.all([getTranslations('services'), getActiveServices()])

  const bookable = services.filter((s) => !s.is_walk_in)
  const walkIn = services.find((s) => s.is_walk_in)

  return (
    <PublicShell locale={locale}>
      <section className="pub-section">
        <div className="pub-wrap" style={{ maxWidth: 880 }}>
          <header className="mb-12 text-center">
            <span className="km-eyebrow">{t('eyebrow')}</span>
            <h1 className="km-h1 mt-3">{t('title')}</h1>
            <p className="km-lead mx-auto mt-5 max-w-[52ch]">{t('lead')}</p>
          </header>

          <ul className="flex flex-col">
            {bookable.map((s) => {
              const desc = localizeServiceDesc(s, locale)
              return (
                <li
                  key={s.id}
                  className="flex flex-col gap-4 border-b border-line-paper py-6 sm:flex-row sm:items-baseline sm:justify-between"
                >
                  <div>
                    <h2 className="km-h3 !text-[1.45rem]">{localizeServiceName(s, locale)}</h2>
                    {desc && <p className="km-body mt-1.5 max-w-[56ch]">{desc}</p>}
                    <p className="km-label mt-2 !text-[0.64rem] text-smoke">
                      {t('durationLabel')}: {formatDuration(s.duration_min)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-baseline gap-5">
                    {/* PROVISIONAL — prices are seeded/under client review (FR-094) */}
                    <span className="font-serif text-[1.5rem] font-semibold text-gold-deep">
                      {formatPrice(s.price_cents)}
                    </span>
                    <Link
                      href={`/${locale}/boeken?service=${s.slug}`}
                      className="pub-btn pub-btn-primary pub-btn-sm"
                    >
                      {t('cta')}
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>

          {/* PROVISIONAL marker on prices/matrix (FR-094) */}
          <p className="km-small mt-5">{t('provisional')}</p>

          {/* D11: walk-in info card */}
          {walkIn && (
            <div className="mt-10 rounded-lg border border-gold/40 bg-gold/[0.06] p-7">
              <h2 className="km-label text-gold-deep">{t('walkInTitle')}</h2>
              <p className="km-body mt-2">{t('walkInBody')}</p>
            </div>
          )}
        </div>
      </section>
    </PublicShell>
  )
}
