import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getAppointmentByRescheduleToken, canModify } from '@/lib/services/manage'
import { getSettings } from '@/lib/db/queries/settings'
import type { Service } from '@/lib/db/types'
import RescheduleFlow from './RescheduleFlow'

export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string; token: string }
}

function localizedServiceName(service: Service, locale: string): string {
  if (locale === 'fr') return service.name_fr ?? service.name_nl
  if (locale === 'es') return service.name_es ?? service.name_nl
  if (locale === 'le') return service.name_le ?? service.name_nl
  if (locale === 'en') return service.name_en
  return service.name_nl
}

function formatBrusselsDate(date: Date, locale: string): string {
  const localeMap: Record<string, string> = {
    nl: 'nl-BE', en: 'en-GB', fr: 'fr-BE', es: 'es-ES', le: 'nl-BE',
  }
  return new Intl.DateTimeFormat(localeMap[locale] ?? 'nl-BE', {
    timeZone: 'Europe/Brussels',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

function formatBrusselsTime(date: Date): string {
  return new Intl.DateTimeFormat('nl-BE', {
    timeZone: 'Europe/Brussels',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date)
}

function formatPrice(cents: number): string {
  return `€ ${(cents / 100).toFixed(2).replace('.', ',')}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex justify-between items-baseline gap-4 py-3"
      style={{ borderTop: '1px solid rgba(22,20,15,0.1)' }}
    >
      <span
        className="font-display uppercase text-smoke flex-none"
        style={{ letterSpacing: '0.18em', fontSize: '0.66rem' }}
      >
        {label}
      </span>
      <span className="text-ink text-right" style={{ fontSize: '0.9rem' }}>
        {value}
      </span>
    </div>
  )
}

export default async function VerzettentPage({ params: { locale, token } }: Props) {
  const [detail, settingsRaw, t] = await Promise.all([
    getAppointmentByRescheduleToken(token),
    getSettings(),
    getTranslations('manage'),
  ])

  if (!detail) notFound()

  const windowHours = Number(settingsRaw['cancellation_window_hours'] ?? 24)
  const bookingHorizonDays = Number(settingsRaw['booking_horizon_days'] ?? 56)
  const now = new Date()
  const modifiable = canModify(detail.appointment, now, windowHours)

  const startAt = new Date(detail.appointment.start_at)
  const serviceName = localizedServiceName(detail.service, locale)
  const dateLabel = formatBrusselsDate(startAt, locale)
  const timeLabel = formatBrusselsTime(startAt)
  const priceLabel = formatPrice(detail.service.price_cents)

  // PROVISIONAL — phone from gate-a README
  const phone = '+32 486 33 67 14'

  return (
    <section className="min-h-screen" style={{ background: '#0c0b0a' }}>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(120% 80% at 80% 0%, rgba(201,162,75,.06) 0%, transparent 55%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-[clamp(64px,9vw,120px)]">
        <span
          className="font-display uppercase text-gold-pale"
          style={{ letterSpacing: '0.32em', fontSize: '0.78rem' }}
        >
          {t('reschedule.eyebrow')}
        </span>

        <h1
          className="mt-4 mb-8 font-serif font-medium leading-tight text-paper"
          style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', letterSpacing: '-0.01em' }}
        >
          {t('reschedule.title')}
        </h1>

        <div
          className="rounded-xl bg-paper"
          style={{ border: '1px solid rgba(201,162,75,0.2)' }}
        >
          {/* Current appointment summary */}
          <div className="px-6 pt-6 pb-2">
            <span
              className="font-display uppercase text-smoke"
              style={{ letterSpacing: '0.22em', fontSize: '0.62rem' }}
            >
              {t('reschedule.currentAppointment')}
            </span>
          </div>
          <div className="px-6 pb-2">
            <Row label={t('appointmentCard.service')} value={serviceName} />
            <Row label={t('appointmentCard.barber')} value={detail.barber.name} />
            <Row label={t('appointmentCard.date')} value={dateLabel} />
            <Row label={t('appointmentCard.time')} value={timeLabel} />
            <Row label={t('appointmentCard.price')} value={priceLabel} />
          </div>

          {/* Action area */}
          {!modifiable ? (
            <div
              className="px-6 py-6 flex flex-col gap-2"
              style={{ borderTop: '1px solid rgba(22,20,15,0.08)' }}
            >
              <p className="font-serif text-ink" style={{ fontSize: '1.1rem' }}>
                {t('reschedule.outsideWindowHeading')}
              </p>
              <p className="text-smoke" style={{ fontSize: '0.9rem', lineHeight: 1.7 }}>
                {t('reschedule.outsideWindowBody', { hours: windowHours, phone })}
              </p>
            </div>
          ) : (
            <div style={{ borderTop: '1px solid rgba(22,20,15,0.08)' }}>
              <RescheduleFlow
                token={token}
                locale={locale}
                barberId={detail.barber.id}
                serviceSlug={detail.service.slug}
                horizonDays={bookingHorizonDays}
              />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
