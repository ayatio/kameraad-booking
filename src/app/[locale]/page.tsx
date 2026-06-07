import Image from 'next/image'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { getActiveBarbers } from '@/lib/db/queries/barbers'
import { getActiveServices } from '@/lib/db/queries/services'
import { getActiveBanner, type BannerLocale } from '@/lib/services/admin-content'
import { PublicShell } from '@/components/public/PublicShell'
import { JsonLd } from '@/components/seo/JsonLd'
import { buildMetadata } from '@/lib/seo/metadata'
import type { Locale } from '@/lib/seo/site'
import { SlotPreview, type PreviewService } from '@/components/public/SlotPreview'
import {
  localizeBarberBio,
  localizeServiceName,
  localizeServiceDesc,
  formatPrice,
  formatDuration,
} from '@/components/public/localize'

// FR-062: an admin banner edit must reflect on the public home within 60s with
// no redeploy, and the showcase reads live barbers/services/banner — so the
// home can never be statically prerendered.
export const dynamic = 'force-dynamic'

const BARBER_PHOTOS: Record<string, string> = {
  adil: '/img/team-adil.jpg',
  avraz: '/img/team-avraz.jpg',
  simar: '/img/team-simar.jpg',
  bas: '/img/team-bas.jpg',
}

// YYYY-MM-DD for "today" in Europe/Brussels (the slot engine's timezone).
function brusselsToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  // Reuses Delegation A's already-localized home meta strings (single source of
  // truth) and wraps them with canonical/hreflang/OG/twitter/robots.
  const t = await getTranslations({ locale, namespace: 'home' })
  return buildMetadata({
    locale: locale as Locale,
    pathKey: 'home',
    title: t('meta.title'),
    description: t('meta.description'),
  })
}

