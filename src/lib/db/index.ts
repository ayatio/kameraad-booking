import postgres from 'postgres'

const connectionString =
  process.env.DATABASE_URL ??
  'postgresql://kameraad:kameraad_dev@localhost:5432/kameraad'

// Singleton pattern: reuse connection across Next.js hot reloads in dev
const globalForDb = globalThis as unknown as { db: ReturnType<typeof postgres> }

const db = globalForDb.db ?? postgres(connectionString)

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db
}

export default db
