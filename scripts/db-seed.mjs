#!/usr/bin/env node
import postgres from 'postgres'
import { readdir, readFile } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://kameraad:kameraad_dev@localhost:5432/kameraad'

const sql = postgres(DATABASE_URL, { max: 1 })

async function main() {
  const seedsDir = join(__dirname, '../db/seeds')
  const files = (await readdir(seedsDir))
    .filter((f) => f.endsWith('.sql'))
    .sort()

  for (const filename of files) {
    const content = await readFile(join(seedsDir, filename), 'utf8')
    await sql.begin(async (tx) => {
      await tx.unsafe(content)
    })
    console.log(`Applied seed: ${filename}`)
  }

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
