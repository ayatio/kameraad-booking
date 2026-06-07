import { getActiveServices } from '@/lib/db/queries/services'
import { getActiveWindows } from '@/lib/db/queries/availability'
import { SITE_URL } from '@/lib/seo/site'
import type { Service } from '@/lib/db/types'
import type { AvailabilityWindow } from '@/lib/services/availability'

// ─── PROVISIONAL business identity (client data pending confirmation) ─────────
// Mirrors the address/phone shown in the home "Visit" band; keep in sync.
const BUSINESS = {
  name: 'Kameraad Haarsnijder',
  street: 'Parijsstraat 29',
  postalCode: '3000',
  city: 'Leuven',
  country: 'BE',
  telephone: '+32 486 33 67 14',
  email: 'info@kameraadhaarsnijder.be',
} as const

// DB day_of_week (0..6) → schema.org DayOfWeek, per task mapping 0=Mon … 6=Sun.
const SCHEMA_DAYS = [
  'https://schema.org/Monday',
  'https://schema.org/Tuesday',
  'https://schema.org/Wednesday',
  'https://schema.org/Thursday',
  'https://schema.org/Friday',
  'https://schema.org/Saturday',
  'https://schema.org/Sunday',
] as const

// 'HH:MM:SS' | 'HH:MM' → 'HH:MM' (schema opens/closes).
function hhmm(time: string): string {
  return time.slice(0, 5)
}

interface OpeningHoursSpec {
  '@type': 'OpeningHoursSpecification'
  dayOfWeek: string
  opens: string
  closes: string
}

// Aggregate the shop's distinct day→hours from per-barber availability windows.
// Identical (day, opens, closes) windows across barbers collapse to one spec;
// split shifts on the same day are preserved as separate specs (both valid).
export function buildOpeningHoursSpecification(
  windows: AvailabilityWindow[],
): OpeningHoursSpec[] {
  const seen = new Set<string>()
  const specs: OpeningHoursSpec[] = []

  for (const w of windows) {
    const day = SCHEMA_DAYS[w.dayOfWeek]
    if (!day) continue // out-of-range guard
    const opens = hhmm(w.startTime)
    const closes = hhmm(w.endTime)
    const key = `${w.dayOfWeek}|${opens}|${closes}`
    if (seen.has(key)) continue
    seen.add(key)
    specs.push({ '@type': 'OpeningHoursSpecification', dayOfWeek: day, opens, closes })
  }

  // Stable order: by day-of-week then opening time, for deterministic output.
  return specs.sort((a, b) => {
    const da = SCHEMA_DAYS.indexOf(a.dayOfWeek as (typeof SCHEMA_DAYS)[number])
    const db = SCHEMA_DAYS.indexOf(b.dayOfWeek as (typeof SCHEMA_DAYS)[number])
    return da - db || a.opens.localeCompare(b.opens)
  })
}

// Derive a coarse priceRange (€ symbol tier) from the bookable services' max
// price. Schema priceRange is free text; the € tier is the conventional form.
export function derivePriceRange(services: Service[]): string {
  const prices = services.filter((s) => !s.is_walk_in).map((s) => s.price_cents)
  if (prices.length === 0) return '€€'
  const max = Math.max(...prices)
  if (max <= 2500) return '€'
  if (max <= 5000) return '€€'
  return '€€€'
}

// Build the HairSalon (LocalBusiness subtype) JSON-LD graph. Pure so it can be
// unit-tested / validated against schema.org without a DB.
export function buildHairSalonJsonLd(
  services: Service[],
  windows: AvailabilityWindow[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'HairSalon',
    '@id': `${SITE_URL}/#business`,
    name: BUSINESS.name,
    url: SITE_URL,
    image: `${SITE_URL}/img/og-default.jpg`,
    logo: `${SITE_URL}/img/logo.png`,
    telephone: BUSINESS.telephone,
    email: BUSINESS.email,
    priceRange: derivePriceRange(services),
    currenciesAccepted: 'EUR',
    address: {
      '@type': 'PostalAddress',
      streetAddress: BUSINESS.street,
      postalCode: BUSINESS.postalCode,
      addressLocality: BUSINESS.city,
      addressCountry: BUSINESS.country,
    },
    areaServed: BUSINESS.city,
    openingHoursSpecification: buildOpeningHoursSpecification(windows),
  }
}

// Server component: renders the salon's structured data. Reads live services +
// availability so priceRange and hours track the DB. Safe to embed once per
// page (home). Output is JSON.stringify'd — no user input flows in, so the
// <script> body needs no further escaping for valid LD+JSON.
export async function JsonLd() {
  const [services, windows] = await Promise.all([getActiveServices(), getActiveWindows()])
  const graph = buildHairSalonJsonLd(services, windows)

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- trusted, server-built JSON-LD
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  )
}
