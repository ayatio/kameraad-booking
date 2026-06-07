'use client'

import { useTranslations } from 'next-intl'
import type { Service } from '@/lib/db/types'

interface Props {
  services: Service[]
  locale: string
  selectedBarberServiceIds: string[] | null // null = 'any' (show all)
  selectedServiceSlug: string | null
  onSelect: (serviceSlug: string, serviceName: string, priceCents: number, durationMin: number) => void
}

function localizedServiceName(service: Service, locale: string): string {
  if (locale === 'nl') return service.name_nl
  if (locale === 'en') return service.name_en
  if (locale === 'fr') return service.name_fr ?? service.name_nl
  if (locale === 'es') return service.name_es ?? service.name_nl
  if (locale === 'le') return service.name_le ?? service.name_nl
  return service.name_nl
}

function formatPrice(cents: number): string {
  const euros = cents / 100
  return `€${Number.isInteger(euros) ? euros.toString() : euros.toFixed(2)}`
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}u ${m}min` : `${h}u`
}

export default function StepService({
  services,
  locale,
  selectedBarberServiceIds,
  selectedServiceSlug,
  onSelect,
}: Props) {
  const t = useTranslations('booking')

  const bookable = services.filter(
    (s) =>
      s.is_active &&
      !s.is_walk_in &&
      (selectedBarberServiceIds === null || selectedBarberServiceIds.includes(s.id)),
  )
  const walkIn = services.find((s) => s.is_active && s.is_walk_in)

  return (
    <div className="flex flex-col gap-3">
      {/* Bookable services — 2-col grid */}
      <div className="grid grid-cols-2 gap-3 [.bk-services-1col_&]:grid-cols-1">
        {bookable.map((service) => {
          const name = localizedServiceName(service, locale)
          const isSelected = selectedServiceSlug === service.slug
          return (
            <button
              key={service.id}
              type="button"
              onClick={() => onSelect(service.slug, name, service.price_cents, service.duration_min)}
              className={`flex items-center justify-between gap-2.5 text-left font-body text-base font-medium text-ink bg-white border rounded-md px-[19px] py-[17px] cursor-pointer transition-[border-color,background,box-shadow] duration-200 ${
                isSelected
                  ? 'border-gold bg-gold/[0.12] shadow-[inset_0_0_0_1px_theme(colors.gold.DEFAULT)]'
                  : 'border-line-paper hover:border-gold hover:shadow-[0_3px_14px_rgba(201,162,75,.12)]'
              }`}
              aria-pressed={isSelected}
            >
              <span>{name}</span>
              <span className="text-gold-deep font-semibold text-[0.97rem] shrink-0">
                {formatPrice(service.price_cents)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Duration hint for selected */}
      {selectedServiceSlug && (() => {
        const sel = bookable.find((s) => s.slug === selectedServiceSlug)
        return sel ? (
          <p className="text-[0.82rem] text-smoke">
            {formatDuration(sel.duration_min)}
          </p>
        ) : null
      })()}

      {/* Walk-in info card — non-selectable per D11 */}
      {walkIn && (
        <div
          className="flex items-center gap-3 px-[18px] py-3.5 border border-gold/40 rounded-md bg-gradient-to-r from-gold/[0.16] to-gold/[0.06] mt-1"
          aria-label={`${t('walkIn.title')}: ${t('walkIn.description')}`}
        >
          <span className="shrink-0 w-2 h-2 rounded-full bg-gold-deep opacity-80" />
          <div className="text-[0.88rem] text-fg2 leading-snug">
            <strong className="text-ink font-semibold">{t('walkIn.title')}</strong>
            {' — '}
            {t('walkIn.description')}
          </div>
        </div>
      )}
    </div>
  )
}
