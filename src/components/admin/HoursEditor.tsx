'use client'

import { useCallback, useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { Role } from '@/lib/auth/permissions'
import { apiGet, apiPut } from '@/components/admin/api'
import { PageHeader, Card, Button, Select, Alert, Spinner, cn } from '@/components/admin/ui'

interface Win {
  startTime: string
  endTime: string
}
type DayMap = Record<number, Win[]>

const ORDER = [1, 2, 3, 4, 5, 6, 0] // Mon..Sun display order
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

// Client mirror of validateHours (admin-availability): ≤2/day, start<end, no overlap.
function validate(dayMap: DayMap, errLabel: (day: number) => string): string[] {
  const errors: string[] = []
  for (const day of ORDER) {
    const wins = dayMap[day] ?? []
    if (wins.length > 2) errors.push(errLabel(day))
    for (const w of wins) {
      if (!HHMM.test(w.startTime) || !HHMM.test(w.endTime) || toMin(w.startTime) >= toMin(w.endTime)) {
        errors.push(errLabel(day))
      }
    }
    const sorted = [...wins].sort((a, b) => toMin(a.startTime) - toMin(b.startTime))
    for (let i = 1; i < sorted.length; i++) {
      if (toMin(sorted[i].startTime) < toMin(sorted[i - 1].endTime)) errors.push(errLabel(day))
    }
  }
  return [...new Set(errors)]
}

export function HoursEditor({
  barbers,
  role,
  ownBarberId,
}: {
  barbers: { id: string; name: string }[]
  role: Role
  ownBarberId: string | null
}) {
  const t = useTranslations('admin')
  const days = t.raw('hours.days') as string[]
  const selectable = role === 'owner' ? barbers : barbers.filter((b) => b.id === ownBarberId)

  const [barberId, setBarberId] = useState(selectable[0]?.id ?? '')
  const [dayMap, setDayMap] = useState<DayMap>({})
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [errors, setErrors] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    if (!id) return
    setLoading(true)
    setNotice(null)
    setErrors([])
    const res = await apiGet<{ windows: { dayOfWeek: number; startTime: string; endTime: string }[] }>(
      `/api/admin/availability/hours?barberId=${encodeURIComponent(id)}`,
    )
    const map: DayMap = {}
    if (res.ok && res.data) {
      for (const w of res.data.windows) {
        ;(map[w.dayOfWeek] ??= []).push({ startTime: w.startTime.slice(0, 5), endTime: w.endTime.slice(0, 5) })
      }
    }
    setDayMap(map)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (barberId) load(barberId)
  }, [barberId, load])

  const addWindow = (day: number) =>
    setDayMap((prev) => {
      const wins = prev[day] ?? []
      if (wins.length >= 2) return prev
      return { ...prev, [day]: [...wins, { startTime: '09:00', endTime: '17:00' }] }
    })

  const removeWindow = (day: number, idx: number) =>
    setDayMap((prev) => ({ ...prev, [day]: (prev[day] ?? []).filter((_, i) => i !== idx) }))

  const setWin = (day: number, idx: number, field: keyof Win, value: string) =>
    setDayMap((prev) => ({
      ...prev,
      [day]: (prev[day] ?? []).map((w, i) => (i === idx ? { ...w, [field]: value } : w)),
    }))

  async function save() {
    const errLabel = (day: number) => `${days[day]}: ${t('hours.subtitle')}`
    const localErrors = validate(dayMap, errLabel)
    if (localErrors.length > 0) {
      setErrors(localErrors)
      setNotice(null)
      return
    }
    setBusy(true)
    setErrors([])
    setNotice(null)
    const windows = ORDER.flatMap((day) =>
      (dayMap[day] ?? []).map((w) => ({ dayOfWeek: day, startTime: w.startTime, endTime: w.endTime })),
    )
    const res = await apiPut<{ errors?: string[] }>(`/api/admin/availability/hours`, { barberId, windows })
    setBusy(false)
    if (res.ok) setNotice(t('hours.saved'))
    else if (res.status === 422 && res.data?.errors) setErrors(res.data.errors)
    else setErrors([t('common.error')])
  }

  return (
    <div>
      <PageHeader title={t('hours.title')} description={t('hours.subtitle')} />

      <Card className="p-5">
        <div className="mb-5 max-w-xs">
          <span className="mb-1 block font-display text-[0.66rem] uppercase tracking-eyebrow text-smoke">
            {t('hours.barber')}
          </span>
          <Select value={barberId} disabled={role !== 'owner'} onChange={(e) => setBarberId(e.target.value)}>
            {selectable.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>

        {errors.length > 0 ? (
          <div className="mb-4">
            <Alert kind="error">
              <ul className="list-disc pl-4">
                {errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </Alert>
          </div>
        ) : null}
        {notice ? (
          <div className="mb-4">
            <Alert kind="success">{notice}</Alert>
          </div>
        ) : null}

        {loading ? (
          <Spinner label={t('common.loading')} />
        ) : (
          <div className="flex flex-col divide-y divide-line-paper">
            {ORDER.map((day) => {
              const wins = dayMap[day] ?? []
              return (
                <div key={day} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                  <div className="w-28 shrink-0 font-display text-[0.78rem] uppercase tracking-display text-ink">
                    {days[day]}
                  </div>
                  <div className="flex flex-1 flex-col gap-2">
                    {wins.length === 0 ? (
                      <span className="text-[0.82rem] text-stone">{t('hours.closed')}</span>
                    ) : (
                      wins.map((w, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <input
                            type="time"
                            value={w.startTime}
                            onChange={(e) => setWin(day, idx, 'startTime', e.target.value)}
                            aria-label={t('hours.from')}
                            className="rounded-md border border-line-paper bg-white px-2 py-1.5 text-[0.85rem] text-ink focus:border-gold focus:outline-none"
                          />
                          <span className="text-smoke">–</span>
                          <input
                            type="time"
                            value={w.endTime}
                            onChange={(e) => setWin(day, idx, 'endTime', e.target.value)}
                            aria-label={t('hours.to')}
                            className="rounded-md border border-line-paper bg-white px-2 py-1.5 text-[0.85rem] text-ink focus:border-gold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => removeWindow(day, idx)}
                            className="text-[0.78rem] text-red-700 hover:underline"
                          >
                            {t('hours.remove')}
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => addWindow(day)}
                    disabled={wins.length >= 2}
                    className={cn(
                      'shrink-0 text-[0.78rem] font-display uppercase tracking-display',
                      wins.length >= 2 ? 'text-stone' : 'text-gold-deep hover:text-gold',
                    )}
                  >
                    + {t('hours.addWindow')}
                  </button>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-5">
          <Button variant="primary" onClick={save} disabled={busy || loading}>
            {busy ? t('common.saving') : t('hours.save')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
