#!/usr/bin/env node
import postgres from 'postgres'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://kameraad:kameraad_dev@localhost:5432/kameraad'

const sql = postgres(DATABASE_URL, { max: 1, onnotice: () => {} })

async function main() {
  // Create tracking table if missing
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `

  // Get already-applied filenames
  const applied = await sql`SELECT filename FROM schema_migrations`
  const appliedSet = new Set(applied.map((r) => r.filename))

  // Collect migration files in sorted order
  const migrationsDir = join(__dirname, '../db/migrations')
  const files = (await readdir(migrationsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const pending = files.filter((f) => !appliedSet.has(f))

  if (pending.length === 0) {
    console.log('No pending migrations.')
    await sql.end()
    return
  }

  for (const filename of pending) {
    const content = await readFile(join(migrationsDir, filename), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(content)
      await tx`INSERT INTO schema_migrations (filename) VALUES (${filename})`
    })
    console.log(`Applied migration: ${filename}`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
