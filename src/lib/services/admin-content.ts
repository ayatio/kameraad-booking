import { getBannerRow, getActiveBannerRow, upsertBanner } from '../db/queries/content'
import { writeAudit, AUDIT } from './audit'
import { assertCan } from '../auth/permissions'
import type { AdminActor } from './actor'
import type { Content } from '../db/types'

// Banner editor (FR-062, D20). Owner-only (content.banner). The public read
// (getActiveBanner) MUST happen at request time so an edit reflects within 60s
// with no redeploy — the consuming homepage (Phase 4) and the /api/banner
// endpoint both opt out of caching (force-dynamic).

const LOCALES = ['nl', 'en', 'fr', 'es', 'le'] as const
export type BannerLocale = (typeof LOCALES)[number]

export type LocaleMap = Partial<Record<BannerLocale, string | null>>

export async function getBanner(): Promise<Content | null> {
  return getBannerRow()
}

export interface UpdateBannerInput {
  titles: LocaleMap
  texts: LocaleMap
  isActive: boolean
}

export async function updateBanner(input: UpdateBannerInput, actor: AdminActor): Promise<Content> {
  assertCan(actor.role, 'content.banner') // owner-only; throws ForbiddenError otherwise
  const banner = await upsertBanner({
    title_nl: input.titles.nl ?? null,
    title_en: input.titles.en ?? null,
    title_fr: input.titles.fr ?? null,
    title_es: input.titles.es ?? null,
    title_le: input.titles.le ?? null,
    text_nl: input.texts.nl ?? null,
    text_en: input.texts.en ?? null,
    text_fr: input.texts.fr ?? null,
    text_es: input.texts.es ?? null,
    text_le: input.texts.le ?? null,
    is_active: input.isActive,
    updated_by: actor.email,
  })
  await writeAudit({
    actor: actor.email,
    action: AUDIT.BANNER_UPDATE,
    payload: { is_active: input.isActive },
  })
  return banner
}

// Public read: the active banner localized for one locale, or null. Returns a
// flat shape ({ title, text }) so the homepage / API can render directly.
export interface ActiveBanner {
  title: string | null
  text: string | null
}

export async function getActiveBanner(locale: BannerLocale): Promise<ActiveBanner | null> {
  const row = await getActiveBannerRow()
  if (!row) return null
  const title = (row[`title_${locale}` as keyof Content] as string | null) ?? row.title_nl
  const text = (row[`text_${locale}` as keyof Content] as string | null) ?? row.text_nl
  return { title, text }
}
