# FUNCTIONAL ANALYSIS — Kameraad Haarsnijder Booking Platform

**Version:** 1.0 · 2026-06-05
**Status:** Build-ready. Single source of truth for the autonomous build agent. Where this document conflicts with FUNCTIONAL-SCOPE.md or OPEN-QUESTIONS.md, **this document wins** (changelog §14).
**Rule for the agent:** never guess. Every behaviour is specified here or in PHASES.md. If something is genuinely unspecified, stop and ask in the PR.

---

## 0. Resolved decisions (2026-06-05, Ayat)

| # | Decision | Resolution |
|---|----------|-----------|
| D1 | Architecture (OQ §9) | **Next.js 14 monolith with a strict internal service layer.** All business logic lives in `src/lib/services/*` as pure, framework-free TypeScript modules (no Next.js imports). Route handlers and server components are thin callers. Reuse for future clients = extract `lib/services` + `db/`, not a separate deployable. |
| D2 | i18n model (OQ §5) | **next-intl** with locale path prefixes `/nl` `/en` `/fr` (NL = default). UI strings in `messages/{nl,en,fr}.json`. DB content (services, barbers, editable content) gets `*_fr` columns. `customers.preferred_language` captured from the site locale at booking. |
| D3 | Admin permissions (OQ §7) | **Balanced preset** — full matrix in §6.2. |
| D4 | Cancellation window (OQ §11) | **Admin-configurable setting** `cancellation_window_hours`, default **24**, owner-editable in admin (valid 1–72). All copy that mentions the window renders the live value. Client to confirm final default at next meeting. |
| D5 | Buffer time (OQ §1.1) | Global setting `buffer_min`, default **0**. No per-barber/per-service override in v1. |
| D6 | Slot granularity (OQ §1.6) | **15-minute grid** for start times. A slot is offered if `[start, start + duration + buffer)` fits inside the barber's window minus blocks and appointments. |
| D7 | Lead time / horizon (OQ §1.7) | Settings: `min_lead_time_hours` default **2**; `booking_horizon_days` default **56**. |
| D8 | Split shifts (OQ §1.2) | Supported at DB level: replace `UNIQUE (barber_id, day_of_week)` with `UNIQUE (barber_id, day_of_week, start_time)`; slot engine unions all active windows. Admin UI offers max 2 windows/day in v1. |
| D9 | Holidays (OQ §1.4) | Manual via blocked periods, **plus** Belgian public holidays 2026–2027 seeded as all-barber blocks (deletable). |
| D10 | Absence vs existing bookings (OQ §1.5) | Creating a block that overlaps confirmed appointments shows the conflict list; admin chooses per conflict: keep, or cancel + email customer. Never silent. |
| D11 | Walk-in (OQ §1.8) | **Not bookable.** Shown as an info card (services page + booking step 2, non-selectable). Excluded from slot generation, calendars, and stats. |
| D12 | GDPR purge (OQ §4) | `gdpr_delete()` transaction: delete `email_log` rows → appointments → customer; write `audit_log` event (no PII). `email_log` rows are **deleted**, not redacted. Owner-only. §8. |
| D13 | Booking status (schema) | New bookings are `confirmed` immediately. No `pending` flow in v1. |
| D14 | No-show (OQ §8.2) | Manual toggle by barber (own) / owner (all), allowed only after slot start. No email. Increments `customers.no_show_count`, visible in CRM. No booking restrictions in v1. |
| D15 | Reminder offsets (OQ §3.1) | Fixed: 24h and 2h. Not admin-configurable in v1. |
| D16 | Rebooking interval (OQ §3.3) | Setting `rebooking_weeks`, default **5**, global. |
| D17 | Auth (OQ §14) | Auth.js (NextAuth v5) credentials provider + bcrypt. `admin_users` table. Owner seeds barber accounts → invite email with set-password token. Reset = same token flow. Sliding 8h session. **2FA out of scope v1.** |
| D18 | Customer portal (OQ §15) | Token-only, no customer accounts. Confirmed. |
| D19 | Statistics (OQ §12) | v1 metrics in §6.7. Revenue counts `completed` only. |
| D20 | Content editor (OQ §16) | v1 editable surface = **seasonal banner** only (title, text, active; per locale). `content` table. |
| D21 | E2E (OQ §17) | Playwright. Must-pass scenarios in PHASES.md per phase. |
| D22 | DB access | `postgres` (postgres.js) client + hand-written typed query modules in `src/lib/db/`. Raw SQL migrations in `db/migrations/`, run by script/CI. No ORM. |
| D23 | Invoice mapping (OQ §8.1) | 30% on Phase-1 acceptance, 30% on Phase-2 staging acceptance, 40% on production launch. **Provisional — confirm with client.** |

