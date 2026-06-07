'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { apiPost } from '@/components/admin/api'
import { PageHeader, Card, Button, Field, TextInput, Textarea, Alert, cn } from '@/components/admin/ui'

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const
type Locale = (typeof LOCALES)[number]

interface SendResult {
  sent: number
  failed: number
  recipientCount: number
}

export function MailingView() {
  const t = useTranslations('admin')
  const [locale, setLocale] = useState<Locale>('nl')
  const [subjects, setSubjects] = useState<Record<Locale, string>>(() => blank())
  const [bodies, setBodies] = useState<Record<Locale, string>>(() => blank())
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function blank(): Record<Locale, string> {
    return { nl: '', en: '', fr: '', es: '', le: '' }
  }

  async function refreshPreview() {
    const res = await apiPost<{ count: number }>('/api/admin/bulk-email', {
      preview: true,
      filter: 'marketing',
    })
    setCount(res.ok && res.data ? res.data.count : 0)
  }

  useEffect(() => {
    refreshPreview()
  }, [])

  function maps() {
    const subjectByLocale = Object.fromEntries(
      LOCALES.filter((l) => subjects[l].trim()).map((l) => [l, subjects[l].trim()]),
    )
    const bodyByLocale = Object.fromEntries(
      LOCALES.filter((l) => bodies[l].trim()).map((l) => [l, bodies[l].trim()]),
    )
    return { subjectByLocale, bodyByLocale }
  }

  async function send(testToSelf: boolean) {
    setBusy(true)
    setNotice(null)
    setError(null)
    const { subjectByLocale, bodyByLocale } = maps()
    if (!subjectByLocale.nl || !bodyByLocale.nl) {
      setBusy(false)
      setError(t('common.error'))
      return
    }
    const res = await apiPost<SendResult>('/api/admin/bulk-email', {
      subjectByLocale,
      bodyByLocale,
      filter: 'marketing',
      testToSelf,
    })
    setBusy(false)
    if (!res.ok || !res.data) {
      setError(t('common.error'))
      return
    }
    if (testToSelf) {
      setNotice(t('mailing.testSent'))
    } else {
      setNotice(
        t('mailing.sent', {
          sent: res.data.sent,
          failed: res.data.failed,
          total: res.data.recipientCount,
        }),
      )
      refreshPreview()
    }
  }

  return (
    <div>
      <PageHeader title={t('mailing.title')} description={t('mailing.subtitle')} />

      <div className="mb-4">
        <Alert kind="info">{t('mailing.dryRunNote')}</Alert>
      </div>
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

      <Card className="mb-5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('mailing.filter')}>
            <div className="flex items-center gap-2 rounded-md border border-line-paper bg-paper-2 px-3 py-2 text-[0.88rem] text-fg2">
              🔒 {t('mailing.filterMarketing')}
            </div>
          </Field>
          <Field label={t('mailing.preview')}>
            <div className="flex items-center gap-3">
              <span className="font-serif text-[1.3rem] text-ink">
                {count === null ? '…' : t('mailing.previewCount', { count })}
              </span>
              <Button variant="ghost" onClick={refreshPreview}>
                {t('mailing.refreshPreview')}
              </Button>
            </div>
          </Field>
        </div>
        <p className="mt-2 text-[0.78rem] text-smoke">{t('mailing.filterLocked')}</p>
      </Card>

      <Card className="p-5">
        {/* Locale tabs */}
        <div className="mb-4 inline-flex overflow-hidden rounded-md border border-line-paper">
          {LOCALES.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLocale(l)}
              aria-pressed={locale === l}
              className={cn(
                'px-3 py-1.5 font-display text-[0.72rem] uppercase tracking-display transition-colors',
                locale === l ? 'bg-gold text-ink' : 'bg-paper text-fg2 hover:bg-paper-2',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-4">
          <Field label={t('mailing.subject')}>
            <TextInput
              value={subjects[locale]}
              onChange={(e) => setSubjects((p) => ({ ...p, [locale]: e.target.value }))}
            />
          </Field>
          <Field label={t('mailing.body')}>
            <Textarea
              className="min-h-[180px]"
              value={bodies[locale]}
              onChange={(e) => setBodies((p) => ({ ...p, [locale]: e.target.value }))}
            />
          </Field>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => send(true)} disabled={busy}>
            {t('mailing.testToSelf')}
          </Button>
          <Button variant="primary" onClick={() => send(false)} disabled={busy}>
            {busy ? t('mailing.sending') : t('mailing.send')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
