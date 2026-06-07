'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import type { AdminAppointmentRow } from '@/lib/db/queries/admin-calendar'
import type { BlockedSlot } from '@/lib/db/types'
import { apiGet } from '@/components/admin/api'
import { Button, Spinner, Alert, Toggle, cn } from '@/components/admin/ui'
import {
  todayBrussels,
  addDaysStr,
  weekStartStr,
  monthLabel,
  formatLocalDateStr,
} from '@/components/admin/format'
import { DayView } from './DayView'
import { WeekView } from './WeekView'
import { MonthView } from './MonthView'
import { BookingDrawer } from './BookingDrawer'
import { ManualBookingDialog } from './ManualBookingDialog'
import type { BarberLite, ServiceLite, ActorLite } from './types'

type View = 'day' | 'week' | 'month'

interface RangePayload {
  appointments: AdminAppointmentRow[]
  blocks: BlockedSlot[]
}
interface MonthPayload {
  counts: { local_date: string; count: number }[]
}

export function CalendarView({
  barbers,
  services,
  actor,
}: {
  barbers: BarberLite[]
  services: ServiceLite[]
  actor: ActorLite
}) {
  const t = useTranslations('admin')
  const [view, setView] = useState<View>('day')
  const [date, setDate] = useState<string>(() => todayBrussels())
  const [activeBarberIds, setActiveBarberIds] = useState<Set<string>>(
    () => new Set(barbers.map((b) => b.id)),
  )
  const [showCancelled, setShowCancelled] = useState(false)

  const [range, setRange] = useState<RangePayload | null>(null)
  const [month, setMonth] = useState<MonthPayload | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)

  const [drawerAppt, setDrawerAppt] = useState<AdminAppointmentRow | null>(null)
  const [manualOpen, setManualOpen] = useState(false)

  const columns = useMemo(
    () => barbers.filter((b) => activeBarberIds.has(b.id)),
    [barbers, activeBarberIds],
  )
  const serviceById = useMemo(() => {
    const m = new Map<string, ServiceLite>()
    for (const s of services) m.set(s.id, s)
    return m
  }, [services])

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    const barberParams = barbers
      .filter((b) => activeBarberIds.has(b.id))
      .map((b) => `&barberId=${encodeURIComponent(b.id)}`)
      .join('')
    // Omit the barber filter when every barber is selected (cleaner + faster).
    const allSelected = activeBarberIds.size === barbers.length
    const filter = allSelected ? '' : barberParams
    const anchor = view === 'week' ? weekStartStr(date) : date
    const cancelledFlag = showCancelled ? '&includeCancelled=1' : ''
    const url = `/api/admin/calendar?view=${view}&date=${anchor}${filter}${cancelledFlag}`

    if (view === 'month') {
      const res = await apiGet<MonthPayload>(url)
      if (res.ok && res.data) setMonth(res.data)
      else setError(true)
    } else {
      const res = await apiGet<RangePayload>(url)
      if (res.ok && res.data) setRange(res.data)
      else setError(true)
    }
    setLoading(false)
  }, [view, date, activeBarberIds, showCancelled, barbers])

  useEffect(() => {
    load()
  }, [load])

  // ─── Navigation ────────────────────────────────────────────────────────────
  const step = (dir: -1 | 1) => {
    if (view === 'day') setDate((d) => addDaysStr(d, dir))
    else if (view === 'week') setDate((d) => addDaysStr(d, dir * 7))
    else {
      const [y, m] = date.split('-').map(Number)
      const nm = m - 1 + dir
      const ny = y + Math.floor(nm / 12)
      const mm = ((nm % 12) + 12) % 12
      setDate(`${ny}-${String(mm + 1).padStart(2, '0')}-01`)
    }
  }

  const rangeLabel = (() => {
    if (view === 'day') return formatLocalDateStr(date)
    if (view === 'week') {
      const start = weekStartStr(date)
      return `${formatLocalDateStr(start)} – ${formatLocalDateStr(addDaysStr(start, 6))}`
    }
    const [y, m] = date.split('-').map(Number)
    return monthLabel(y, m)
  })()

  const toggleBarber = (id: string) =>
    setActiveBarberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Never allow an empty selection — fall back to all.
      return next.size === 0 ? new Set(barbers.map((b) => b.id)) : next
    })

  const VIEWS: { key: View; label: string }[] = [
    { key: 'day', label: t('calendar.day') },
    { key: 'week', label: t('calendar.week') },
    { key: 'month', label: t('calendar.month') },
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-md border border-line-paper">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                aria-pressed={view === v.key}
                className={cn(
                  'px-3 py-1.5 font-display text-[0.75rem] uppercase tracking-display transition-colors',
                  view === v.key ? 'bg-gold text-ink' : 'bg-paper text-fg2 hover:bg-paper-2',
                )}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <Button variant="primary" onClick={() => setManualOpen(true)}>
          + {t('calendar.newBooking')}
        </Button>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" onClick={() => step(-1)} aria-label={t('calendar.prev')}>
            ←
          </Button>
          <Button variant="secondary" onClick={() => setDate(todayBrussels())}>
            {t('calendar.today')}
          </Button>
          <Button variant="ghost" onClick={() => step(1)} aria-label={t('calendar.next')}>
            →
          </Button>
          <span className="ml-2 font-display text-[0.95rem] uppercase tracking-display text-ink">
            {rangeLabel}
          </span>
        </div>
        <Toggle
          checked={showCancelled}
          onChange={setShowCancelled}
          label={t('calendar.showCancelled')}
        />
      </div>

      {/* Barber filter chips */}
      {barbers.length > 1 ? (
        <div className="mb-4 flex flex-wrap gap-2">
          {barbers.map((b) => {
            const on = activeBarberIds.has(b.id)
            return (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleBarber(b.id)}
                aria-pressed={on}
                className={cn(
                  'rounded-pill border px-3 py-1 text-[0.78rem] transition-colors',
                  on
                    ? 'border-gold bg-gold/15 text-gold-deep'
                    : 'border-line-paper bg-paper text-smoke hover:border-gold',
                )}
              >
                {b.name}
              </button>
            )
          })}
        </div>
      ) : null}

      {error ? (
        <Alert kind="error">{t('common.error')}</Alert>
      ) : loading && !range && !month ? (
        <div className="py-10 text-center">
          <Spinner label={t('common.loading')} />
        </div>
      ) : view === 'month' ? (
        <MonthView
          anchorDate={date}
          counts={month?.counts ?? []}
          onPickDay={(d) => {
            setDate(d)
            setView('day')
          }}
        />
      ) : view === 'week' ? (
        <WeekView
          weekStart={weekStartStr(date)}
          columns={columns}
          appointments={range?.appointments ?? []}
          serviceById={serviceById}
          onSelect={setDrawerAppt}
        />
      ) : (
        <DayView
          date={date}
          columns={columns}
          appointments={range?.appointments ?? []}
          blocks={range?.blocks ?? []}
          serviceById={serviceById}
          onSelect={setDrawerAppt}
        />
      )}

      <BookingDrawer
        appt={drawerAppt}
        actor={actor}
        services={services}
        onClose={() => setDrawerAppt(null)}
        onChanged={() => {
          setDrawerAppt(null)
          load()
        }}
      />

      <ManualBookingDialog
        open={manualOpen}
        barbers={barbers}
        services={services}
        actor={actor}
        onClose={() => setManualOpen(false)}
        onCreated={() => {
          setManualOpen(false)
          load()
        }}
      />
    </div>
  )
}
