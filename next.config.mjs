import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n.ts')

// ─── Redirect map (FR-102) ─────────────────────────────────────────────────────
// All entries are explicit 301 (`statusCode: 301`). FR-102 specifies a "301
// redirect map"; Next's `permanent: true` shorthand would emit a 308 (method-
// preserving) instead — functionally SEO-equivalent, but these are GET-only
// marketing/booking entry points, so we emit the literal 301 the spec calls for.
// next.config `redirects()` runs BEFORE
// next-intl middleware for matched paths, so unprefixed legacy paths and the
// localized booking slugs below resolve cleanly without locale-rewrite interference.
// Query strings are preserved automatically by Next for path-only redirects
// (no `:path*` / regex on the source), so deep links like
// `/en/book?barber=adil&service=haircut&date=…` (FR-020/FR-022) survive the 301.
//
// DECISION — localized booking slugs use 301 REDIRECTS to the canonical
// `/{locale}/boeken`, NOT rewrites. The booking flow canonically lives at
// `/{locale}/boeken` (the only physical route, force-dynamic) and Delegation-B
// SEO (src/lib/seo/site.ts → PAGE_PATHS.booking = 'boeken') emits canonical +
// hreflang against that path for EVERY locale. Redirecting (not rewriting) keeps
// a single canonical URL per page: the localized slug (`/en/book`, `/fr/reserver`,
// `/es/reservar`) is a friendly marketing entry point that 301s to the canonical
// page, avoiding duplicate-content and keeping hreflang/canonical self-consistent.
// A rewrite would make the localized slug the visible URL and would require the
// SEO canonical/hreflang to point at the localized slugs (they don't), so redirect
// is the safe, consistent choice. `nl`/`le` already use `boeken` canonically
// (`le` = Leuvens, a Dutch dialect → keeps the Dutch `boeken` slug) → no redirect.
async function redirects() {
  return [
    // ── Localized booking slugs → canonical /{locale}/boeken ──────────────────
    { source: '/en/book', destination: '/en/boeken', statusCode: 301 },
    { source: '/fr/reserver', destination: '/fr/boeken', statusCode: 301 },
    { source: '/es/reservar', destination: '/es/boeken', statusCode: 301 },

    // ── Legacy Webflow → new (FR-102) ─────────────────────────────────────────
    // PROVISIONAL — full legacy URL inventory pending (harvest from live Webflow
    // sitemap, FR-102). Below are the explicit spec example plus high-confidence
    // derivable guesses. Confirm/extend against the real inventory before launch.
    //
    // Bare `/` is intentionally NOT mapped here — middleware owns it (302
    // Accept-Language locale pick, FR-090). Adding a `/` redirect would conflict.
    //
    // Booking entry points → Dutch canonical booking page:
    { source: '/afspraak-maken', destination: '/nl/boeken', statusCode: 301 }, // explicit FR-102 example
    { source: '/book', destination: '/nl/boeken', statusCode: 301 }, // PROVISIONAL guess
    { source: '/booking', destination: '/nl/boeken', statusCode: 301 }, // PROVISIONAL guess
    { source: '/afspraak', destination: '/nl/boeken', statusCode: 301 }, // PROVISIONAL guess
    { source: '/reserveren', destination: '/nl/boeken', statusCode: 301 }, // PROVISIONAL guess

    // Marketing pages → Dutch canonical pages (unprefixed legacy paths are not
    // real routes — public pages live under /{locale}/… — so these are safe):
    { source: '/contact', destination: '/nl/contact', statusCode: 301 }, // PROVISIONAL guess
    { source: '/diensten', destination: '/nl/diensten', statusCode: 301 }, // PROVISIONAL guess
    { source: '/services', destination: '/nl/diensten', statusCode: 301 }, // PROVISIONAL guess
    { source: '/over-ons', destination: '/nl/over-ons', statusCode: 301 }, // PROVISIONAL guess
    { source: '/about', destination: '/nl/over-ons', statusCode: 301 }, // PROVISIONAL guess
  ]
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects,
}

export default withNextIntl(nextConfig)
