/**
 * seo.spec.ts — FR-101: sitemap, robots, canonical/hreflang/OG/robots meta,
 * and JSON-LD validity (local proxy for Google Rich Results).
 *
 * NOTE: the playwright webServer builds WITHOUT NEXT_PUBLIC_ALLOW_INDEXING, so
 * the build is in the DEFAULT staging posture (IS_INDEXABLE=false). These tests
 * assert that staging posture (robots Disallow /, meta noindex). The production
 * (indexable) posture is exercised by the Lighthouse job, which builds with
 * NEXT_PUBLIC_ALLOW_INDEXING=true.
 *
 * Desktop-chromium only (not in the mobile testMatch allowlist).
 */
import { test, expect } from '@playwright/test'

// ─── sitemap.xml ──────────────────────────────────────────────────────────────

test('sitemap.xml: urlset, per-locale urls, hreflang + x-default', async ({ page }) => {
  const res = await page.request.get('/sitemap.xml')
  expect(res.status()).toBe(200)
  expect(res.headers()['content-type']).toContain('xml')

  const xml = await res.text()
  expect(xml).toContain('<urlset')
  expect(xml).toContain('<url>')

  // Public pages × locales present (sample the home for nl/en/fr/es/le).
  for (const locale of ['nl', 'en', 'fr', 'es', 'le']) {
    expect(xml, `home url for ${locale}`).toMatch(new RegExp(`<loc>[^<]*/${locale}</loc>`))
  }
  // A non-home page too (booking).
  expect(xml).toMatch(/<loc>[^<]*\/nl\/boeken<\/loc>/)

  // hreflang alternates including x-default (Next emits <xhtml:link rel="alternate">).
  expect(xml).toContain('rel="alternate"')
  for (const hl of ['nl', 'en', 'fr', 'es', 'x-default']) {
    expect(xml, `hreflang ${hl}`).toContain(`hreflang="${hl}"`)
  }
})

// ─── robots.txt (staging posture) ─────────────────────────────────────────────

test('robots.txt: staging posture disallows all crawling', async ({ page }) => {
  const res = await page.request.get('/robots.txt')
  expect(res.status()).toBe(200)
  const body = await res.text()
  // IS_INDEXABLE defaults false → Disallow: /
  expect(body).toMatch(/User-Agent:\s*\*/i)
  expect(body).toMatch(/Disallow:\s*\//)
})

// ─── Home <head>: canonical / hreflang / OG / robots meta ─────────────────────

test('home head: canonical, hreflang alternates, OG, noindex robots meta', async ({ page }) => {
  await page.goto('/nl')

  // Canonical
  const canonical = page.locator('head link[rel="canonical"]')
  await expect(canonical).toHaveCount(1)
  expect(await canonical.getAttribute('href')).toMatch(/\/nl$/)

  // hreflang alternates (nl/en/fr/es/x-default)
  for (const hl of ['nl', 'en', 'fr', 'es', 'x-default']) {
    await expect(
      page.locator(`head link[rel="alternate"][hreflang="${hl}"]`),
      `hreflang ${hl}`,
    ).toHaveCount(1)
  }

  // OpenGraph
  await expect(page.locator('head meta[property="og:title"]')).toHaveCount(1)
  const ogUrl = page.locator('head meta[property="og:url"]')
  await expect(ogUrl).toHaveCount(1)
  expect(await ogUrl.getAttribute('content')).toMatch(/\/nl$/)

  // robots meta = noindex (staging build)
  const robotsMeta = page.locator('head meta[name="robots"]')
  await expect(robotsMeta).toHaveCount(1)
  expect((await robotsMeta.getAttribute('content'))?.toLowerCase()).toContain('noindex')
})

// ─── JSON-LD validity (proxy for Google Rich Results) ─────────────────────────

test('home JSON-LD is a valid HairSalon graph', async ({ page }) => {
  await page.goto('/nl')

  const raw = await page.locator('script[type="application/ld+json"]').first().textContent()
  expect(raw, 'a JSON-LD script is present').toBeTruthy()

  const data = JSON.parse(raw!)

  // @context = schema.org
  expect(String(data['@context'])).toMatch(/schema\.org/)

  // @type = HairSalon (string or array including it)
  const types = Array.isArray(data['@type']) ? data['@type'] : [data['@type']]
  expect(types).toContain('HairSalon')

  // Required identity fields
  expect(data.name, 'name').toBeTruthy()
  expect(data.telephone, 'telephone').toBeTruthy()

  // Address with the required sub-fields
  expect(data.address, 'address').toBeTruthy()
  expect(data.address.streetAddress, 'streetAddress').toBeTruthy()
  expect(data.address.addressLocality, 'addressLocality').toBeTruthy()
  expect(data.address.addressCountry, 'addressCountry').toBeTruthy()

  // openingHoursSpecification: non-empty array with valid dayOfWeek + opens/closes
  expect(Array.isArray(data.openingHoursSpecification), 'openingHoursSpecification is array').toBe(
    true,
  )
  expect(data.openingHoursSpecification.length, 'has ≥1 opening-hours spec').toBeGreaterThan(0)
  for (const spec of data.openingHoursSpecification) {
    expect(spec['@type']).toBe('OpeningHoursSpecification')
    expect(String(spec.dayOfWeek)).toMatch(/schema\.org\/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/)
    expect(spec.opens, 'opens HH:MM').toMatch(/^\d{2}:\d{2}$/)
    expect(spec.closes, 'closes HH:MM').toMatch(/^\d{2}:\d{2}$/)
  }
})
