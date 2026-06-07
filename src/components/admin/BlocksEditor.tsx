'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Role } from '@/lib/auth/permissions'
import type { BlockedSlot } from '@/lib/db/types'
import { apiGet, apiPost, apiDelete } from '@/components/admin/api'
import { Dialog } from '@/components/admin/Overlay'
import { PageHeader, Card, Button, Field, TextInput, Select, Alert, EmptyState, Spinner } from '@/components/admin/ui'
import { brusselsLocalToUtcIso, formatDateTime, localDateToUtcRange, todayBrussels, addDaysStr } from '@/components/admin/format'

interface Conflict {
  id: string
  barber_name: string
  start_at: string
  end_at: string
  service_name_nl: string
  customer_first_name: string
  customer_last_name: string
  customer_email: string
  customer_email_missing: boolean
}
type Decision = 'keep' | 'cancel_notify'

const ALL = '__all__'

export function BlocksEditor({
  barbers,
  role,
  ownBarberId,
}: {
  barbers: { id: string; name: string }[]
  role: Role
  ownBarberId: string | null
}) {
  const t = useTranslations('admin')
  const selectable = role === 'owner' ? barbers : barbers.filter((b) => b.id === ownBarberId)
  const barberName = new Map(barbers.map((b) => [b.id, b.name]))

  const [barberSel, setBarberSel] = useState(selectable[0]?.id ?? '')
  const [startDate, setStartDate] = useState(todayBrussels())
  const [startTime, setStartTime] = useState('09:00')
  const [endDate, setEndDate] = useState(todayBrussels())
  const [endTime, setEndTime] = useState('17:00')
  const [reason, setReason] = useState('')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [conflicts, setConflicts] = useState<Conflict[] | null>(null)
  const [decisions, setDecisions] = useState<Record<string, Decision>>({})

  const [blocks, setBlocks] = useState<BlockedSlot[] | null>(null)

  const loadBlocks = useCallback(async () => {
    const { from } = localDateToUtcRange(addDaysStr(todayBrussels(), -30))
    const { to } = localDateToUtcRange(addDaysStr(todayBrussels(), 180))
    const res = await apiGet<{ blocks: BlockedSlot[] }>(
      `/api/admin/blocks?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    )
    setBlocks(res.ok && res.data ? res.data.blocks : [])
  }, [])

  useEffect(() => {
    loadBlocks()
  }, [loadBlocks])

  function payloadBarberId(): string | null {
    return barberSel === ALL ? null : barberSel
  }

  function buildRange() {
    return {
      startAt: brusselsLocalToUtcIso(startDate, startTime),
      endAt: brusselsLocalToUtcIso(endDate, endTime),
    }
  }

  async function onCreate() {
    setError(null)
    setNotice(null)
    const { startAt, endAt } = buildRange()
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      setError(t('blocks.invalidRange'))
      return
    }
    setBusy(true)
    const res = await apiPost<{ conflicts: Conflict[] }>('/api/admin/blocks/preview-conflicts', {
      barberId: payloadBarberId(),
      startAt,
      endAt,
    })
    setBusy(false)
    if (!res.ok || !res.data) {
      setError(t('common.error'))
      return
    }
    if (res.data.conflicts.length === 0) {
      await commit([])
    } else {
      const init: Record<string, Decision> = {}
      for (const c of res.data.conflicts) init[c.id] = 'keep'
      setDecisions(init)
      setConflicts(res.data.conflicts)
    }
  }

  async function commit(resolutions: { appointmentId: string; decision: Decision }[]) {
    const { startAt, endAt } = buildRange()
    setBusy(true)
    setError(null)
    const res = await apiPost('/api/admin/blocks', {
      barberId: payloadBarberId(),
      startAt,
      endAt,
      reason: reason.trim() || null,
      resolutions,
    })
    setBusy(false)
    setConflicts(null)
    if (res.status === 201) {
      setNotice(t('blocks.created'))
      setReason('')
      loadBlocks()
    } else {
      setError(t('common.error'))
    }
  }

  async function onDelete(id: string) {
    const res = await apiDelete(`/api/admin/blocks/${id}`)
    if (res.ok) {
      setNotice(t('blocks.deleted'))
      loadBlocks()
    } else {
      setError(t('common.error'))
    }
  }

  return (
    <div>
      <PageHeader title={t('blocks.title')} description={t('blocks.subtitle')} />

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

      <Card className="mb-6 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('blocks.barber')}>
            <Select value={barberSel} onChange={(e) => setBarberSel(e.target.value)}>
              {role === 'owner' ? <option value={ALL}>{t('blocks.allBarbersLabel')}</option> : null}
              {selectable.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('blocks.reason')}>
            <TextInput value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          <Field label={t('blocks.start')}>
            <div className="flex gap-2">
              <TextInput type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              <TextInput type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
          </Field>
          <Field label={t('blocks.end')}>
            <div className="flex gap-2">
              <TextInput type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              <TextInput type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </Field>
        </div>
        <div className="mt-4">
          <Button variant="primary" onClick={onCreate} disabled={busy}>
            {busy ? t('blocks.creating') : t('blocks.create')}
          </Button>
        </div>
      </Card>

      <h2 className="mb-3 font-display text-[0.9rem] uppercase tracking-display text-ink">
        {t('blocks.existing')}
      </h2>
      {blocks === null ? (
        <Spinner label={t('common.loading')} />
      ) : blocks.length === 0 ? (
        <EmptyState>{t('blocks.none')}</EmptyState>
      ) : (
        <Card className="divide-y divide-line-paper">
          {blocks.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div>
                <div className="text-[0.9rem] text-ink">
                  {formatDateTime(b.start_at)} → {formatDateTime(b.end_at)}
                </div>
                <div className="text-[0.75rem] text-smoke">
                  {b.barber_id === null ? t('blocks.allBarbersLabel') : barberName.get(b.barber_id) ?? '—'}
                  {b.reason ? ` · ${b.reason}` : ''}
                </div>
              </div>
              <Button variant="ghost" onClick={() => onDelete(b.id)}>
                {t('blocks.delete')}
              </Button>
            </div>
          ))}
        </Card>
      )}

      {/* D10 conflict dialog */}
      <Dialog
        open={conflicts !== null}
        onClose={() => setConflicts(null)}
        title={t('blocks.conflictTitle')}
      >
        <p className="mb-4 text-[0.86rem] text-fg2">{t('blocks.conflictBody')}</p>
        <div className="flex flex-col gap-3">
          {(conflicts ?? []).map((c) => (
            <div key={c.id} className="rounded-md border border-line-paper p-3">
              <div className="text-[0.88rem] font-semibold text-ink">
                {c.customer_first_name} {c.customer_last_name}
              </div>
              <div className="text-[0.78rem] text-smoke">
                {formatDateTime(c.start_at)} · {c.service_name_nl} · {c.barber_name}
              </div>
              <div className="mt-2 flex gap-2">
                {(['keep', 'cancel_notify'] as Decision[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDecisions((prev) => ({ ...prev, [c.id]: d }))}
                    aria-pressed={decisions[c.id] === d}
                    className={
                      'rounded-pill border px-3 py-1 text-[0.74rem] transition-colors ' +
                      (decisions[c.id] === d
                        ? 'border-gold bg-gold/15 text-gold-deep'
                        : 'border-line-paper text-smoke hover:border-gold')
                    }
                  >
                    {d === 'keep' ? t('blocks.keep') : t('blocks.cancelNotify')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConflicts(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              commit(
                (conflicts ?? []).map((c) => ({ appointmentId: c.id, decision: decisions[c.id] ?? 'keep' })),
              )
            }
          >
            {t('blocks.confirmCommit')}
          </Button>
        </div>
      </Dialog>
    </div>
  )
}
