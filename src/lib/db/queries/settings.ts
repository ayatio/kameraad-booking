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
