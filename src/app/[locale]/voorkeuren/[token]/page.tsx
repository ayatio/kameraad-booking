import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { getCustomerByUnsubscribeToken } from '@/lib/db/queries/customers'
import PreferencesForm from './PreferencesForm'

export const dynamic = 'force-dynamic'

type Props = {
  params: { locale: string; token: string }
  searchParams: { type?: string }
}

export default async function VoorkeurenPage({ params: { token }, searchParams }: Props) {
  const [customer, t] = await Promise.all([
    getCustomerByUnsubscribeToken(token),
    getTranslations('preferences'),
  ])

  if (!customer) notFound()

  // ?type=reminder|rebooking|marketing pre-toggles that one OFF (pending save, FR-072)
  const preType = searchParams.type
  const initialReminders = preType === 'reminder' ? false : customer.reminder_opt_in
  const initialRebooking = preType === 'rebooking' ? false : customer.rebooking_opt_in
  const initialMarketing = preType === 'marketing' ? false : customer.marketing_opt_in

  return (
    <section className="min-h-screen" style={{ background: '#0c0b0a' }}>
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            'radial-gradient(100% 60% at 50% 0%, rgba(201,162,75,.05) 0%, transparent 55%)',
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto max-w-lg px-5 py-[clamp(64px,9vw,120px)]">
        <span
          className="font-display uppercase text-gold-pale"
          style={{ letterSpacing: '0.32em', fontSize: '0.78rem' }}
        >
          {t('eyebrow')}
        </span>

        <h1
          className="mt-4 mb-3 font-serif font-medium leading-tight text-paper"
          style={{ fontSize: 'clamp(1.9rem, 4vw, 2.8rem)', letterSpacing: '-0.01em' }}
        >
          {t('title')}
        </h1>

        <p
          className="mb-8 leading-relaxed"
          style={{ fontSize: '1rem', lineHeight: 1.7, color: 'rgba(246,241,231,.78)' }}
        >
          {t('lead')}
        </p>

        <div
          className="rounded-xl bg-paper px-6 py-7"
          style={{ border: '1px solid rgba(201,162,75,0.2)' }}
        >
          <PreferencesForm
            token={token}
            initialReminders={initialReminders}
            initialRebooking={initialRebooking}
            initialMarketing={initialMarketing}
          />
        </div>
      </div>
    </section>
  )
}
