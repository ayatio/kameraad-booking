'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

// FR-017b / FR-022: next-available-slots preview. Fetches the per-day earliest
// slot for a representative service and renders clickable chips; a click lands
// on the booking flow with service + date preselected. Height is reserved
// (.pub-slot-row) so the async fetch causes no layout shift (FR-103).

export interface PreviewService {
  slug: string
  name: string
}

type FirstSlot = { startAtUtc: string; endAtUtc: string; barberId: string } | null
type ApiResponse = { slots: Record<string, FirstSlot> }

interface DaySlot {
  date: string
  startAtUtc: string
}

const MAX_CHIPS = 6

export function SlotPreview({
  locale,
  fromDate,
  services,
}: {
  locale: string
  fromDate: string
  services: PreviewService[]
}) {
  const t = useTranslations('home')
  const intlLocale = locale === 'le' ? 'nl' : locale

  const [activeSlug, setActiveSlug] = useState(services[0]?.slug ?? '')
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [days, setDays] = useState<DaySlot[]>([])

  useEffect(() => {
    if (!activeSlug) return
    let cancelled = false
    setState('loading')

    const params = new URLSearchParams({ service: activeSlug, from: fromDate, days: '14' })
    fetch(`/api/slots/first-per-day?${params.toString()}`)
      .then((r) => (r.ok ? (r.json() as Promise<ApiResponse>) : Promise.reject(new Error('bad'))))
      .then((data) => {
        if (cancelled) return
        const available: DaySlot[] = Object.entries(data.slots)
          .filter(([, v]) => v !== null)
          .map(([date, v]) => ({ date, startAtUtc: (v as NonNullable<FirstSlot>).startAtUtc }))
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, MAX_CHIPS)
        setDays(available)
        setState('ready')
      })
      .catch(() => {
        if (!cancelled) setState('error')
      })

    return () => {
      cancelled = true
    }
  }, [activeSlug, fromDate])

  const dayFmt = new Intl.DateTimeFormat(intlLocale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'Europe/Brussels',
  })
  const timeFmt = new Intl.DateTimeFormat(intlLocale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Brussels',
  })

  return (
    <div>
      {services.length > 1 && (
        <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label={t('slots.serviceTabs')}>
          {services.map((s) => {
            const selected = s.slug === activeSlug
            return (
              <button
                key={s.slug}
                type="button"
                aria-pressed={selected}
                onClick={() => setActiveSlug(s.slug)}
                className={`font-display text-[0.74rem] uppercase tracking-[0.13em] rounded-pill border px-4 py-2 transition-colors ${
                  selected
                    ? 'border-gold bg-gold text-ink'
                    : 'border-line-ink text-gold-pale hover:border-gold-pale'
                }`}
              >
                {s.name}
              </button>
            )
          })}
        </div>
      )}

      <div className="pub-slot-row flex flex-wrap items-center gap-2.5">
        {state === 'loading' && (
          <span className="km-small" style={{ color: '#8f897c' }}>
            {t('slots.loading')}
          </span>
        )}

        {state === 'error' && (
          <span className="km-small" style={{ color: '#8f897c' }}>
            {t('slots.error')}
          </span>
        )}

        {state === 'ready' && days.length === 0 && (
          <span className="km-small" style={{ color: '#8f897c' }}>
            {t('slots.empty')}
          </span>
        )}

        {state === 'ready' &&
          days.map((d) => {
            const dt = new Date(d.startAtUtc)
            const dayLabel = dayFmt.format(new Date(`${d.date}T12:00:00Z`))
            const timeLabel = timeFmt.format(dt)
            return (
              <Link
                key={d.date}
                href={`/${locale}/boeken?service=${activeSlug}&date=${d.date}`}
                className="pub-chip"
              >
                <span className="font-display text-[0.66rem] uppercase tracking-[0.12em] text-gold-pale">
                  {dayLabel}
                </span>
                <span className="font-serif text-[1.05rem] leading-none">{timeLabel}</span>
              </Link>
            )
          })}
      </div>
    </div>
  )
}
