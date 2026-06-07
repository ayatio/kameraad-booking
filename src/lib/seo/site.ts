import type { Metadata } from 'next'

// ─── Base URL ────────────────────────────────────────────────────────────────
// Production domain is injected by infra (NEXT_PUBLIC_SITE_URL) at build/deploy.
// Falls back to localhost for dev. No trailing slash.
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
)

// ─── Indexability (FR-101) ───────────────────────────────────────────────────
// DEFAULT (env unset) = NOT indexable. Staging/preview/local must never be
// crawled; production only becomes indexable when infra explicitly sets
// NEXT_PUBLIC_ALLOW_INDEXING=true. This single flag drives BOTH robots.txt and
// every page's `robots` meta.
export const IS_INDEXABLE = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true'

// ─── Locales (FR-090) ────────────────────────────────────────────────────────
// All 5 are real, routable pages. `le` (Leuvens) is a Dutch dialect rendered
// with lang="nl" and is switcher-only — it is NOT a crawlable language target.
export const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const
export type Locale = (typeof LOCALES)[number]

export const DEFAULT_LOCALE: Locale = 'nl'

// hreflang DECISION (FR-090): emit hreflang alternates ONLY for nl/en/fr/es and
// `x-default` → nl. `le` is EXCLUDED from hreflang because `hreflang="le"` is
// invalid BCP-47 (le is a private dialect, not an ISO language target) and `le`
// is switcher-only, not a crawl target. `le` URLs STILL appear in the sitemap as
// normal <url> entries (they are real pages) but carry no hreflang annotation.
export const HREFLANG_LOCALES = ['nl', 'en', 'fr', 'es'] as const
export type HreflangLocale = (typeof HREFLANG_LOCALES)[number]

// ─── Page keys → path segments ───────────────────────────────────────────────
// Centralised so Delegation C can later swap in PER-LOCALE localized slugs
// WITHOUT touching any SEO code: today every locale shares the same segment.
// Empty string = the locale home (e.g. /nl).
export const PAGE_PATHS = {
  home: '',
  services: 'diensten',
  about: 'over-ons',
  contact: 'contact',
  privacy: 'privacy',
  booking: 'boeken',
} as const
export type PageKey = keyof typeof PAGE_PATHS

// All public, indexable page keys (token pages /afspraak, /voorkeuren and the
// /admin back-office are intentionally excluded).
export const PUBLIC_PAGE_KEYS = Object.keys(PAGE_PATHS) as PageKey[]

// ─── URL helpers ─────────────────────────────────────────────────────────────
export function absUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${p}`
}

// Logical page key → locale-prefixed path. Segments are currently locale-agnostic
// (see PAGE_PATHS); when C introduces localized slugs this is the only switch.
export function localizedPath(locale: Locale, pageKey: PageKey): string {
  const seg = PAGE_PATHS[pageKey]
  return seg ? `/${locale}/${seg}` : `/${locale}`
}

export function localizedUrl(locale: Locale, pageKey: PageKey): string {
  return absUrl(localizedPath(locale, pageKey))
}

// Build the Next.js `alternates` block for a page: a per-locale `canonical`
// (current locale's absolute URL) plus the hreflang `languages` map. `le` is
// absent from `languages` by design (see HREFLANG_LOCALES); `x-default` → nl.
export function alternatesFor(locale: Locale, pageKey: PageKey): Metadata['alternates'] {
  const languages: Record<string, string> = {}
  for (const l of HREFLANG_LOCALES) {
    languages[l] = localizedUrl(l, pageKey)
  }
  languages['x-default'] = localizedUrl(DEFAULT_LOCALE, pageKey)

  return {
    canonical: localizedUrl(locale, pageKey),
    languages,
  }
}
