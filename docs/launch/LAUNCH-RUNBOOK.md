# Kameraad Haarsnijder — Production Launch Runbook

> **Status:** WRITTEN, NOT EXECUTED. This runbook is the step-by-step plan for going
> live. The autonomous build agent does **not** perform any launch step (no DNS
> changes, no domain cutover, no production deploy). Ayat (owner) executes these
> steps once the prerequisites below are stood up. Every value marked
> `<PROVISIONAL>` must be confirmed before launch.

## 0. Prerequisites Ayat must provide / stand up first

| # | Item | Why | Status |
|---|------|-----|--------|
| 1 | **Vercel Pro project** linked to the GitHub repo `ayatio/kameraad-booking`, production branch = `main` | Hosting + preview deploys + Vercel Cron | ☐ |
| 2 | **Production PostgreSQL** (Railway EU `europe-west`, or Vercel Postgres EU) with `DATABASE_URL` | App data; EU data residency (FR-080 / GDPR) | ☐ |
| 3 | **Resend account** + **verified sending domain** `kameraadhaarsnijder.be` (SPF, DKIM, DMARC DNS records) + `RESEND_API_KEY` | Transactional + marketing email (FR-070..073, FR-063) | ☐ |
| 4 | **Domain** `kameraadhaarsnijder.be` DNS access (registrar / current Webflow DNS) | Cutover to Vercel | ☐ |
| 5 | **AUTH_SECRET** (`openssl rand -base64 32`) set in Vercel production env | Admin session signing (FR-040) | ☐ |
| 6 | **CRON_SECRET** set in Vercel + referenced by the Vercel Cron job header | Protect `/api/cron/dispatch` | ☐ |
| 7 | **Design Gate C sign-off** (public pages) recorded in the Phase-4 PR | No public UI ships before its gate (PHASES gate rule) | ☐ |
| 8 | **Real client content**: confirmed opening hours per barber, barber–service matrix, service names/prices, about/contact copy, FR/ES/LE translation review | Replace all `PROVISIONAL`/`DRAFT` data | ☐ |
| 9 | Confirmed **owner login email** + first password set via the invite flow | Admin access (Phase 3) | ☐ |

## 1. Environment variables (Vercel → Project → Settings → Environment Variables, Production)

```
DATABASE_URL              = <production Postgres URL>           # EU region
AUTH_SECRET               = <openssl rand -base64 32>
RESEND_API_KEY            = <Resend live key>
CRON_SECRET               = <random secret, also in vercel.json cron header>
APP_BASE_URL              = https://kameraadhaarsnijder.be
NEXT_PUBLIC_SITE_URL      = https://kameraadhaarsnijder.be
NEXT_PUBLIC_ALLOW_INDEXING= true        # FLIP TO true ONLY at go-live; default/staging = unset (noindex)
```
Staging/preview deployments leave `NEXT_PUBLIC_ALLOW_INDEXING` **unset** → `robots` noindex (FR-101). Production sets it `true` so the site is indexable. **Do not enable indexing on previews.**

## 2. Database migration + seed (production, one-time)

1. Point `DATABASE_URL` at the production DB (locally, via a secure shell, or a Vercel one-off).
2. `npm run db:migrate` → applies `001..004` (idempotent; second run prints "No pending migrations").
3. `npm run db:seed` → seeds barbers, services, settings, Belgian holidays, owner+barber admin invite rows (idempotent).
4. Replace **all PROVISIONAL data** with the confirmed client values (hours, matrix, prices, copy) via the admin UI or a content migration **before** indexing is enabled.
5. Verify: `SELECT key,value FROM settings;` returns the 5 keys; `SELECT count(*) FROM barbers WHERE is_active;` = 4; the owner `admin_users` row exists.

## 3. Resend domain verification

1. In Resend, add domain `kameraadhaarsnijder.be`; copy the SPF, DKIM, and (recommended) DMARC records into DNS.
2. Wait for Resend to report **Verified**.
3. Confirm sender `afspraak@kameraadhaarsnijder.be` (FR-073) is authorised.
4. Send a test booking in production → confirm the confirmation email + `.ics` arrives and `email_log` shows `status='sent'`.
5. Until verified, the app falls back to the dry-run transport (logs only, no delivery).

