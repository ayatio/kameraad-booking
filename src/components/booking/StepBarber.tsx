'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import type { BarberWithServices } from '@/lib/db/queries/barbers'

interface Props {
  barbers: BarberWithServices[]
  locale: string
  selectedBarberId: string | null
  onSelect: (barberId: string, barberName: string) => void
}

function localizedBio(barber: BarberWithServices, locale: string): string | null {
  if (locale === 'nl') return barber.bio_nl
  if (locale === 'en') return barber.bio_en
  if (locale === 'fr') return barber.bio_fr
  if (locale === 'es') return barber.bio_es ?? barber.bio_nl
  if (locale === 'le') return barber.bio_le ?? barber.bio_nl
  return barber.bio_nl
}

function BarberAvatar({
  barber,
  selected,
}: {
  barber: BarberWithServices
  selected: boolean
}) {
  const initial = barber.name.charAt(0).toUpperCase()
  const ringClass = selected
    ? 'border-gold'
    : 'border-transparent group-hover:border-gold/60'

  if (barber.photo_url) {
    // Real portrait — client owes actual images (gate-a HANDOVER §6)
    return (
      <div
        className={`relative w-14 h-14 rounded-full border-2 transition-[border-color] duration-200 ${ringClass}`}
      >
        <Image
          src={barber.photo_url}
          alt={barber.name}
          fill
          sizes="56px"
          className="rounded-full object-cover"
        />
      </div>
    )
  }

  // Initial placeholder — client owes real portraits (gate-a HANDOVER §6)
  return (
    <div
      className={`w-14 h-14 rounded-full bg-ink border-2 flex items-center justify-center transition-[border-color] duration-200 ${ringClass}`}
    >
      <span className="font-serif text-xl text-gold-deep">{initial}</span>
    </div>
  )
}

export default function StepBarber({ barbers, locale, selectedBarberId, onSelect }: Props) {
  const t = useTranslations('booking')

  return (
    <div className="flex flex-wrap gap-3">
      {/* No preference */}
      <button
        type="button"
        className={`group flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer p-0 w-16`}
        onClick={() => onSelect('any', t('noPreference'))}
        aria-label={t('noPreference')}
      >
        <div
          className={`w-14 h-14 rounded-full border-2 border-dashed flex items-center justify-center transition-[border-color,background] duration-200 ${
            selectedBarberId === 'any'
              ? 'border-gold bg-gold/10 border-solid'
              : 'border-stone group-hover:border-gold/60'
          }`}
        >
          <span
            className={`text-lg transition-colors duration-200 ${
              selectedBarberId === 'any' ? 'text-gold-deep' : 'text-smoke group-hover:text-gold-deep'
            }`}
          >
            ✦
          </span>
        </div>
        <span
          className={`font-display uppercase tracking-[0.08em] text-[0.64rem] leading-tight text-center transition-colors duration-200 ${
            selectedBarberId === 'any' ? 'text-ink' : 'text-fg2'
          }`}
        >
          {t('noPreference')}
        </span>
      </button>

      {/* Barbers */}
      {barbers.map((barber) => {
        const bio = localizedBio(barber, locale)
        const isSelected = selectedBarberId === barber.id
        return (
          <button
            key={barber.id}
            type="button"
            className="group flex flex-col items-center gap-2 bg-transparent border-0 cursor-pointer p-0 w-16"
            onClick={() => onSelect(barber.id, barber.name)}
            title={bio ?? undefined}
            aria-label={barber.name}
          >
            <BarberAvatar barber={barber} selected={isSelected} />
            <span
              className={`font-display uppercase tracking-[0.08em] text-[0.64rem] leading-tight text-center transition-colors duration-200 ${
                isSelected ? 'text-ink' : 'text-fg2'
              }`}
            >
              {barber.name}
            </span>
          </button>
        )
      })}

      {/* No-preference hint */}
      {selectedBarberId === 'any' && (
        <p className="w-full text-[0.82rem] text-smoke mt-2">{t('noPreferenceHint')}</p>
      )}
    </div>
  )
}
