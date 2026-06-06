'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import StepSlot from '@/components/booking/StepSlot'

interface Props {
  token: string
  locale: string
  barberId: string
  serviceSlug: string
  horizonDays: number
}

type Phase = 'picking' | 'confirming' | 'submitting' | 'success' | 'error'

export default function RescheduleFlow({ token, locale, barberId, serviceSlug, horizonDays }: Props) {
  const t = useTranslations('manage')

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotUtc, setSelectedSlotUtc] = useState<string | null>(null)
  const [slotTimeLabel, setSlotTimeLabel] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('picking')
  const [errorMsg, setErrorMsg] = useState('')

  // Format a UTC string as HH:MM / day label for Brussels display
  function formatUtcBrussels(utc: string): string {
    const d = new Date(utc)
    const localeMap: Record<string, string> = {
      nl: 'nl-BE', en: 'en-GB', fr: 'fr-BE', es: 'es-ES', le: 'nl-BE',
    }
    const datePart = new Intl.DateTimeFormat(localeMap[locale] ?? 'nl-BE', {
      timeZone: 'Europe/Brussels',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d)
    const timePart = new Intl.DateTimeFormat('nl-BE', {
      timeZone: 'Europe/Brussels',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(d)
    return `${datePart} · ${timePart}`
  }

  async function handleSubmit() {
    if (!selectedSlotUtc) return
    setPhase('submitting')
    try {
      const res = await fetch('/api/manage/reschedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, startAtUtc: selectedSlotUtc }),
      })
      const data = (await res.json()) as { ok?: boolean; error?: string }
      if (data.ok) {
        setPhase('success')
      } else if (data.error === 'SLOT_TAKEN') {
        setErrorMsg(t('reschedule.slotTakenError'))
        setPhase('error')
      } else if (res.status === 403) {
        setErrorMsg(t('reschedule.outsideWindowError'))
        setPhase('error')
      } else {
        setErrorMsg(t('reschedule.genericError'))
        setPhase('error')
      }
    } catch {
      setErrorMsg(t('reschedule.genericError'))
      setPhase('error')
    }
  }

  if (phase === 'success') {
    return (
      <div className="flex flex-col gap-3 px-6 py-6">
        <p className="font-serif text-ink" style={{ fontSize: '1.15rem' }}>
          {t('reschedule.successHeading')}
        </p>
        {selectedSlotUtc && (
          <p className="text-smoke" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
            {formatUtcBrussels(selectedSlotUtc)}
          </p>
        )}
        <p className="text-smoke" style={{ fontSize: '0.9rem', lineHeight: 1.6 }}>
          {t('reschedule.successBody')}
        </p>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col gap-4 px-6 py-6">
        <p className="text-smoke" style={{ fontSize: '0.92rem' }}>
          {errorMsg}
        </p>
        {errorMsg === t('reschedule.slotTakenError') && (
          <button
            type="button"
            onClick={() => { setPhase('picking'); setSelectedSlotUtc(null); setSlotTimeLabel(null) }}
            className="inline-flex items-center justify-center self-start px-5 py-2.5 rounded-full border border-gold text-gold-deep font-display uppercase transition-colors hover:bg-gold/10"
            style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
          >
            {t('reschedule.tryAgainButton')}
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Slot picker */}
      <div className="px-6 py-4">
        <p
          className="font-display uppercase text-smoke mb-4"
          style={{ letterSpacing: '0.18em', fontSize: '0.66rem' }}
        >
          {t('reschedule.newSlotLabel')}
        </p>
        <StepSlot
          barberId={barberId}
          serviceSlug={serviceSlug}
          horizonDays={horizonDays}
          locale={locale}
          selectedDate={selectedDate}
          selectedSlotUtc={selectedSlotUtc}
          onDateChange={setSelectedDate}
          onSlotSelect={(date, utc, timeLabel) => {
            setSelectedDate(date)
            setSelectedSlotUtc(utc)
            setSlotTimeLabel(timeLabel)
          }}
        />
      </div>

      {/* Confirm row — appears when slot is chosen */}
      {selectedSlotUtc && (
        <div
          className="px-6 py-5 flex flex-wrap items-center justify-between gap-4"
          style={{ borderTop: '1px solid rgba(22,20,15,0.08)' }}
        >
          <div>
            <p
              className="font-display uppercase text-smoke"
              style={{ letterSpacing: '0.18em', fontSize: '0.62rem' }}
            >
              {t('reschedule.selectedLabel')}
            </p>
            <p className="mt-0.5 text-ink" style={{ fontSize: '0.9rem' }}>
              {slotTimeLabel ?? ''}
            </p>
          </div>
          <button
            type="button"
            disabled={phase === 'submitting'}
            onClick={handleSubmit}
            className="inline-flex items-center justify-center px-6 py-2.5 rounded-full border border-gold text-gold-deep font-display uppercase transition-colors hover:bg-gold/10 disabled:opacity-50"
            style={{ letterSpacing: '0.14em', fontSize: '0.78rem' }}
          >
            {phase === 'submitting' ? t('reschedule.loading') : t('reschedule.confirmButton')}
          </button>
        </div>
      )}
    </div>
  )
}
