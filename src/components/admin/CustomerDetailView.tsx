'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { CustomerDetail } from '@/lib/services/admin-crm'
import { apiPatch, apiPost } from '@/components/admin/api'
import { Dialog } from '@/components/admin/Overlay'
import {
  PageHeader,
  Card,
  Button,
  Field,
  Textarea,
  TextInput,
  Toggle,
  Alert,
  StatusBadge,
  EmptyState,
} from '@/components/admin/ui'
import { formatMoney, formatDateTime } from '@/components/admin/format'

const CONFIRM_PHRASE = 'VERWIJDER'

export function CustomerDetailView({
  detail,
  canDelete,
}: {
  detail: CustomerDetail
  canDelete: boolean
}) {
  const t = useTranslations('admin')
  const router = useRouter()
  const c = detail.customer

  const [notes, setNotes] = useState(c.notes ?? '')
  const [marketing, setMarketing] = useState(c.marketing_opt_in)
  const [rebooking, setRebooking] = useState(c.rebooking_opt_in)
  const [reminder, setReminder] = useState(c.reminder_opt_in)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [gdprOpen, setGdprOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [purging, setPurging] = useState(false)

  async function saveOptins() {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await apiPatch(`/api/admin/customers/${c.id}`, {
      optins: { marketing_opt_in: marketing, rebooking_opt_in: rebooking, reminder_opt_in: reminder },
    })
    setBusy(false)
    if (res.ok) setNotice(t('common.saved'))
    else setError(t('common.error'))
  }

  async function saveNotes() {
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await apiPatch(`/api/admin/customers/${c.id}`, { notes: notes.trim() || null })
    setBusy(false)
    if (res.ok) setNotice(t('common.saved'))
    else setError(t('common.error'))
  }

  async function purge() {
    setPurging(true)
    const res = await apiPost(`/api/admin/customers/${c.id}/purge`, { confirmText })
    setPurging(false)
    if (res.ok) {
      router.push('/admin/klanten')
      router.refresh()
    } else {
      setError(t('common.error'))
      setGdprOpen(false)
    }
  }

  return (
    <div>
      <Link href="/admin/klanten" className="mb-3 inline-block text-[0.8rem] text-gold-deep hover:underline">
        ← {t('customers.back')}
      </Link>
      <PageHeader
        title={`${c.first_name} ${c.last_name}`}
        actions={
          canDelete ? (
            <>
              <a
                href={`/api/admin/customers/${c.id}/export`}
                className="inline-flex items-center justify-center rounded-md border border-line-paper bg-paper px-4 py-2 font-display text-[0.8rem] uppercase tracking-display text-ink hover:border-gold"
              >
                {t('customers.export')}
              </a>
              <Button variant="danger" onClick={() => setGdprOpen(true)}>
                {t('gdpr.delete')}
              </Button>
            </>
          ) : null
        }
      />

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

      <div className="grid gap-5 lg:grid-cols-2">
        {/* Contact + opt-ins */}
        <Card className="p-5">
          <dl className="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[0.88rem]">
            <dt className="text-smoke">{t('customers.email')}</dt>
            <dd className="text-ink">{c.email_missing ? '—' : c.email}</dd>
            <dt className="text-smoke">{t('customers.phone')}</dt>
            <dd className="text-ink">{c.phone ?? '—'}</dd>
            <dt className="text-smoke">{t('customers.language')}</dt>
            <dd className="text-ink uppercase">{c.preferred_language}</dd>
            <dt className="text-smoke">{t('customers.noShows')}</dt>
            <dd className="text-ink">{c.no_show_count}</dd>
            <dt className="text-smoke">{t('customers.totalSpent')}</dt>
            <dd className="text-ink">{formatMoney(c.total_spent_cents)}</dd>
          </dl>

          <h3 className="mb-2 font-display text-[0.72rem] uppercase tracking-display text-ink">
            {t('customers.optins')}
          </h3>
          <div className="flex flex-col gap-2.5">
            <Toggle checked={marketing} onChange={setMarketing} label={t('customers.marketing')} />
            <Toggle checked={rebooking} onChange={setRebooking} label={t('customers.rebooking')} />
            <Toggle checked={reminder} onChange={setReminder} label={t('customers.reminder')} />
          </div>
          <Button variant="secondary" className="mt-3" onClick={saveOptins} disabled={busy}>
            {t('customers.saveOptins')}
          </Button>
        </Card>

        {/* Notes */}
        <Card className="p-5">
          <Field label={t('customers.notes')}>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('customers.notesPlaceholder')}
              className="min-h-[140px]"
            />
          </Field>
          <Button variant="secondary" className="mt-3" onClick={saveNotes} disabled={busy}>
            {t('customers.saveNotes')}
          </Button>
        </Card>
      </div>

      {/* History */}
      <h2 className="mb-3 mt-7 font-display text-[0.9rem] uppercase tracking-display text-ink">
        {t('customers.history')}
      </h2>
      {detail.history.length === 0 ? (
        <EmptyState>{t('customers.noHistory')}</EmptyState>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-[0.85rem]">
            <tbody>
              {detail.history.map((h) => (
                <tr key={h.id} className="border-b border-line-paper/60">
                  <td className="px-4 py-2.5 text-ink">{formatDateTime(h.start_at)}</td>
                  <td className="px-4 py-2.5 text-fg2">{h.service_name_nl}</td>
                  <td className="px-4 py-2.5 text-fg2">{h.barber_name}</td>
                  <td className="px-4 py-2.5">
                    <StatusBadge status={h.status} label={t(`status.${h.status}`)} />
                  </td>
                  <td className="px-4 py-2.5 text-right text-fg2">{formatMoney(h.service_price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* GDPR delete dialog (owner-only) */}
      {canDelete ? (
        <Dialog open={gdprOpen} onClose={() => setGdprOpen(false)} title={t('gdpr.title')}>
          <p className="mb-4 text-[0.88rem] text-fg2">{t('gdpr.body')}</p>
          <TextInput
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={t('gdpr.placeholder')}
            aria-label={t('gdpr.placeholder')}
          />
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setGdprOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={purge}
              disabled={purging || confirmText !== CONFIRM_PHRASE}
            >
              {purging ? t('gdpr.deleting') : t('gdpr.confirm')}
            </Button>
          </div>
        </Dialog>
      ) : null}
    </div>
  )
}
