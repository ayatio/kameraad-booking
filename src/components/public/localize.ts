import type { Barber, Service } from '@/lib/db/types'

// FR-092: DB-localized fields resolve via the `_{locale}` columns with NL
// fallback. Mirrors the helpers used inside the booking components.

export function localizeBarberBio(barber: Barber, locale: string): string | null {
  switch (locale) {
    case 'nl':
      return barber.bio_nl
    case 'en':
      return barber.bio_en ?? barber.bio_nl
    case 'fr':
      return barber.bio_fr ?? barber.bio_nl
    case 'es':
      return barber.bio_es ?? barber.bio_nl
    case 'le':
      return barber.bio_le ?? barber.bio_nl
    default:
      return barber.bio_nl
  }
}

export function localizeServiceName(service: Service, locale: string): string {
  switch (locale) {
    case 'nl':
      return service.name_nl
    case 'en':
      return service.name_en
    case 'fr':
      return service.name_fr ?? service.name_nl
    case 'es':
      return service.name_es ?? service.name_nl
    case 'le':
      return service.name_le ?? service.name_nl
    default:
      return service.name_nl
  }
}

export function localizeServiceDesc(service: Service, locale: string): string | null {
  switch (locale) {
    case 'nl':
      return service.description_nl
    case 'en':
      return service.description_en ?? service.description_nl
    case 'fr':
      return service.description_fr ?? service.description_nl
    case 'es':
      return service.description_es ?? service.description_nl
    case 'le':
      return service.description_le ?? service.description_nl
    default:
      return service.description_nl
  }
}

export function formatPrice(cents: number): string {
  const euros = cents / 100
  return `€${Number.isInteger(euros) ? euros.toString() : euros.toFixed(2)}`
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m ? `${h}u ${m}min` : `${h}u`
}