## 4. Vercel Cron (email dispatch, FR-070)

1. `vercel.json` already declares the `*/30 * * * *` cron hitting `/api/cron/dispatch`.
2. Ensure the cron request carries `Authorization: Bearer <CRON_SECRET>` (Vercel Cron → project setting) matching the env `CRON_SECRET`.
3. After first deploy, confirm a cron invocation runs idempotently (no duplicate `email_log` 'sent' rows).

## 5. Pre-cutover (staging on the Vercel domain)

1. Deploy `develop` (or the release branch) to a Vercel preview; keep `NEXT_PUBLIC_ALLOW_INDEXING` unset (noindex).
2. Run the **UAT checklist** (`docs/launch/UAT-CHECKLIST.md`) against the preview with the production DB clone or a staging DB.
3. Confirm Lighthouse mobile budgets on the preview (home + booking step 3): ≥90 perf, ≥95 SEO & a11y (FR-103).
4. Record UAT sign-off in the PR / project tracker.

## 6. DNS cutover (go-live)

1. **Lower DNS TTL** on the current `kameraadhaarsnijder.be` records to 300s **at least 24–48h before** cutover (so the switch propagates fast).
2. In Vercel, add the production domain `kameraadhaarsnijder.be` (+ `www`) to the project.
3. Update DNS at the registrar to Vercel's targets (A/ALIAS/CNAME per Vercel's instructions). Keep the old Webflow records noted for rollback.
4. Wait for Vercel to issue the TLS certificate (automatic).
5. Set `NEXT_PUBLIC_ALLOW_INDEXING=true` in production and redeploy → site becomes indexable.
6. Verify the legacy redirects resolve on the live domain (e.g. `curl -I https://kameraadhaarsnijder.be/afspraak-maken` → 301 `/nl/boeken`).

## 7. Post-cutover smoke test (production)

- [ ] `https://kameraadhaarsnijder.be/` → 302 to best-locale home; `/nl` renders.
- [ ] Home shows barbers, services, next-slot preview; Book CTA → `/nl/boeken`.
- [ ] Complete a real booking → confirmation email + `.ics` received; `email_log` 'sent'.
- [ ] Cancel + reschedule via the email links work; window enforced.
- [ ] `/sitemap.xml` + `/robots.txt` correct; robots now **allows** indexing; hreflang present.
- [ ] JSON-LD validates in Google Rich Results Test.
- [ ] Admin login works; calendar shows the test booking; GDPR export/purge work.
- [ ] Legacy redirects 301 correctly on the live domain.

## 8. Backups (Railway/Postgres)

1. Enable **daily automated backups**, 7-day retention (OQ §13 default — confirm with client).
2. Verify a backup exists and **test a restore** to a throwaway DB before relying on it.
3. Document the restore procedure (provider console → restore snapshot → repoint `DATABASE_URL`).

## 9. Rollback plan

| Failure | Rollback |
|---------|----------|
| Bad deploy | Vercel → Deployments → **Promote** the previous good deployment (instant). |
| DNS/cutover problem | Revert DNS records to the **previous Webflow targets** (kept in step 6.3); low TTL makes this fast. |
| Email broken | App auto-falls back to dry-run if `RESEND_API_KEY` is removed; fix DNS/domain then restore the key. |
| DB corruption | Restore the latest verified backup (step 8) and repoint `DATABASE_URL`. |
| Indexing enabled too early | Set `NEXT_PUBLIC_ALLOW_INDEXING` unset + redeploy → noindex; submit removal in Search Console if needed. |

## 10. Invoicing (D23, provisional)

Production launch + UAT sign-off triggers **invoice 3 (40%)** and starts the retainer (per PHASES D23 — confirm mapping with client).

---
*All hard-coded shop data in this runbook (address, phone, BTW, hours) is `<PROVISIONAL>` pending client confirmation.*
