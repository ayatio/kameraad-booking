'use client'

import { useTranslations } from 'next-intl'

interface Props {
  serviceName: string
  barberName: string
  slotDate: string
  slotTime: string
  onReset: () => void
}

export default function Confirmation({
  serviceName,
  barberName,
  slotDate,
  slotTime,
  onReset,
}: Props) {
  const t = useTranslations('booking')

  return (
    <div className="text-center px-2.5 py-10 sm:py-16">
      {/* Gold checkmark */}
      <div className="w-16 h-16 rounded-full bg-gold text-ink grid place-content-center text-[1.8rem] mx-auto mb-6">
        ✓
      </div>

      {/* Heading */}
      <h2 className="font-serif font-medium text-[clamp(1.8rem,3vw,2.6rem)] text-ink mb-3.5 tracking-tight">
        {t('done.heading')}
      </h2>

      {/* Summary */}
      <p className="text-base leading-relaxed text-fg2 max-w-[36ch] mx-auto mb-2">
        {t('done.summary', {
          service: serviceName,
          barber: barberName,
          date: slotDate,
          time: slotTime,
        })}
      </p>

      {/* Email info */}
      <p className="text-[0.9rem] text-stone mb-8">
        {t('done.emailInfo')}
      </p>

      {/* Reset */}
      <button
        type="button"
        onClick={onReset}
        className="font-display uppercase tracking-[0.14em] text-[0.76rem] bg-transparent border border-line-paper rounded-pill px-[26px] py-[13px] cursor-pointer text-ink transition-[border-color] duration-200 hover:border-gold"
      >
        {t('reset')}
      </button>
    </div>
  )
}