**Still requires the client (does NOT block build; provisional values are seeded and flagged):** real opening hours per barber (OQ §1.10), per-barber service matrix (OQ §2), final cancellation-window default, rebooking default, email copy approval, invoice mapping, outstanding historical costs (OQ §10).

---

## 1. Actors

| Actor | Auth | Description |
|-------|------|-------------|
| Visitor | none | Browses public site in NL/EN/FR. |
| Customer | tokenised links only | Books, cancels, reschedules via email links. No account (D18). Identity = unique email. |
| Barber | email + password | Admin access to own data per §6.2. Four seeded: Adil, Avraz, Simar, Bas. |
| Owner | email + password | Super admin. Everything in §6.2. |
| System | — | Cron-driven email dispatch, slot engine. |

---

## 2. Domain model (functional)

Entities and the business rules attached to them. (Schema details: TECHNICAL-BASELINE.md + migration 002 spec in PHASES.md Phase 1.)

- **Barber** — slug, name, bio (nl/en/fr), photo, active flag, sort order. FR-001: only `is_active` barbers appear publicly and accept bookings.
- **Service** — slug, name/description (nl/en/fr), `price_cents`, `duration_min`, colour, `is_walk_in`, active, sort. FR-002: only active, non-walk-in services are bookable. FR-003: service duration determines appointment length: `end_at = start_at + duration_min`.
- **BarberService** — which barber offers which service. FR-004: step 2 shows only services offered by the chosen barber; "no preference" shows the union. ⚠ Seeded all-do-all (provisional, OQ §2).
- **Availability** — per barber, per weekday, 1..n windows `start_time–end_time` (D8). Sunday closed by default.
- **BlockedSlot** — timestamp range, per barber or all (`barber_id NULL`), reason. Subtracted from availability.
- **Customer** — first/last name, unique email, phone, `preferred_language` (D2), opt-in flags (`reminder` default true, `rebooking` default true, `marketing` default false), `no_show_count`, `consent_given_at`, `unsubscribe_token`, internal notes. FR-005: booking with a known email updates that customer (name/phone/language refreshed), never duplicates.
- **Appointment** — barber, service, customer, `[start_at, end_at)`, status (`confirmed|cancelled|no_show|completed`), customer notes, admin notes, `cancel_token`, `reschedule_token`, cancellation metadata. FR-006: the DB exclusion constraint rejects overlapping non-cancelled appointments for the same barber — this is the final authority on double booking.
- **EmailLog** — every send: type, appointment, customer, to, subject, status. FR-007: at most one successful send per (appointment, email_type) for automated types.
- **Setting** — key/value (jsonb): `cancellation_window_hours` 24 · `buffer_min` 0 · `min_lead_time_hours` 2 · `booking_horizon_days` 56 · `rebooking_weeks` 5. FR-008: all five are read at run time (no redeploy to change), owner-editable, validated server-side.
- **AuditLog** — GDPR deletion events (§8) and setting changes: actor, action, timestamp, non-PII payload.
- **AdminUser** — email, bcrypt hash, role `owner|barber`, optional `barber_id`, set-password token + expiry.
- **Content** — editable banner per locale (D20).

---

## 3. Availability & slot engine

The core algorithm. Pure function in `src/lib/services/availability.ts`.

**Inputs:** barber (or "any"), service, date range, now().
**Sources:** availability windows, blocked slots, non-cancelled appointments, settings.

FR-010: All computation in **Europe/Brussels**; API returns UTC instants + local labels.
FR-011: Candidate starts = every 15-min grid point (`:00 :15 :30 :45`) within each availability window of that weekday.
FR-012: A candidate is offered iff `[start, start + duration + buffer)` fits entirely within the window AND overlaps no blocked slot AND overlaps no non-cancelled appointment. (Buffer extends occupancy, not the customer-visible end time.)
FR-013: Candidates earlier than `now() + min_lead_time_hours` are not offered.
FR-014: Candidates beyond `today + booking_horizon_days` are not offered; date pickers cap there.
FR-015 (DST): on spring-forward, non-existent local times are not emitted; on fall-back, each local time is offered once (first occurrence). Unit tests must cover the 2026 transition dates (29 Mar, 25 Oct).
FR-016 ("no preference"): a slot is offered if ≥1 barber offering that service is free; on booking, assignment goes to the free barber with the **fewest appointments that day** (tie → `sort_order`). The customer sees the assigned barber before confirming (step 4) and in all emails.
FR-017 (first available): API exposes (a) first slot for barber+service, (b) per-day earliest slot across barbers for a service — powers the homepage preview.
FR-018 (race): two customers may see the same slot; the loser's insert hits the exclusion constraint and gets a friendly "slot just taken" + refreshed slots. Never a 500.
FR-019: Walk-in is excluded from all slot computation (D11).

