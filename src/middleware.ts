import createMiddleware from 'next-intl/middleware'
import { type NextRequest, NextResponse } from 'next/server'
import { pickLocale } from './lib/i18n/pick-locale'

// All 5 locales registered for routing; localeDetection disabled so next-intl
// never auto-selects 'le' from Accept-Language (FR-090 spec).
const intlMiddleware = createMiddleware({
  locales: ['nl', 'en', 'fr', 'es', 'le'],
  defaultLocale: 'nl',
  localePrefix: 'always',
  localeDetection: false,
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
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
