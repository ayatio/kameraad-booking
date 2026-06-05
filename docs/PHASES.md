# PHASES — Kameraad build plan for the autonomous agent

**Version 1.0 · 2026-06-05.** Companion to FUNCTIONAL-ANALYSIS.md (FA). FR-xxx references point there.
**Process per phase:** agent receives the phase prompt → works on branch `phase-N/<name>` → opens PR to `develop` with the acceptance checklist filled in → Ayat reviews → merge = phase accepted. **The agent never merges its own PRs and never pushes to `main`.**
Invoices (D23, provisional): 30% after Phase 1 acceptance · 30% after Phase 2 acceptance · 40% at production launch.

## Design validation gates (added 2026-06-05)

No UI is implemented before its mockup is approved. **Primary mechanism: Ayat designs in Claude Design (claude.ai/design) using `claude-design-prompts.md`** and exports approved screens as HTML into the repo under `docs/design/gate-{a,b,c}/` — these exports are the binding visual reference the agent implements against (canonical content per FUNCTIONAL-ANALYSIS always wins over mockup text). Fallback if a screen is missing: the agent produces static mockups under `/design-preview/*` on a Vercel preview for approval. Sign-off is recorded as a PR comment ("Design gate X approved", date) before the corresponding build work starts.

- **Gate A — before Phase 2 UI work:** booking steps 1–4, cancel page, reschedule page, confirmation states (NL primary; one EN sample to validate layout with longer strings).
- **Gate B — before Phase 3 UI work:** admin login, day/week/month calendars, booking detail drawer, CRM list + detail, GDPR delete dialog, hours/blocks editors, settings.
- **Gate C — before Phase 4 page build:** home, services, about, contact, privacy (+ mobile variants).

Iteration on a gate happens on the mockups (cheap), never on the built feature (expensive). Backend work in each phase (engine, APIs, migrations) proceeds in parallel and is not blocked by gates.

---

## Phase 1 — Foundation (repo, schema, i18n skeleton)

**Scope:** KAM-001..009 equivalents.

1. Next.js 14 (App Router, TS strict) bootstrap; Tailwind with Kameraad dark/gold tokens extracted from `kameraad-wireframe-prototype.html`; ESLint + Prettier; `src/lib/services/` layer convention documented in README (D1).
2. Fix migration 001: add `CREATE EXTENSION IF NOT EXISTS btree_gist;` fix walk-in seed INSERT properly (remove the column-count bug + follow-up UPDATE).
3. Migration 002 (new): `*_fr` columns on `barbers`(bio) + `services`(name, description); `customers.preferred_language TEXT NOT NULL DEFAULT 'nl' CHECK (IN nl/en/fr)`, `customers.no_show_count INT NOT NULL DEFAULT 0`, `customers.consent_given_at TIMESTAMPTZ`, `customers.unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32),'hex')`; availability UNIQUE → `(barber_id, day_of_week, start_time)` (D8); `settings` table + seeded keys (FA §2); `audit_log`; `admin_users` (role enum owner/barber, bcrypt hash, set-password token cols); unique partial index `email_log(appointment_id, email_type) WHERE status='sent'` (FR-070); `appointments.customer_id` → explicit `ON DELETE RESTRICT` (FR-082).
4. Seed updates: FR draft content for services/barbers (FR-094, mark `-- DRAFT translation`); Belgian public holidays 2026–2027 as all-barber blocked_slots (D9); owner admin_user (set-password flow, no plaintext password committed).
5. `src/lib/db/`: postgres.js client, typed query modules, migration runner script (`npm run db:migrate`, used by CI and locally; local dev DB via `docker compose up db`).
6. next-intl skeleton: locale routing `/{nl,en,fr}`, `messages/{nl,en,fr}.json` with `common` namespace, language switcher stub (FR-090..091).
7. CI (GitHub Actions): lint, typecheck, unit tests, build; spins up Postgres service container, runs migrations + seed from scratch.

**Acceptance criteria (all machine-checkable):**
- [ ] `npm run db:migrate && npm run db:seed` succeeds on a clean Postgres 16 container; second run is a no-op (idempotent runner).
- [ ] SQL checks pass: `btree_gist` installed; inserting two overlapping confirmed appointments for one barber raises the exclusion violation; `services` walk-in row has `is_walk_in=true, price_cents=0`; settings table returns the 5 seeded keys; FR columns exist and are non-empty for all 6 services.
- [ ] A barber can have two availability windows on the same weekday (split shift insert succeeds; overlapping windows rejected by app-level validation test).
- [ ] `npm run build` passes; `/nl`, `/en`, `/fr` render a placeholder home with translated string from messages files; `/` redirects per FR-090.
- [ ] CI green on the PR; no secrets in repo (`gitleaks` step clean).
- [ ] README documents: architecture (D1), how to run locally, migration workflow.

---

## Phase 2 — Booking engine (the Calendly replacement core)

**Scope:** availability engine + public booking flow + transactional emails. FR-010..034, FR-070..073.

