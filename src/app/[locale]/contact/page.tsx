import Link from 'next/link'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PublicShell } from '@/components/public/PublicShell'
import { buildMetadata } from '@/lib/seo/metadata'
import type { Locale } from '@/lib/seo/site'

// Static marketing page (no DB reads) — safe to prerender per locale.

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'contact' })
  return buildMetadata({
    locale: locale as Locale,
    pathKey: 'contact',
    title: t('meta.title'),
    description: t('meta.description'),
  })
}

export default async function ContactPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const t = await getTranslations('contact')

  return (
    <PublicShell locale={locale}>
      <section className="pub-section">
        <div className="pub-wrap" style={{ maxWidth: 820 }}>
          <header className="mb-12 text-center">
            <span className="km-eyebrow">{t('eyebrow')}</span>
            <h1 className="km-h1 mt-3">{t('title')}</h1>
            <p className="km-lead mx-auto mt-5 max-w-[48ch]">{t('lead')}</p>
          </header>

          {/* -- PROVISIONAL: all contact data unconfirmed (client data pending) -- */}
          <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
            <div>
              <dt className="km-label text-gold-deep">{t('addressLabel')}</dt>
              <dd className="km-body mt-2 whitespace-pre-line">{t('addressValue')}</dd>
              <Link
                href="https://www.google.com/maps/search/?api=1&query=Parijsstraat+29+3000+Leuven"
                className="km-small mt-2 inline-block underline hover:text-gold-deep"
                target="_blank"
                rel="noopener noreferrer"
              >
                Google Maps →
              </Link>
            </div>

            <div>
              <dt className="km-label text-gold-deep">{t('hoursLabel')}</dt>
              <dd className="km-body mt-2">{t('hoursValue')}</dd>
              <p className="km-small mt-1">{t('hoursNote')}</p>
            </div>

            <div>
              <dt className="km-label text-gold-deep">{t('emailLabel')}</dt>
              <dd className="km-body mt-2">
                <a href="mailto:info@kameraadhaarsnijder.be" className="underline hover:text-gold-deep">
                  info@kameraadhaarsnijder.be
                </a>
              </dd>
              <dt className="km-label mt-6 text-gold-deep">{t('phoneLabel')}</dt>
              <dd className="km-body mt-2">
                <a href="tel:+32486336714" className="hover:text-gold-deep">
                  +32 486 33 67 14
                </a>
              </dd>
            </div>

            <div>
              <dt className="km-label text-gold-deep">{t('vatLabel')}</dt>
              <dd className="km-body mt-2">{t('vatValue')}</dd>
            </div>
          </dl>

          <p className="km-small mt-10 max-w-[52ch]">{t('callNote')}</p>

          <div className="mt-8">
            <Link href={`/${locale}/boeken`} className="pub-btn pub-btn-primary">
              {t('cta')}
            </Link>
          </div>
        </div>
      </section>
    </PublicShell>
  )
}
