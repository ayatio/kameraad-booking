# Kameraad Haarsnijder — Booking Platform

Custom booking platform for Kameraad Haarsnijder (Haarlem), replacing Calendly and the existing Webflow site. Customers book, cancel, and reschedule haircut appointments across three locales (NL · EN · FR) without creating an account.

---

## Architecture

### D1 — Service layer

Next.js 14 monolith with a strict internal service layer. All business logic lives in `src/lib/services/*` as pure, framework-free TypeScript modules (no Next.js imports). Route handlers and server components are thin callers that pass data in and render results out. The reuse path for future clients is extracting `lib/services/` + `db/` into a shared package — not spinning up a separate deployable service.

### D22 — Database access

`postgres` (postgres.js) client with hand-written typed query modules in `src/lib/db/`. Migrations are raw SQL files in `db/migrations/`, applied in filename order by `scripts/db-migrate.mjs`. No ORM.

---

## Local development

**Prerequisites:** Node 22, Docker (for Postgres).

```bash
# 1. Start Postgres
docker compose up -d db

# 2. Environment
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Database setup
npm run db:migrate && npm run db:seed

# 5. Dev server
npm run dev
```

The dev server runs at `http://localhost:3000`. `/` redirects to `/nl` by default.

### npm scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript strict check (`tsc --noEmit`) |
| `npm run format` | Prettier |
| `npm run test` | Vitest unit tests |
| `npm run db:migrate` | Apply pending SQL migrations (idempotent) |
| `npm run db:seed` | Load seed data (idempotent) |

---

## Migration workflow

**Adding a migration:** create the next numbered file in `db/migrations/` (e.g. `003_my_change.sql`). The runner applies files in filename order and records each applied filename in the `schema_migrations` table. Each migration runs inside a single transaction; a failure rolls back fully and the runner exits non-zero.

**Idempotency:** the runner skips already-applied filenames, so re-running `npm run db:migrate` on an up-to-date database is always a no-op. Seed files in `db/seeds/` must be internally idempotent — use `ON CONFLICT DO NOTHING` or `WHERE NOT EXISTS` guards so re-running `npm run db:seed` is safe.

**CI:** the `ci` job starts from a clean Postgres 16 container, runs `db:migrate` once to apply all migrations, then immediately runs it a second time to assert idempotency, then runs `db:seed` before the test and build steps.

**Provisional data:** seed rows for client-confirmed content (opening hours, per-barber service matrix, FR translations) are marked with `-- PROVISIONAL` comments and will be updated without a migration once the client signs off.

---

## i18n

Routes: `/{nl,en,fr}/…`. The bare `/` redirects to the best-match locale via `Accept-Language` (fallback: `nl`). UI strings live in `messages/{nl,en,fr}.json` via next-intl. French service and barber content in the seed data is agent-drafted and pending client review (FR-094).
