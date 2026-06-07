import type { MetadataRoute } from 'next'
import {
  HREFLANG_LOCALES,
  LOCALES,
  PUBLIC_PAGE_KEYS,
  DEFAULT_LOCALE,
  localizedUrl,
  type PageKey,
} from '@/lib/seo/site'

// FR-101: ONE hreflang-annotated sitemap at /sitemap.xml covering every
// (locale × public page). This is standards-valid and simpler than a sitemap
// index of per-locale files; `alternates.languages` carries the hreflang set so
// each URL still advertises its language siblings. `le` URLs are emitted as
// normal <url> entries but WITHOUT hreflang alternates (see HREFLANG_LOCALES
// decision in site.ts) — they are real pages, just not crawlable lang targets.

// Per-page crawl hints. Home is the strongest entry point; legal lowest.
const PAGE_META: Record<PageKey, { changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']; priority: number }> = {
  home: { changeFrequency: 'weekly', priority: 1.0 },
  services: { changeFrequency: 'monthly', priority: 0.9 },
  booking: { changeFrequency: 'weekly', priority: 0.9 },
  about: { changeFrequency: 'monthly', priority: 0.6 },
  contact: { changeFrequency: 'yearly', priority: 0.5 },
  privacy: { changeFrequency: 'yearly', priority: 0.3 },
}

function hreflangLanguages(pageKey: PageKey): Record<string, string> {
  const languages: Record<string, string> = {}
  for (const l of HREFLANG_LOCALES) {
    languages[l] = localizedUrl(l, pageKey)
  }
  languages['x-default'] = localizedUrl(DEFAULT_LOCALE, pageKey)
  return languages
}

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  const entries: MetadataRoute.Sitemap = []

  for (const pageKey of PUBLIC_PAGE_KEYS) {
    const { changeFrequency, priority } = PAGE_META[pageKey]
    const languages = hreflangLanguages(pageKey)

    for (const locale of LOCALES) {
      entries.push({
        url: localizedUrl(locale, pageKey),
        lastModified,
        changeFrequency,
        priority,
        // `le` carries no hreflang block (excluded per FR-090 decision); the
        // nl/en/fr/es entries all share the same alternates map.
        ...(locale === 'le' ? {} : { alternates: { languages } }),
      })
    }
  }

  return entries
}
