import type { Metadata } from 'next'
import {
  IS_INDEXABLE,
  alternatesFor,
  localizedUrl,
  type Locale,
  type PageKey,
} from './site'

export const SITE_NAME = 'Kameraad Haarsnijder'

// Default social share image. PROVISIONAL asset — swap when brand OG art lands.
export const DEFAULT_OG_IMAGE = '/img/og-default.jpg'

// OG `locale` expects a POSIX-ish lang_REGION tag. `le` (Leuvens dialect) is
// surfaced as nl_BE — it has no valid language tag of its own (see site.ts).
const OG_LOCALE: Record<Locale, string> = {
  nl: 'nl_BE',
  en: 'en_GB',
  fr: 'fr_BE',
  es: 'es_ES',
  le: 'nl_BE',
}

export interface BuildMetadataInput {
  locale: Locale
  pathKey: PageKey
  title: string
  description: string
  ogImage?: string
}

// Single source of truth for a page's <head>: localized title/description,
// canonical + hreflang alternates, Open Graph, Twitter card, and the
// indexability-driven robots directive. Pages pass their already-localized
// title/description (reused from Delegation A's per-page i18n namespaces — see
// note in the page generateMetadata exports) so SEO strings are NOT duplicated.
export function buildMetadata({
  locale,
  pathKey,
  title,
  description,
  ogImage = DEFAULT_OG_IMAGE,
}: BuildMetadataInput): Metadata {
  const url = localizedUrl(locale, pathKey)
  const ogLocale = OG_LOCALE[locale]
  const ogAlternates = (Object.keys(OG_LOCALE) as Locale[])
    .filter((l) => l !== locale)
    .map((l) => OG_LOCALE[l])

  return {
    title,
    description,
    alternates: alternatesFor(locale, pathKey),
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      locale: ogLocale,
      alternateLocale: Array.from(new Set(ogAlternates)),
      type: 'website',
      images: [{ url: ogImage, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
    // FR-101: staging/preview/local default to noindex. Only flips to indexable
    // when infra sets NEXT_PUBLIC_ALLOW_INDEXING=true in production.
    robots: IS_INDEXABLE
      ? { index: true, follow: true }
      : { index: false, follow: false },
  }
}
