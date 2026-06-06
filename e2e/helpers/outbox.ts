import fs from 'fs'
import path from 'path'

const OUTBOX = path.join(process.cwd(), '.email-outbox')

interface OutboxMeta {
  from: string
  to: string
  subject: string
  type?: string
  ics?: { filename: string; method: string }
}

/**
 * Find the most-recent .email-outbox JSON payload file for the given recipient
 * and email type. Returns the parsed metadata or null if not found.
 */
export function findOutboxPayload(toEmail: string, type: string): OutboxMeta | null {
  if (!fs.existsSync(OUTBOX)) return null

  const files = fs
    .readdirSync(OUTBOX)
    .filter((f) => f.endsWith(`-${type}.json`))
    .sort()
    .reverse()

  for (const file of files) {
    try {
      const meta = JSON.parse(
        fs.readFileSync(path.join(OUTBOX, file), 'utf8'),
      ) as OutboxMeta
      if (meta.to === toEmail) return meta
    } catch {
      // skip malformed files
    }
  }
  return null
}
