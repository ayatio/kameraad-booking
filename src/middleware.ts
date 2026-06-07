import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { pickLocale } from './lib/i18n/pick-locale'

// All 5 locales registered for routing; localeDetection disabled so next-intl
// never auto-selects 'le' from Accept-Language (FR-090 spec).
// alternateLinks disabled: next-intl would otherwise emit an HTTP `Link: …;
// rel="alternate"; hreflang="le"` header for every locale, but `hreflang="le"`
// is invalid BCP-47 (Leuvens is a private Dutch dialect, switcher-only) and
// fails Lighthouse's hreflang audit (FR-101/103). The correct hreflang set
// (nl/en/fr/es + x-default) is emitted in each page's <head> via the SEO
// metadata layer (src/lib/seo/site.ts), so the middleware header is redundant.
const intlMiddleware = createMiddleware({
  locales: ['nl', 'en', 'fr', 'es', 'le'],
  defaultLocale: 'nl',
  localePrefix: 'always',
  localeDetection: false,
  alternateLinks: false,
})

export default function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === '/') {
    // FR-090: bare / redirects to best Accept-Language match among nl/en/fr/es only.
    const locale = pickLocale(request.headers.get('accept-language'))
    const url = request.nextUrl.clone()
    url.pathname = `/${locale}`
    return NextResponse.redirect(url, 302)
  }

  return intlMiddleware(request)
}

export const config = {
  // Exclude api, admin (NL-only back-office outside [locale]), Next internals and
  // any file with an extension. `/admin/**` must NOT be locale-rewritten.
  matcher: ['/((?!api|admin|_next|_vercel|.*\\..*).*)'],
}