1. `src/lib/services/availability.ts` (FR-010..019) with exhaustive unit tests: grid, buffer, lead time, horizon, blocks, split shifts, DST 2026-03-29 & 2026-10-25, no-preference assignment, first-available queries.
2. Slot API route(s) + booking transaction (FR-025, FR-018 race handling, integration-tested by concurrent inserts).
3. Booking UI steps 1–4 (FR-020..028) in all 3 locales, Kameraad house style, mobile-first.
4. Cancel/reschedule token pages (FR-030..034); window read live from settings (D4).
5. Resend + React Email: all 7 templates skeletons, copy drafted ×3 languages (FR-073); confirmation + .ics (FR-071); cancellation; reschedule. Domain verification documented for Ayat (DNS records listed in PR).
6. Vercel Cron route (30 min) dispatching reminder_24h / reminder_2h / rebooking with idempotency + skip rules (FA §7); unit-tested with a fake clock.

**Acceptance criteria:**
- [ ] Unit suite covers FR-011..019 incl. both 2026 DST dates; `vitest run` green in CI.
- [ ] Concurrency test: 10 parallel bookings of the same slot → exactly 1 success, 9 friendly conflicts (FR-018), 0 unhandled errors.
- [ ] Playwright E2E (against preview deploy + test DB): happy booking in nl/en/fr → confirmation page + `email_log` row + .ics attachment present (Resend test mode).
- [ ] E2E: cancel outside window blocked with explanation; inside window succeeds; reschedule moves appointment and old slot becomes bookable.
- [ ] Changing `cancellation_window_hours` in settings (SQL update) changes both enforcement and the step-4 checkbox copy without redeploy.
- [ ] Cron handler run twice over the same window produces zero duplicate `email_log` 'sent' rows.
- [ ] Booking created <2h before start receives confirmation but no 2h-reminder (skip rule proven by test).

**Staging milestone = end-to-end booking functional → invoice 2 (30%).**

---

## Phase 3 — Admin + CRM

**Scope:** FR-040..063, FA §6 matrix, GDPR FR-080..083.

1. Auth.js credentials + admin_users; invite/set-password + reset flows (FR-041..042); lockout (FR-043); 8h sliding session.
2. RBAC middleware + per-action checks generated from the FA §6.2 matrix; audit_log on privileged mutations (FR-044..045).
3. Calendars day/week/month (FR-046..049); booking management incl. manual booking, admin cancel/reschedule, no-show, complete (FR-050..053).
4. Availability + blocked-period editors incl. D10 conflict flow (FR-054..056).
5. CRM + GDPR delete + JSON export (FR-057..059); `gdpr_delete()` function (FR-080..082).
6. Services editor, banner editor, bulk email, statistics (FR-060..063).

**Acceptance criteria:**
- [ ] Playwright: barber login sees only own bookings' actions; visiting an owner-only route/action as barber → 403 (tested for: services editor, GDPR delete, bulk mail, settings, shop stats).
- [ ] E2E: owner creates a barber account → invite email → set password → login works; reset flow works; 6th failed login within 15 min locks the account.
- [ ] E2E GDPR: seed customer with appointments + email_log → owner purge with type-to-confirm → direct SQL scan finds zero rows containing the customer's email/name/phone (FR-081); audit_log has exactly one purge event without PII; deleting a customer ad-hoc via SQL is blocked by FK (FR-082).
- [ ] E2E: block period over an existing appointment triggers the conflict dialog; "cancel + notify" sends cancellation email; "keep" leaves appointment intact.
- [ ] E2E: no-show toggle only available after start time; increments customer counter.
- [ ] Banner edited in admin appears on public home within 60s without redeploy.
- [ ] Bulk marketing send to a test set respects `marketing_opt_in=false` exclusion (proven by email_log).

**Milestone: admin fully operational.**

---## Phase 4 — Public site, SEO, launch

**Scope:** FR-100..104, FR-102 redirects, performance, full E2E regression, launch.

1. Home (banner, barbers, services, slot preview FR-017b, CTA), services, about, contact, privacy policy ×3 locales.
2. SEO package FR-101; redirect map FR-102 (harvest current site URLs first); staging noindex / production index.
3. Performance pass to FR-103 budgets; accessibility FR-104.
4. Full Playwright regression suite as CI gate; UAT checklist for client; production launch runbook (Vercel domain cutover, Resend domain live, Railway backups verified); handover doc.

**Acceptance criteria:**
- [ ] Lighthouse CI (mobile): home + booking step 3 ≥ 90 perf, ≥ 95 SEO & a11y.
- [ ] `curl -I https://<preview>/afspraak-maken` → 301 to `/nl/boeken`; sitemap per locale valid XML; hreflang validated (incl. x-default); JSON-LD passes Google rich-results test schema validation.
- [ ] Full E2E suite green against production-like preview.
- [ ] UAT sign-off recorded → DNS cutover → post-launch smoke test → **invoice 3 (40%), retainer starts.**

---

## Standing guardrails (all phases)

- Branch per phase; conventional commits; PR template includes the phase's acceptance checklist.
- Agent asks blocking questions as PR comments, never improvises on spec gaps.
- Dev/staging secrets only (Railway dev DB, Resend test key). Production env vars are set by Ayat, never by the agent.
- Provisional client data (hours, service matrix, FR copy) stays flagged `-- PROVISIONAL` in code/seeds until client confirmation.
