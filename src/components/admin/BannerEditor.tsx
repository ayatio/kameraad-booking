'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Content } from '@/lib/db/types'
import { apiPut } from '@/components/admin/api'
import { PageHeader, Card, Button, Field, TextInput, Textarea, Toggle, Alert } from '@/components/admin/ui'

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const
type Locale = (typeof LOCALES)[number]

export function BannerEditor({ initial }: { initial: Content | null }) {
  const t = useTranslations('admin')
  const [titles, setTitles] = useState<Record<Locale, string>>(() => ({
    nl: initial?.title_nl ?? '',
    en: initial?.title_en ?? '',
    fr: initial?.title_fr ?? '',
    es: initial?.title_es ?? '',
    le: initial?.title_le ?? '',
  }))
  const [texts, setTexts] = useState<Record<Locale, string>>(() => ({
    nl: initial?.text_nl ?? '',
    en: initial?.text_en ?? '',
    fr: initial?.text_fr ?? '',
    es: initial?.text_es ?? '',
    le: initial?.text_le ?? '',
  }))
  const [active, setActive] = useState(initial?.is_active ?? false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const localeLabel: Record<Locale, string> = {
    nl: t('banner.localeNl'),
    en: t('banner.localeEn'),
    fr: t('banner.localeFr'),
    es: t('banner.localeEs'),
    le: t('banner.localeLe'),
  }

  async function save() {
    setBusy(true)
    setNotice(null)
    setError(null)
    const toMap = (m: Record<Locale, string>) =>
      Object.fromEntries(LOCALES.map((l) => [l, m[l].trim() || null]))
    const res = await apiPut('/api/admin/banner', {
      titles: toMap(titles),
      texts: toMap(texts),
      isActive: active,
    })
    setBusy(false)
    if (res.ok) setNotice(t('banner.saved'))
    else setError(t('common.error'))
  }

  return (
    <div>
      <PageHeader title={t('banner.title')} description={t('banner.subtitle')} />

      {error ? (
        <div className="mb-4">
          <Alert kind="error">{error}</Alert>
        </div>
      ) : null}
      {notice ? (
        <div className="mb-4">
          <Alert kind="success">{notice}</Alert>
        </div>
      ) : null}

      <Card className="p-5">
        <div className="mb-5">
          <Toggle checked={active} onChange={setActive} label={t('banner.active')} />
        </div>
        <div className="flex flex-col gap-6">
          {LOCALES.map((l) => (
            <div key={l} className="border-t border-line-paper pt-4 first:border-t-0 first:pt-0">
              <div className="mb-2 font-display text-[0.72rem] uppercase tracking-display text-gold-deep">
                {localeLabel[l]}
              </div>
              <div className="grid gap-3">
                <Field label={t('banner.bannerTitle')}>
                  <TextInput value={titles[l]} onChange={(e) => setTitles((p) => ({ ...p, [l]: e.target.value }))} />
                </Field>
                <Field label={t('banner.text')}>
                  <Textarea value={texts[l]} onChange={(e) => setTexts((p) => ({ ...p, [l]: e.target.value }))} />
                </Field>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5">
          <Button variant="primary" onClick={save} disabled={busy}>
            {busy ? t('common.saving') : t('banner.save')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
