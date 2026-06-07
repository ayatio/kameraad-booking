# Kameraad Haarsnijder Booking Platform — Handover

A concise operator + developer handover for the Kameraad booking platform
(github.com/ayatio/kameraad-booking). Pairs with `LAUNCH-RUNBOOK.md` (go-live)
and `UAT-CHECKLIST.md` (acceptance).

## 1. What it is
A Next.js 14 (App Router, TypeScript strict) monolith that replaces the booking
flow: a public marketing site + an online booking engine + transactional &
marketing email + an admin/CRM back-office. Built in 4 phases:
- **Phase 1** Foundation (schema, i18n skeleton, CI).
- **Phase 2** Booking engine (availability, 4-step booking, cancel/reschedule, email, cron).
- **Phase 3** Admin + CRM (Auth.js, RBAC, calendars, availability/blocks, CRM, GDPR, services/banner/bulk/stats).
- **Phase 4** Public site, SEO, launch (this phase).

## 2. Architecture (D1)
- **Service layer:** all business logic is pure, framework-free TypeScript in `src/lib/services/*` (no Next imports). Route handlers and server components are thin callers. Reuse for future clients = extract `lib/services` + `db/`.
- **DB access (D22):** `postgres` (postgres.js) client + hand-written typed query modules in `src/lib/db/`. Raw SQL migrations in `db/migrations/` (numbered, append-only — never edit an applied migration). No ORM.
- **i18n (D2):** next-intl, 5 locales `nl` (default) / `en` / `fr` / `es` / `le` (Leuvens dialect, switcher-only, rendered `lang="nl"`). UI strings in `messages/{locale}.json`; DB content has `*_{locale}` columns with NL fallback.
- **Email:** transport interface with a Resend implementation that auto-activates when `RESEND_API_KEY` is set; otherwise a dry-run transport logs to `email_log` + writes `.email-outbox/`. React-Email templates ×7 types ×5 locales; `.ics` with a persisted `ics_sequence`.
- **Auth:** Auth.js (NextAuth v5) credentials on `admin_users`, bcrypt, 8h sliding session, lockout; RBAC matrix in `src/lib/auth/permissions.ts`; every privileged mutation writes `audit_log`.

## 3. Key commands
```
npm run dev               # local dev (needs docker DB up)
npm run build             # production build
npm run start             # serve the production build
npm run lint / typecheck  # quality gates
npm run test              # vitest unit suite
npm run test:integration  # vitest integration suite (needs Postgres)
npm run test:e2e          # Playwright regression (Phases 2–4) vs local prod build
npm run db:migrate        # apply pending SQL migrations (idempotent)
npm run db:seed           # seed reference + provisional data (idempotent)
docker compose up -d db   # local Postgres 16 (user/db kameraad, pw kameraad_dev)
```

## 4. Environments & secrets
- Local dev: docker Postgres; dry-run email; `AUTH_SECRET` falls back to an insecure dev constant (never in prod).
- Production env vars: see `LAUNCH-RUNBOOK.md §1` (`DATABASE_URL`, `AUTH_SECRET`, `RESEND_API_KEY`, `CRON_SECRET`, `APP_BASE_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_ALLOW_INDEXING`).
- `.env.example` is the maintained reference (FR-113). No secrets in the repo; `gitleaks` runs in CI (`.gitleaks.toml` allowlists only e2e test fixtures).

## 5. Operating the platform (admin, NL back-office at `/admin`)
- **Login:** `/admin/login`. Owner = full access; barbers = own calendar/bookings/hours + CRM (per the §6.2 matrix).
- **Daily use:** calendars (day/week/month), booking detail drawer (reschedule/cancel/no-show/complete), manual bookings.
- **Availability:** weekly hours editor + blocked periods (holidays seeded); blocking over a booking triggers the keep/cancel-notify conflict dialog.
- **CRM/GDPR:** search customers, edit notes/opt-ins; **owner-only** GDPR JSON export + type-to-confirm purge.
- **Content:** services editor, seasonal banner (reflects on the public home within ~60s), settings (cancellation window etc.), bulk marketing email (respects opt-out), statistics.
- **Adding a barber:** Settings → invite (email + linked barber) → send the set-password link → barber sets a password and logs in.

## 6. Settings (runtime-editable, no redeploy — FR-008)
`settings` table keys: `cancellation_window_hours` (default 24, 1–72), `buffer_min` (0), `min_lead_time_hours` (2), `booking_horizon_days` (56), `rebooking_weeks` (5). Owner-editable in admin; all copy that mentions the window renders the live value.

## 7. SEO posture (FR-101)
- Staging/preview = **noindex** (default; `NEXT_PUBLIC_ALLOW_INDEXING` unset). Production flips it to `true` at go-live.
- `/sitemap.xml` (all public pages × locales, hreflang + x-default=nl), `/robots.txt`, per-page canonical + OG, `HairSalon` JSON-LD on the home.

## 8. Outstanding before launch (must-do)
1. **Design Gate C sign-off** for the public pages (composed from the Gate-A system; no Gate-C mockups exist — see the Phase-4 PR).
2. Replace **all PROVISIONAL/DRAFT data**: opening hours per barber, barber–service matrix, service names/prices, about/contact copy, ES + Leuvens translations, privacy policy legal review.
3. Stand up the external services in `LAUNCH-RUNBOOK.md §0` (Vercel, prod DB, Resend domain, DNS).
4. Harvest the **full legacy Webflow URL inventory** and complete the FR-102 redirect map (only known paths are mapped so far).
5. Confirm the owner login email; set the owner password via the invite flow.
6. Confirm the FR-043 lockout threshold (FA says 5 / PHASES says 6 — implemented per FA).

## 9. Support / maintenance
- Branch model: feature branches → PR to `develop` → release to `main`. CI (lint, typecheck, migrate×2, seed, unit, build, gitleaks) gates every PR.
- Backups: provider daily snapshots, 7-day retention; test a restore (runbook §8).
- Logs: server errors logged with context; customers see localized friendly errors, never stack traces (FR-112).

---
*This platform is v1. Out of scope (v1): online payments, customer accounts, 2FA, custom intake questions, webhooks, drag-to-reschedule, social links, multi-shop (FA §12).*
