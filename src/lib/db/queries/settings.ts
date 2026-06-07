import db from '../index'
import type { Setting } from '../types'

export async function getSettings(): Promise<Record<string, unknown>> {
  const rows = await db<Setting[]>`SELECT key, value FROM settings`
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export async function getSetting(key: string): Promise<unknown> {
  const rows = await db<Setting[]>`
    SELECT key, value FROM settings WHERE key = ${key}
  `
  return rows[0]?.value ?? null
}

// Atomic upsert of the §2 setting keys (admin settings editor). Each value is
// stored as a jsonb scalar so getSettings()/Number(...) round-trips cleanly.
export async function updateSettings(values: Record<string, number>): Promise<void> {
  const entries = Object.entries(values)
  if (entries.length === 0) return
  await db.begin(async (sql) => {
    for (const [key, value] of entries) {
      await sql`
        INSERT INTO settings (key, value, updated_at)
        VALUES (${key}, ${sql.json(value)}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
      `
    }
  })
}
