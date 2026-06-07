import { getTranslations } from 'next-intl/server'
import { getActiveBarbersWithServices } from '@/lib/db/queries/barbers'
import { getActiveServices } from '@/lib/db/queries/services'
import { getSettings } from '@/lib/db/queries/settings'
import { BookingFlow } from '@/components/booking/BookingFlow'

// FR-008 / Phase-2 acceptance: settings (incl. cancellation_window_hours) are
// read at request time — changing them in SQL must change the rendered copy
// without a redeploy, so this page can never be statically prerendered.
export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string }
  searchParams: { barber?: string; service?: string; date?: string }
}

export default async function BoekenPage({ params: { locale }, searchParams }: Props) {
  const [barbers, services, settingsRaw, t] = await Promise.all([
    getActiveBarbersWithServices(),
    getActiveServices(),
    getSettings(),
    getTranslations('booking'),
  ])

  const cancellationWindowHours = Number(settingsRaw['cancellation_window_hours'] ?? 24)
  const bookingHorizonDays = Number(settingsRaw['booking_horizon_days'] ?? 56)

  return (
    <section
      className="relative text-paper"
      style={{
        background: '#0c0b0a',
      }}
    >
      {/* Radial gold glow — matches gate-a homepage .book::before */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(120% 80% at 80% 0%, rgba(201,162,75,.07) 0%, transparent 55%)',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-7xl px-5 py-[clamp(64px,9vw,120px)]">
        <div className="grid lg:grid-cols-[0.85fr_1.15fr] gap-[clamp(40px,6vw,96px)] items-start">
          {/* Left — intro (sticky on desktop) */}
          <div className="lg:sticky lg:top-12">
            <span
              className="font-display uppercase text-gold-pale"
              style={{ letterSpacing: '0.32em', fontSize: '0.78rem' }}
            >
              {t('eyebrow')}
            </span>

            <h1
              className="mt-4 mb-5 font-serif font-medium leading-none tracking-tight text-paper"
              style={{ fontSize: 'clamp(2.6rem, 5vw, 4.6rem)', letterSpacing: '-0.01em' }}
            >
              {t('title')}
            </h1>

            <p
              className="mb-9 leading-relaxed max-w-[38ch]"
              style={{ fontSize: '1.02rem', lineHeight: 1.7, color: 'rgba(246,241,231,.82)' }}
            >
              {t('lead')}
            </p>

            {/* Hours & place meta */}
            <div
              className="flex flex-col gap-3.5 text-[0.95rem]"
              style={{
                borderTop: '1px solid rgba(232,210,159,.24)',
                paddingTop: '24px',
                color: 'rgba(246,241,231,.9)',
              }}
            >
              <div>
                <span
                  className="inline-block w-14 font-display uppercase text-gold-pale"
                  style={{ letterSpacing: '0.18em', fontSize: '0.66rem' }}
                >
                  {t('hoursLabel')}
                </span>
                {/* PROVISIONAL — client data unconfirmed */}
                {t('hours')}
              </div>
              <div>
                <span
                  className="inline-block w-14 font-display uppercase text-gold-pale"
                  style={{ letterSpacing: '0.18em', fontSize: '0.66rem' }}
                >
                  {t('placeLabel')}
                </span>
                Parijsstraat 29, Leuven
              </div>
            </div>
          </div>

          {/* Right — booking card / mobile wizard */}
          <BookingFlow
            barbers={barbers}
            services={services}
            locale={locale}
            cancellationWindowHours={cancellationWindowHours}
            bookingHorizonDays={bookingHorizonDays}
            initialBarberSlug={searchParams.barber}
            initialServiceSlug={searchParams.service}
            initialDate={searchParams.date}
          />
        </div>
      </div>
    </section>
  )
}
