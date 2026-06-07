import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getActiveBarbers } from '@/lib/db/queries/barbers'
import { PublicShell } from '@/components/public/PublicShell'
import { localizeBarberBio } from '@/components/public/localize'
import { buildMetadata } from '@/lib/seo/metadata'
import type { Locale } from '@/lib/seo/site'

// Reads the live team (active barbers + bios are admin-editable) → request-time.
export const dynamic = 'force-dynamic'

const BARBER_PHOTOS: Record<string, string> = {
  adil: '/img/team-adil.jpg',
  avraz: '/img/team-avraz.jpg',
  simar: '/img/team-simar.jpg',
  bas: '/img/team-bas.jpg',
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'about' })
  return buildMetadata({
    locale: locale as Locale,
    pathKey: 'about',
    title: t('meta.title'),
    description: t('meta.description'),
  })
}

export default async function AboutPage({ params: { locale } }: { params: { locale: string } }) {
  const [t, barbers] = await Promise.all([getTranslations('about'), getActiveBarbers()])

  return (
    <PublicShell locale={locale}>
      {/* ── Story ──────────────────────────────────────────────────────── */}
      <section className="pub-section">
        <div className="pub-wrap grid items-center gap-12 lg:grid-cols-2">
          <div>
            <span className="km-eyebrow">{t('eyebrow')}</span>
            <h1 className="km-h1 mt-3">{t('title')}</h1>
            <p className="km-lead mt-5">{t('lead')}</p>
            {/* PROVISIONAL — agent-drafted brand copy, pending real client text */}
            <p className="km-body mt-6">{t('body1')}</p>
            <p className="km-body mt-4">{t('body2')}</p>
            <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary mt-8">
              {t('cta')}
            </Link>
          </div>
          <div className="relative aspect-[4/5] w-full overflow-hidden rounded-lg shadow-2">
            <Image
              src="/img/chair-street.jpg"
              alt=""
              fill
              sizes="(max-width: 1024px) 90vw, 45vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>

      {/* ── Team ───────────────────────────────────────────────────────── */}
      <section className="pub-section" style={{ background: 'var(--paper-2)' }}>
        <div className="pub-wrap">
          <header className="mb-12 text-center">
            <span className="km-eyebrow">{t('teamEyebrow')}</span>
            <h2 className="km-h2 mt-3">{t('teamTitle')}</h2>
          </header>
          <ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            {barbers.map((b) => {
              const bio = localizeBarberBio(b, locale)
              const photo = BARBER_PHOTOS[b.slug] ?? b.photo_url ?? null
              return (
                <li
                  key={b.id}
                  className="flex flex-col overflow-hidden rounded-lg bg-white shadow-1"
                >
                  <div className="relative aspect-square w-full overflow-hidden bg-ink-2">
                    {photo ? (
                      <Image
                        src={photo}
                        alt={b.name}
                        fill
                        sizes="(max-width: 1024px) 50vw, 25vw"
                        className="object-cover"
                      />
                    ) : (
                      <span className="km-display flex h-full items-center justify-center text-gold-pale">
                        {b.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <h3 className="km-h3 !text-[1.3rem]">{b.name}</h3>
                    <p className="km-label !text-[0.66rem] text-gold-deep">{t('role')}</p>
                    {bio && <p className="km-small mt-1 flex-1">{bio}</p>}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>
    </PublicShell>
  )
}