---

## 4. Booking flow (public, 4 steps)

URL: `/{locale}/boeken` (`/book`, `/reserver`). State preserved across back-navigation (FR-027).

- **Step 1 — Barber.** Active barbers (photo, name, localized bio) + "No preference" (FR-016). FR-020: barber pre-selectable via query param (deep link from barber profile).
- **Step 2 — Service.** Services per FR-004 with localized name/description, price (€, from cents), duration. Walk-in info card per D11.
- **Step 3 — Slot.** Day navigator (cap FR-014). Per day: offered slots (FR-011..016). FR-021: empty day shows "no slots" + next available day shortcut. FR-022: homepage slot-preview click lands here with barber/service preselected.
- **Step 4 — Details + confirm.** Fields: first name*, last name*, email* (RFC format), phone* (E.164 or BE format), optional customer note (≤500 chars). Checkboxes (both required, unticked by default):
  - FR-023: cancellation-policy consent — text renders live `cancellation_window_hours` (D4).
  - FR-024: privacy consent — sets `consent_given_at`; links privacy policy.
  - FR-025 (server, transactional): re-validate slot → upsert customer by email (set `preferred_language` = UI locale) → insert appointment `confirmed` → send confirmation email. On exclusion-constraint failure → FR-018 path.
  - FR-026: confirmation screen shows summary + "manage via the email we sent".

**Validation** (FR-028): client + server (zod, shared schemas); server is authoritative; localized messages.

---

## 5. Cancel / reschedule (customer)

- FR-030: `/{locale}/afspraak/annuleren/{cancel_token}` shows appointment + Cancel button when `now() < start_at − window`; otherwise an explanation + shop phone number. (window = setting, D4)
- FR-031: cancel sets status `cancelled` + `cancelled_at` + reason "customer", frees the slot (constraint ignores cancelled), sends cancellation email. Idempotent: re-visiting shows "already cancelled".
- FR-032: reschedule link → slot picker (same engine, same barber+service) → atomic move (old slot freed, new occupied) → reschedule email with **same tokens** kept valid. Window rule applies to the **original** start time.
- FR-033: invalid/unknown token → neutral 404 ("link invalid or expired"), no data leakage.
- FR-034: all policy enforcement is server-side; UI hiding is convenience only.

---

## 6. Admin (`/admin`, NL-only UI in v1)

### 6.1 Auth
FR-040: Auth.js credentials; bcrypt (cost ≥ 12); sliding 8h session expiry. FR-041: owner creates barber accounts → invite email with set-password link (token valid 48h, single-use). FR-042: "forgot password" = same flow (token 2h). FR-043: 5 failed logins / 15 min / account → 15-min lockout (constant-time response).

### 6.2 Permission matrix (D3 — Balanced)

| Capability | Owner | Barber |
|---|---|---|
| Own calendar (day/week/month) + own bookings (reschedule, cancel, notes, no-show, complete) | ✅ | ✅ |
| View other barbers' calendars | ✅ | 👁 read-only |
| Edit own opening hours + own blocked periods | ✅ | ✅ |
| Edit others' hours / all-barber blocks | ✅ | ❌ |
| Customer CRM: search, view, edit, notes | ✅ | ✅ |
| GDPR permanent delete | ✅ | ❌ |
| Services & prices editor | ✅ | ❌ |
| Bulk/marketing email | ✅ | ❌ |
| Statistics: own bookings/no-shows | ✅ | ✅ |
| Statistics: shop-wide + revenue | ✅ | ❌ |
| Content (banner) editor | ✅ | ❌ |
| Settings (§2 keys) + admin-user management | ✅ | ❌ |

FR-044: enforced server-side on every route/action (middleware + per-handler check); UI additionally hides what the role lacks. FR-045: every privileged mutation (delete, settings change, bulk send) writes `audit_log`.

