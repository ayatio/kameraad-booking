'use client'

import { useState, useEffect, useCallback } from 'react'
import { useTranslations } from 'next-intl'

interface SlotRow {
  startAtUtc: string
  localLabel: string
  localDate: string
  barberId: string
}

interface Props {
  barberId: string
  serviceSlug: string
  horizonDays: number
  locale: string
  selectedDate: string | null
  selectedSlotUtc: string | null
  onDateChange: (date: string) => void
  onSlotSelect: (date: string, utc: string, timeLabel: string) => void
}

// Generate YYYY-MM-DD strings for the booking horizon in Brussels time.
function buildDays(horizonDays: number): string[] {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const today = fmt.format(new Date())
  const days: string[] = []
  const [y, mo, d] = today.split('-').map(Number)
  for (let i = 0; i < horizonDays; i++) {
    const dt = new Date(Date.UTC(y, mo - 1, d + i))
    days.push(dt.toISOString().slice(0, 10))
  }
  return days
}

export default function StepSlot({
  barberId,
  serviceSlug,
  horizonDays,
  locale,
  selectedDate,
  selectedSlotUtc,
  onDateChange,
  onSlotSelect,
}: Props) {
  const t = useTranslations('booking')
  const dow = t.raw('dow') as string[]
  const months = t.raw('months') as string[]

  const [days] = useState(() => buildDays(horizonDays))
  const [slots, setSlots] = useState<SlotRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null)
  const [searchingNext, setSearchingNext] = useState(false)

  // Default to today if no date selected yet
  useEffect(() => {
    if (!selectedDate && days.length > 0) {
      onDateChange(days[0])
    }
  }, [days, selectedDate, onDateChange])

  const fetchSlots = useCallback(
    async (date: string) => {
      setLoading(true)
      setSlots(null)
      setNextAvailableDate(null)
      try {
        const res = await fetch(
          `/api/slots?barberId=${encodeURIComponent(barberId)}&service=${encodeURIComponent(serviceSlug)}&from=${date}&to=${date}`,
        )
        if (!res.ok) { setSlots([]); return }
        const data = (await res.json()) as { slots: SlotRow[] }
        setSlots(data.slots ?? [])
      } catch {
        setSlots([])
      } finally {
        setLoading(false)
      }
    },
    [barberId, serviceSlug],
  )

  useEffect(() => {
    if (selectedDate) fetchSlots(selectedDate)
  }, [selectedDate, fetchSlots])

  // FR-021: find the next day with at least one slot
  const findNextAvailable = useCallback(async () => {
    if (!selectedDate) return
    setSearchingNext(true)
    try {
      const idx = days.indexOf(selectedDate)
      // Scan forward in 7-day windows
      for (let start = idx + 1; start < days.length; start += 7) {
        const chunk = days.slice(start, start + 7)
        if (chunk.length === 0) break
        const from = chunk[0]
        const to = chunk[chunk.length - 1]
        const res = await fetch(
          `/api/slots?barberId=${encodeURIComponent(barberId)}&service=${encodeURIComponent(serviceSlug)}&from=${from}&to=${to}`,
        )
        if (!res.ok) continue
        const data = (await res.json()) as { slots: SlotRow[] }
        // Group by day, find first with slots
        const byDay = new Map<string, boolean>()
        for (const s of data.slots ?? []) {
          byDay.set(s.localDate, true)
        }
        for (const day of chunk) {
          if (byDay.has(day)) {
            setNextAvailableDate(day)
            setSearchingNext(false)
            return
          }
        }
      }
    } finally {
      setSearchingNext(false)
    }
  }, [selectedDate, days, barberId, serviceSlug])

  // Trigger next-available search when current day has no slots
  useEffect(() => {
    if (slots !== null && slots.length === 0 && !searchingNext && !nextAvailableDate) {
      findNextAvailable()
    }
  }, [slots, searchingNext, nextAvailableDate, findNextAvailable])

  function formatDayLabel(dateStr: string): { dowLabel: string; day: string; monthLabel: string } {
    const [, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(dateStr + 'T12:00:00Z')
    const dayOfWeek = new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(dt)
    const dowIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(dayOfWeek)
    return {
      dowLabel: dow[dowIdx] ?? dayOfWeek,
      day: d.toString(),
      monthLabel: months[m - 1] ?? '',
    }
  }

  const selectedDaySlots = slots ?? []

  return (
    <div className="flex flex-col gap-5">
      {/* Day pill scroller */}
      <div
        className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1"
        style={{ WebkitOverflowScrolling: 'touch' }}
        role="listbox"
        aria-label="Selecteer een dag"
      >
        {days.map((date) => {
          const { dowLabel, day, monthLabel } = formatDayLabel(date)
          const isSelected = date === selectedDate
          return (
            <button
              key={date}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                setNextAvailableDate(null)
                onDateChange(date)
              }}
              className={`flex-none flex flex-col items-center gap-0.5 rounded-md px-3.5 py-2.5 border min-w-[56px] cursor-pointer transition-[border-color,background] duration-200 ${
                isSelected
                  ? 'border-gold bg-gold/[0.12]'
                  : 'border-line-paper bg-white hover:border-gold'
              }`}
            >
              <span className="font-display uppercase tracking-[0.1em] text-[0.6rem] text-smoke">
                {dowLabel}
              </span>
              <span
                className={`font-serif text-[1.3rem] leading-none ${
                  isSelected ? 'text-gold-deep' : 'text-ink'
                }`}
              >
                {day}
              </span>
              <span className="text-[0.58rem] uppercase tracking-[0.08em] text-smoke">
                {monthLabel}
              </span>
            </button>
          )
        })}
      </div>

      {/* Slots for selected day */}
      {loading ? (
        // Loading skeleton
        <div className="grid grid-cols-4 gap-2" aria-busy="true" aria-label={t('loading')}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-10 rounded-md bg-line-paper animate-pulse"
            />
          ))}
        </div>
      ) : selectedDaySlots.length > 0 ? (
        <div className="grid grid-cols-4 gap-2" role="listbox" aria-label="Beschikbare tijden">
          {selectedDaySlots.map((slot) => {
            const isSelected = slot.startAtUtc === selectedSlotUtc
            return (
              <button
                key={slot.startAtUtc}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => onSlotSelect(slot.localDate, slot.startAtUtc, slot.localLabel)}
                className={`text-[0.9rem] font-body text-ink bg-white border rounded-md py-[11px] text-center cursor-pointer transition-[border-color,background,color,font-weight] duration-200 ${
                  isSelected
                    ? 'border-gold bg-gold/[0.12] text-gold-deep font-semibold'
                    : 'border-line-paper hover:border-gold'
                }`}
              >
                {slot.localLabel}
              </button>
            )
          })}
        </div>
      ) : slots !== null ? (
        // No slots for this day — FR-021
        <div className="flex flex-col items-start gap-3">
          <p className="text-[0.9rem] text-smoke">{t('noSlots')}</p>
          {searchingNext ? (
            <span className="text-[0.82rem] text-smoke italic">{t('loading')}</span>
          ) : nextAvailableDate ? (
            <button
              type="button"
              onClick={() => {
                setNextAvailableDate(null)
                onDateChange(nextAvailableDate)
              }}
              className="text-[0.82rem] font-display uppercase tracking-[0.1em] text-gold-deep hover:text-gold border-b border-gold-deep/40 hover:border-gold transition-colors duration-200 pb-px"
            >
              {t('nextAvailableDay')} →
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
