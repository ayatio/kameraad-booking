import type { MetadataRoute } from 'next'
import { IS_INDEXABLE, SITE_URL } from '@/lib/seo/site'

// FR-101: robots.txt is driven by the SAME indexability flag as page meta.
// Default (env unset) = staging/preview posture → disallow everything so search
// engines never crawl a non-production deploy.
export default function robots(): MetadataRoute.Robots {
  if (!IS_INDEXABLE) {
    return {
      rules: [{ userAgent: '*', disallow: '/' }],
    }
  }

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Back-office, API and the per-customer token pages (manage/preferences)
        // must never be indexed. Token URLs are scoped per-locale under each
        // language prefix, hence the wildcard prefix.
        disallow: ['/admin', '/api', '/*/afspraak/', '/*/voorkeuren/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