### 6.3 Calendars
FR-046 Day: hourly timeline 1 column/barber (owner: all, toggleable; barber: own + read-only others per matrix), appointments colour-coded by service, click → detail drawer (customer, contact, notes, actions per matrix). Blocked periods rendered distinctly.
FR-047 Week: 7-day grid, same rules.
FR-048 Month: per-day counts; click → day view.
FR-049: calendars show `confirmed|completed|no_show`; cancelled visible via a filter toggle, default off.

### 6.4 Bookings management
FR-050: admin reschedule = same engine, may override **lead time** but never overlap (constraint). FR-051: admin cancel ignores the customer window; optional "notify customer" toggle (default on) sends cancellation email; reason saved. FR-052: walk-in/phone customers can be added as manual bookings (same validation; email optional — if absent, no emails and customer record flagged `email_missing=false`… see PHASES Phase 3 note: manual bookings allow a customer without email; such customers are excluded from all email dispatch).
FR-053: `no_show` per D14; `completed` settable after start (manual in v1; no auto-complete).

### 6.5 Availability management
FR-054: weekly hours editor per barber (≤2 windows/day, D8) with validation (no overlap, start<end). FR-055: blocked periods (single barber or all) with conflict handling per D10. FR-056: changes affect future slot generation immediately; existing appointments are untouched except via D10 flow.

### 6.6 CRM + GDPR
FR-057: customer list = `v_customers_overview` (search by name/email/phone; sort by last visit). Detail: contact, language, opt-ins, no-show count, notes, appointment history.
FR-058: GDPR delete (owner-only): type-to-confirm ("VERWIJDER"), executes §8, success message "Alle gegevens permanent verwijderd".
FR-059: data export (GDPR access request): owner can download a JSON of one customer's stored data.

### 6.7 Statistics (v1, D19)
FR-060: ranges day/week/month/custom; metrics: bookings count, completed, cancelled, no-shows, revenue (= Σ `price_cents` of `completed`); breakdown per barber and per service. Role scope per matrix. No charts required in v1 — tables/tiles suffice.

### 6.8 Services, content, bulk mail
FR-061: services editor — names/descriptions per locale, price, duration, colour, active, sort. Duration changes affect only future bookings.
FR-062: banner editor per D20 — per-locale title/text + one active flag; public homepage reflects within 60s (no redeploy).
FR-063: bulk email — recipient filter (all / `marketing_opt_in` only — for `marketing` type the opt-in filter is **forced**), per-locale subject/body, test-send to self, send logs to `email_log` per recipient, throttled to Resend limits.

---

## 7. Emails (7 types)

Sender: `afspraak@kameraadhaarsnijder.be` (Resend, domain verified — SPF/DKIM; setup task in PHASES Phase 2). Templates: React Email, house style, language = `customers.preferred_language` (fallback NL). All sends logged (FR-007).

| Type | Trigger (exact) | Skip rules | Extra |
|---|---|---|---|
| confirmation | tx commit of new booking (FR-025) | never | .ics attached |
| reminder_24h | cron: `start_at − 24h ≤ now < start_at` and not yet sent | `reminder_opt_in=false`; booking created after T−24h; status ≠ confirmed | route link |
| reminder_2h | cron: `start_at − 2h ≤ now < start_at` and not yet sent | same pattern | |
| cancellation | status → cancelled (either party) | suppressed only when admin unticks notify (FR-051) | rebook link |
| reschedule | successful reschedule | never | updated .ics |
| rebooking | cron: `rebooking_weeks` after a `completed` appointment, once | `rebooking_opt_in=false`; customer has a future booking | booking link |
| marketing | manual (FR-063) | `marketing_opt_in=false` forced | unsubscribe |

FR-070: cron runs every 30 min (Vercel Cron) and is **idempotent** — a unique partial index on `email_log (appointment_id, email_type) WHERE status='sent'` guards duplicates; rebooking guarded per appointment.
FR-071 (.ics): `METHOD:REQUEST`, stable `UID` = appointment id, organizer = sender, `LOCATION` = shop address, `VTIMEZONE` Europe/Brussels. Reschedule re-sends same UID + bumped `SEQUENCE`; a cancellation sends `METHOD:CANCEL`.
FR-072 (unsubscribe): every optional email footers a one-click link `/{locale}/voorkeuren/{unsubscribe_token}` → preferences page with the 3 opt-in toggles; the link's source type is pre-toggled off. Marketing mails also carry `List-Unsubscribe` header.
FR-073: email copy NL/EN/FR — the agent drafts all 7×3 (subject + body) in Phase 2 from the content matrix; client reviews at staging. Copy lives in the i18n message files.

