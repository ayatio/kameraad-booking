'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminAppointmentRow } from '@/lib/db/queries/admin-calendar'
import { Drawer } from '@/components/admin/Overlay'
import { Button, Field, Textarea, TextInput, Toggle, StatusBadge, Alert, cn } from '@/components/admin/ui'
import { apiGet, apiPost, apiPatch } from '@/components/admin/api'
import { formatDateTime, formatMoney, todayBrussels } from '@/components/admin/format'
import { canManage, type ActorLite, type ServiceLite } from './types'

type SlotRow = { startAtUtc: string; localLabel: string; localDate: string }

export function BookingDrawer({
  appt,
  actor,
  services,
  onClose,
  onChanged,
}: {
  appt: AdminAppointmentRow | null
  actor: ActorLite
  services: ServiceLite[]
  onClose: () => void
  onChanged: () => void
}) {
  const t = useTranslations('admin')
  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancel'>('view')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Notes
  const [notes, setNotes] = useState('')
  // Cancel
  const [notify, setNotify] = useState(true)
  const [reason, setReason] = useState('')
  // Reschedule
  const [rsDate, setRsDate] = useState('')
  const [override, setOverride] = useState(false)
  const [slots, setSlots] = useState<SlotRow[] | null>(null)
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    if (appt) {
      setMode('view')
      setBusy(false)
      setError(null)
      setNotice(null)
      setNotes(appt.admin_notes ?? '')
      setNotify(true)
      setReason('')
      setRsDate(todayBrussels())
      setSlots(null)
    }
  }, [appt])

  if (!appt) return null

  const manage = canManage(actor, appt.barber_id)
  const service = services.find((s) => s.id === appt.service_id)
  const startMs = new Date(appt.start_at).getTime()
  const started = Date.now() >= startMs
  const isCancelled = appt.status === 'cancelled'
  const isNoShow = appt.status === 'no_show'
  const isCompleted = appt.status === 'completed'

  async function fetchSlots(date: string) {
    if (!appt || !service) return
    setSlotsLoading(true)
    setSlots(null)
    const res = await apiGet<{ slots: SlotRow[] }>(
      `/api/slots?barberId=${encodeURIComponent(appt.barber_id)}&service=${encodeURIComponent(service.slug)}&from=${date}&to=${date}`,
    )
    setSlots(res.ok && res.data ? res.data.slots : [])
    setSlotsLoading(false)
  }

  async function doReschedule(startAtUtc: string) {
    if (!appt) return
    setBusy(true)
    setError(null)
    const res = await apiPost(`/api/admin/bookings/${appt.id}/reschedule`, {
      newStartAtUtc: startAtUtc,
      overrideLeadTime: override,
    })
    setBusy(false)
    if (res.ok) {
      onChanged()
      return
    }
    if (res.status === 409) setError(t('drawer.slotTaken'))
    else setError(t('common.error'))
  }

  async function doCancel() {
    if (!appt) return
    setBusy(true)
    setError(null)
    const res = await apiPost(`/api/admin/bookings/${appt.id}/cancel`, {
      notify,
      reason: reason.trim() || undefined,
    })
    setBusy(false)
    if (res.ok) onChanged()
    else setError(t('common.error'))
  }

  async function doNoShow() {
    if (!appt) return
    setBusy(true)
    setError(null)
    const res = await apiPost(`/api/admin/bookings/${appt.id}/no-show`, {})
    setBusy(false)
    if (res.ok) onChanged()
    else if (res.status === 409) setError(t('drawer.tooEarly'))
    else setError(t('common.error'))
  }

  async function doComplete() {
    if (!appt) return
    setBusy(true)
    setError(null)
    const res = await apiPost(`/api/admin/bookings/${appt.id}/complete`, {})
    setBusy(false)
    if (res.ok) onChanged()
    else if (res.status === 409) setError(t('drawer.tooEarly'))
    else setError(t('common.error'))
  }

  async function saveNotes() {
    if (!appt) return
    setBusy(true)
    setError(null)
    setNotice(null)
    const res = await apiPatch(`/api/admin/bookings/${appt.id}/notes`, { notes: notes.trim() || null })
    setBusy(false)
    if (res.ok) setNotice(t('common.saved'))
    else setError(t('common.error'))
  }

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex flex-col gap-0.5 border-b border-line-paper py-2.5">
      <span className="font-display text-[0.62rem] uppercase tracking-eyebrow text-smoke">{label}</span>
      <span className="text-[0.92rem] text-ink">{value}</span>
    </div>
  )

  return (
    <Drawer open={appt !== null} onClose={onClose} title={t('drawer.title')}>
      <div className="flex flex-col gap-1">
        <div className="mb-2 flex items-center gap-2">
          <StatusBadge status={appt.status} label={t(`status.${appt.status}`)} />
          {!manage ? (
            <span className="text-[0.7rem] text-smoke">{t('calendar.readOnlyOther')}</span>
          ) : null}
        </div>

        <Row
          label={t('drawer.customer')}
          value={`${appt.customer_first_name} ${appt.customer_last_name}`}
        />
        <Row
          label={t('drawer.contact')}
          value={
            appt.customer_email_missing ? (
              <span className="text-smoke">{t('drawer.noEmail')}</span>
            ) : (
              <span>
                {appt.customer_email}
                {appt.customer_phone ? ` · ${appt.customer_phone}` : ''}
              </span>
            )
          }
        />
        <Row
          label={t('drawer.service')}
          value={`${appt.service_name_nl} · ${formatMoney(appt.service_price_cents)}`}
        />
        <Row label={t('drawer.time')} value={formatDateTime(appt.start_at)} />
        <Row label={t('drawer.noShowCount')} value={appt.customer_no_show_count} />

        {error ? (
          <div className="mt-3">
            <Alert kind="error">{error}</Alert>
          </div>
        ) : null}
        {notice ? (
          <div className="mt-3">
            <Alert kind="success">{notice}</Alert>
          </div>
        ) : null}

        {/* ─── Admin notes ─── */}
        <div className="mt-4">
          <Field label={t('drawer.adminNotes')}>
            <Textarea
              value={notes}
              disabled={!manage}
              placeholder={t('drawer.adminNotesPlaceholder')}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          {manage ? (
            <Button variant="secondary" className="mt-2" onClick={saveNotes} disabled={busy}>
              {t('drawer.saveNotes')}
            </Button>
          ) : null}
        </div>

        {/* ─── Actions ─── */}
        {manage && mode === 'view' && !isCancelled ? (
          <div className="mt-5 flex flex-wrap gap-2 border-t border-line-paper pt-4">
            <Button variant="secondary" onClick={() => { setMode('reschedule'); fetchSlots(rsDate) }}>
              {t('drawer.reschedule')}
            </Button>
            <Button variant="secondary" onClick={doNoShow} disabled={busy || !started}>
              {isNoShow ? t('drawer.undoNoShow') : t('drawer.noShow')}
            </Button>
            {!isCompleted ? (
              <Button variant="secondary" onClick={doComplete} disabled={busy || !started}>
                {t('drawer.complete')}
              </Button>
            ) : null}
            <Button variant="danger" onClick={() => setMode('cancel')} disabled={busy}>
              {t('drawer.cancel')}
            </Button>
          </div>
        ) : null}

        {/* ─── Reschedule panel ─── */}
        {manage && mode === 'reschedule' ? (
          <div className="mt-5 border-t border-line-paper pt-4">
            <Field label={t('drawer.pickNewSlot')}>
              <TextInput
                type="date"
                value={rsDate}
                onChange={(e) => {
                  setRsDate(e.target.value)
                  fetchSlots(e.target.value)
                }}
              />
            </Field>
            <div className="mt-3">
              <Toggle checked={override} onChange={setOverride} label={t('drawer.overrideLeadTime')} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {slotsLoading ? (
                <span className="col-span-3 text-[0.82rem] text-smoke">{t('common.loading')}</span>
              ) : slots && slots.length > 0 ? (
                slots.map((s) => (
                  <button
                    key={s.startAtUtc}
                    type="button"
                    disabled={busy}
                    onClick={() => doReschedule(s.startAtUtc)}
                    className={cn(
                      'rounded-md border border-line-paper bg-white py-2 text-center text-[0.82rem] text-ink hover:border-gold disabled:opacity-50',
                    )}
                  >
                    {s.localLabel}
                  </button>
                ))
              ) : (
                <span className="col-span-3 text-[0.82rem] text-smoke">{t('manual.noSlots')}</span>
              )}
            </div>
            <Button variant="ghost" className="mt-3" onClick={() => setMode('view')}>
              {t('common.back')}
            </Button>
          </div>
        ) : null}

        {/* ─── Cancel panel ─── */}
        {manage && mode === 'cancel' ? (
          <div className="mt-5 border-t border-line-paper pt-4">
            <div className="mb-3">
              <Toggle checked={notify} onChange={setNotify} label={t('drawer.notifyCustomer')} />
            </div>
            <Field label={t('drawer.cancelReason')}>
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
            <div className="mt-3 flex gap-2">
              <Button variant="danger" onClick={doCancel} disabled={busy}>
                {t('drawer.confirmCancel')}
              </Button>
              <Button variant="ghost" onClick={() => setMode('view')}>
                {t('common.back')}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Drawer>
  )
}
