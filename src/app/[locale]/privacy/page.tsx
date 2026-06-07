import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { PublicShell } from '@/components/public/PublicShell'

// Static marketing/legal page (no DB reads) — prerendered per locale. This is
// the page the footer + booking privacy-consent (FR-024) link to.

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string }
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: 'legal' })
  return { title: t('meta.title'), description: t('meta.description') }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="km-h3 !text-[1.4rem]">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default async function PrivacyPage({
  params: { locale },
}: {
  params: { locale: string }
}) {
  const t = await getTranslations('legal')

  const dataItems = t.raw('dataItems') as string[]
  const rightsItems = t.raw('rightsItems') as string[]

  return (
    <PublicShell locale={locale}>
      <section className="pub-section">
        <article className="pub-wrap" style={{ maxWidth: 720 }}>
          <header>
            <span className="km-eyebrow">{t('eyebrow')}</span>
            <h1 className="km-h1 mt-3 !text-[clamp(2.4rem,5vw,3.6rem)]">{t('title')}</h1>
            <p className="km-small mt-3">{t('updated')}</p>
          </header>

          {/* PROVISIONAL — pending legal review */}
          <p className="km-body mt-8">{t('intro')}</p>

          <Section title={t('controllerTitle')}>
            <p className="km-body">{t('controllerBody')}</p>
          </Section>

          <Section title={t('dataTitle')}>
            <p className="km-body">{t('dataIntro')}</p>
            <ul className="km-body mt-3 list-disc space-y-1 pl-5">
              {dataItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </Section>

          <Section title={t('purposeTitle')}>
            <p className="km-body">{t('purposeBody')}</p>
          </Section>

          <Section title={t('legalBasisTitle')}>
            <p className="km-body">{t('legalBasisBody')}</p>
          </Section>

          <Section title={t('retentionTitle')}>
            <p className="km-body">{t('retentionBody')}</p>
          </Section>

          <Section title={t('rightsTitle')}>
            <p className="km-body">{t('rightsIntro')}</p>
            <ul className="km-body mt-3 list-disc space-y-1 pl-5">
              {rightsItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="km-body mt-3">{t('rightsBody')}</p>
          </Section>

          <Section title={t('cookiesTitle')}>
            <p className="km-body">{t('cookiesBody')}</p>
          </Section>

          <Section title={t('complaintTitle')}>
            <p className="km-body">{t('complaintBody')}</p>
          </Section>

          <p className="km-small mt-12 border-t border-line-paper pt-6">{t('provisional')}</p>
        </article>
      </section>
    </PublicShell>
  )
}