---

## 8. GDPR purge (D12)

FR-080: `gdpr_delete(customer_id, actor)` — single transaction:
1. `DELETE FROM email_log WHERE customer_id = $1 OR appointment_id IN (SELECT id FROM appointments WHERE customer_id = $1)`
2. `DELETE FROM appointments WHERE customer_id = $1`
3. `DELETE FROM customers WHERE id = $1`
4. `INSERT INTO audit_log(actor, action, payload)` → `('gdpr_delete', {customer_id_hash, counts})` — no names/emails/phones.

FR-081: after commit, zero rows in any table contain the customer's email, name, or phone (E2E-verified by direct DB scan). FR-082: schema 002 sets `appointments.customer_id ON DELETE RESTRICT` intentionally — only the function deletes, never ad-hoc cascades. FR-083: owner-only (matrix) + type-to-confirm (FR-058).
Data residency: Railway EU (pin `europe-west` region at provisioning); daily Railway backups, 7-day retention (OQ §13 default — confirm).

---

## 9. i18n (D2)

FR-090: locales `nl` (default), `en`, `fr`; routing `/{locale}/…`; bare `/` 302s to best match (Accept-Language, fallback nl).
FR-091: all UI strings via next-intl keys — no hardcoded copy in components (lint-guarded). Namespaces: `common`, `home`, `booking`, `emails`, `admin`(v1 NL but still keyed), `legal`.
FR-092: DB-localized fields resolve nl/en/fr with NL fallback when a translation is empty.
FR-093: language switcher preserves the current page; booking locale → `preferred_language` (FR-025).
FR-094: seeded FR content for services/barbers is **agent-drafted**, flagged for client review (same status as email copy).

---

## 10. Public site & SEO

Pages ×3 locales: home, services, about, contact, booking flow, privacy policy, manage-appointment pages.
FR-100 home: seasonal banner (when active), barber showcase, services + prices, **next-available-slots preview** (FR-017b; clickable → FR-022), Book-Now CTA, footer (address, privacy link; no socials).
FR-101 SEO: per-locale XML sitemap; `hreflang` incl. `x-default`(nl); per-page localized title/meta/canonical/OG; `LocalBusiness`/`HairSalon` JSON-LD (name, address, hours from DB, priceRange); `robots.txt`; staging/preview = `noindex`.
FR-102: 301 redirect map from the current Webflow URLs (at minimum `/afspraak-maken` → `/nl/boeken`; full list harvested from the live site's sitemap in Phase 4).
FR-103 performance: Lighthouse ≥ 90 performance & ≥ 95 accessibility & SEO on home + booking steps (mobile); images via `next/image`; LCP < 2.5s on 4G.
FR-104: mobile-first; usable from 360px; WCAG 2.1 AA basics (focus states, contrast, labels).

---

## 11. Non-functional

FR-110: slot API p95 < 300ms for a 7-day window (warm). FR-111: all forms double-submit-safe. FR-112: errors logged server-side with request id; customer sees localized friendly errors, never stack traces. FR-113: secrets only via env; `.env.example` maintained; no secrets in repo/logs. FR-114: browsers = last 2 versions evergreen + iOS Safari ≥ 16.

---

## 12. Out of scope v1

Online payment/deposits · customer accounts/portal · 2FA · custom intake questions · webhooks · drag-to-reschedule (v2) · social links · per-barber/per-service buffers · admin-configurable reminder offsets · auto no-show · multi-shop.

---

## 13. Glossary

**Window** availability interval of a weekday · **Block** blocked_slots row · **Slot** offered start time (FR-012) · **Purge** FR-080 transaction · **Horizon** booking_horizon_days · **Token link** cancel/reschedule/unsubscribe URL.

---

## 14. Changelog vs sources

1. Cancellation window: fixed 24h → **setting** (D4, per Ayat "flexible, even 1h").
2. Availability UNIQUE constraint relaxed for split shifts (D8).
3. `pending` status unused (D13).
4. Walk-in declared non-bookable (D11) — supersedes its presence in the bookable list.
5. Belgian holidays seeded (D9) — supersedes "manual only".
6. 30/30/40 mapped to phase gates (D23, provisional).
7. Email copy + FR translations: agent-drafted, client-reviewed (FR-073, FR-094) — were "missing/blocking", now build tasks.
8. Reminder = 24h + 2h fixed (D15); the "T-1h, admin-configurable" POC variant is dead.