export default async function HomePage({ params: { locale } }: { params: { locale: string } }) {
  const [t, banner, barbers, services] = await Promise.all([
    getTranslations('home'),
    getActiveBanner(locale as BannerLocale),
    getActiveBarbers(),
    getActiveServices(),
  ])

  const bookableServices = services.filter((s) => !s.is_walk_in)
  const walkIn = services.find((s) => s.is_walk_in)
  const fromDate = brusselsToday()

  // FR-017b: one or two representative services power the slot preview.
  const previewServices: PreviewService[] = bookableServices
    .slice(0, 2)
    .map((s) => ({ slug: s.slug, name: localizeServiceName(s, locale) }))

  return (
    <PublicShell locale={locale}>
      {/* FR-101: HairSalon/LocalBusiness structured data (server-rendered) */}
      <JsonLd />
      {/* FR-100: seasonal banner — rendered ONLY when an active banner exists */}
      {banner && (banner.title || banner.text) && (
        <aside
          className="bg-gold text-ink"
          role="region"
          aria-label={banner.title ?? 'Banner'}
        >
          <div className="pub-wrap px-5 py-3 text-center">
            {banner.title && (
              <p className="font-display text-[0.95rem] font-semibold uppercase tracking-[0.1em]">
                {banner.title}
              </p>
            )}
            {banner.text && <p className="km-body !text-ink/85 mt-0.5">{banner.text}</p>}
          </div>
        </aside>
      )}

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section
        className="on-ink relative isolate flex items-center justify-center overflow-hidden text-center"
        data-section="top"
        style={{ minHeight: 'clamp(560px, 86vh, 820px)' }}
      >
        <Image
          src="/img/gallery-oldschool.jpg"
          alt=""
          fill
          priority
          quality={55}
          sizes="100vw"
          className="-z-10 object-cover"
        />
        <div
          className="absolute inset-0 -z-10"
          aria-hidden="true"
          style={{
            background:
              'linear-gradient(180deg, rgba(22,20,15,.72) 0%, rgba(22,20,15,.55) 40%, rgba(22,20,15,.82) 100%)',
          }}
        />
        <div className="pub-wrap flex flex-col items-center gap-6 px-5 py-20">
          <span className="km-eyebrow">{t('hero.eyebrow')}</span>
          <Image
            src="/img/hero-banner.png"
            alt="Kameraad Haarsnijder"
            width={1843}
            height={1057}
            priority
            sizes="(max-width: 700px) 90vw, 640px"
            className="h-auto w-[min(90vw,640px)]"
          />
          <h1 className="km-h2 max-w-[20ch] text-paper">{t('hero.headline')}</h1>
          <p className="km-lead max-w-[42ch]" style={{ color: '#d9d2c4' }}>
            {t('hero.tagline')}
          </p>
          <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary mt-2">
            {t('hero.cta')}
          </Link>
        </div>
      </section>

      {/* ── Intro / the ritual ─────────────────────────────────────────── */}
      <section className="pub-section">
        <div className="pub-wrap flex flex-col items-center text-center" style={{ maxWidth: 760 }}>
          <div className="km-ornament w-full" aria-hidden="true">
            <span className="dot" />
          </div>
          <span className="km-eyebrow mt-6">{t('intro.eyebrow')}</span>
          <p className="km-h3 mt-4" style={{ fontFamily: 'var(--font-serif)' }}>
            {t('intro.lead')}
          </p>
          <p className="km-body mt-6">{t('intro.body')}</p>
        </div>
      </section>

      {/* ── Team showcase (FR-100) ─────────────────────────────────────── */}
      <section className="pub-section" style={{ background: 'var(--paper-2)' }} data-section="team">
        <div className="pub-wrap">
          <header className="mb-12 text-center">
            <span className="km-eyebrow">{t('team.eyebrow')}</span>
            <h2 className="km-h2 mt-3">{t('team.title')}</h2>
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
                    <p className="km-label !text-[0.66rem] text-gold-deep">{t('team.role')}</p>
                    {bio && <p className="km-small mt-1 flex-1">{bio}</p>}
                    <Link
                      href={`/${locale}/boeken?barber=${b.slug}`}
                      className="km-label mt-2 inline-flex items-center gap-1.5 text-gold-deep transition-colors hover:text-gold"
                    >
                      {t('team.bookWith', { name: b.name })} →
                    </Link>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* ── Services & prices (FR-100) ─────────────────────────────────── */}
      <section className="pub-section" data-section="services">
        <div className="pub-wrap" style={{ maxWidth: 860 }}>
          <header className="mb-10 text-center">
            <span className="km-eyebrow">{t('services.eyebrow')}</span>
            <h2 className="km-h2 mt-3">{t('services.title')}</h2>
          </header>
          <ul className="flex flex-col">
            {bookableServices.map((s) => {
              const desc = localizeServiceDesc(s, locale)
              return (
                <li
                  key={s.id}
                  className="flex items-baseline justify-between gap-4 border-b border-line-paper py-5"
                >
                  <div>
                    <h3 className="km-h3 !text-[1.35rem]">{localizeServiceName(s, locale)}</h3>
                    {desc && <p className="km-small mt-1 max-w-[52ch]">{desc}</p>}
                    <p className="km-label mt-1 !text-[0.64rem] text-smoke">
                      {t('services.durationLabel')}: {formatDuration(s.duration_min)}
                    </p>
                  </div>
                  <span className="font-serif text-[1.4rem] font-semibold text-gold-deep">
                    {formatPrice(s.price_cents)}
                  </span>
                </li>
              )
            })}
          </ul>
          {/* PROVISIONAL — prices are seeded/under client review (FR-094) */}
          <p className="km-small mt-4">{t('services.provisional')}</p>

          {/* D11: walk-in info card (not bookable) */}
          {walkIn && (
            <div className="mt-8 rounded-lg border border-gold/40 bg-gold/[0.06] p-6">
              <h3 className="km-label text-gold-deep">{t('services.walkInTitle')}</h3>
              <p className="km-body mt-2">{t('services.walkInBody')}</p>
            </div>
          )}

          <div className="mt-10 text-center">
            <Link href={`/${locale}/diensten`} className="pub-btn pub-btn-primary">
              {t('services.viewAll')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Next-available slots (FR-017b / FR-022) ────────────────────── */}
      <section className="on-ink pub-section" style={{ background: 'var(--ink)' }}>
        <div className="pub-wrap" style={{ maxWidth: 920 }}>
          <header className="mb-8">
            <span className="km-eyebrow">{t('slots.eyebrow')}</span>
            <h2 className="km-h2 mt-3 text-paper">{t('slots.title')}</h2>
            <p className="km-lead mt-3 max-w-[48ch]" style={{ color: '#c8c1b2' }}>
              {t('slots.lead')}
            </p>
          </header>
          {previewServices.length > 0 ? (
            <SlotPreview locale={locale} fromDate={fromDate} services={previewServices} />
          ) : (
            <p className="km-small" style={{ color: '#8f897c' }}>
              {t('slots.empty')}
            </p>
          )}
          <div className="mt-8">
            <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary">
              {t('slots.cta')}
            </Link>
          </div>
        </div>
      </section>

      {/* ── Visit / final CTA band ─────────────────────────────────────── */}
      <section
        className="on-ink pub-section"
        style={{ background: '#100f0b', borderTop: '1px solid var(--line-on-ink)' }}
        data-section="visit"
      >
        <div className="pub-wrap grid gap-10 md:grid-cols-2">
          <div>
            <span className="km-eyebrow">{t('visit.eyebrow')}</span>
            <h2 className="km-h2 mt-3 text-paper">{t('visit.title')}</h2>
            <h3 className="km-label mt-8 text-gold-pale">{t('visit.addressLabel')}</h3>
            {/* -- PROVISIONAL: address/phone unconfirmed (client data pending) -- */}
            <address className="km-body not-italic mt-2" style={{ color: '#c8c1b2' }}>
              Parijsstraat 29
              <br />
              3000 Leuven, België
              <br />
              <a href="mailto:info@kameraadhaarsnijder.be" className="underline hover:text-paper">
                info@kameraadhaarsnijder.be
              </a>
              <br />
              <a href="tel:+32486336714" className="hover:text-paper">
                +32 486 33 67 14
              </a>
            </address>
            <p className="km-small mt-4 max-w-[42ch]" style={{ color: '#8f897c' }}>
              {t('visit.callNote')}
            </p>
          </div>
          <div>
            <h3 className="km-label text-gold-pale">{t('visit.hoursLabel')}</h3>
            {/* -- PROVISIONAL: opening hours unconfirmed -- */}
            <p className="km-body mt-2" style={{ color: '#c8c1b2' }}>
              {t('visit.hoursValue')}
            </p>
            <p className="km-small mt-1" style={{ color: '#8f897c' }}>
              {t('visit.hoursNote')}
            </p>
            <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary mt-8">
              {t('visit.cta')}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
