import { NextRequest, NextResponse } from 'next/server'
import { getActiveBanner, type BannerLocale } from '@/lib/services/admin-content'

// Public banner read (FR-062, D20). force-dynamic so an admin edit is reflected
// within 60s with NO redeploy — the eventual Phase-4 homepage component that
// consumes the banner MUST likewise be request-time (force-dynamic / no cache).
export const dynamic = 'force-dynamic'

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const

// GET /api/banner?locale=nl — the active banner for one locale, or null.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('locale') ?? 'nl'
  const locale = (LOCALES as readonly string[]).includes(raw) ? (raw as BannerLocale) : 'nl'
  const banner = await getActiveBanner(locale)
  return NextResponse.json({ banner })
}
