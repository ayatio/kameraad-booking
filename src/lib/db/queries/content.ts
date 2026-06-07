import db from '../index'
import type { Content } from '../types'

// content table (migration 004, D20). v1 has a single editable surface: the
// seasonal banner (key = 'banner').

const BANNER_KEY = 'banner'

export async function getBannerRow(): Promise<Content | null> {
  const rows = await db<Content[]>`SELECT * FROM content WHERE key = ${BANNER_KEY} LIMIT 1`
  return rows[0] ?? null
}

// Active banner only — for the public homepage (read at request time, FR-062).
export async function getActiveBannerRow(): Promise<Content | null> {
  const rows = await db<Content[]>`
    SELECT * FROM content WHERE key = ${BANNER_KEY} AND is_active = true LIMIT 1
  `
  return rows[0] ?? null
}

export interface BannerUpsert {
  title_nl: string | null
  title_en: string | null
  title_fr: string | null
  title_es: string | null
  title_le: string | null
  text_nl: string | null
  text_en: string | null
  text_fr: string | null
  text_es: string | null
  text_le: string | null
  is_active: boolean
  updated_by: string | null
}

export async function upsertBanner(fields: BannerUpsert): Promise<Content> {
  const rows = await db<Content[]>`
    INSERT INTO content (
      key, title_nl, title_en, title_fr, title_es, title_le,
      text_nl, text_en, text_fr, text_es, text_le, is_active, updated_by
    ) VALUES (
      ${BANNER_KEY},
      ${fields.title_nl}, ${fields.title_en}, ${fields.title_fr}, ${fields.title_es}, ${fields.title_le},
      ${fields.text_nl}, ${fields.text_en}, ${fields.text_fr}, ${fields.text_es}, ${fields.text_le},
      ${fields.is_active}, ${fields.updated_by}
    )
    ON CONFLICT (key) DO UPDATE SET
      title_nl = EXCLUDED.title_nl, title_en = EXCLUDED.title_en, title_fr = EXCLUDED.title_fr,
      title_es = EXCLUDED.title_es, title_le = EXCLUDED.title_le,
      text_nl = EXCLUDED.text_nl, text_en = EXCLUDED.text_en, text_fr = EXCLUDED.text_fr,
      text_es = EXCLUDED.text_es, text_le = EXCLUDED.text_le,
      is_active = EXCLUDED.is_active, updated_by = EXCLUDED.updated_by
    RETURNING *
  `
  return rows[0]
}
