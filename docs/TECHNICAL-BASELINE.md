# TECHNICAL BASELINE — Kameraad Haarsnijder

**Compiled:** 2026-06-05
**Scope:** every technical decision made so far, the full database schema and seed (reproduced verbatim from the build thread), architecture notes, CI/CD, infrastructure, and known technical gaps an autonomous agent must resolve.

---

## 1. Tech stack

| Layer | Choice | Notes |
|-------|--------|-------|
| Framework | **Next.js 14** | App Router assumed; API routes in-app (see §2 architecture caveat). |
| Styling | **Tailwind CSS** | Kameraad dark/gold house style (established in the HTML POC). |
| Database | **PostgreSQL on Railway (EU region)** | **Supersedes Supabase**, which Claude initially recommended and which still appears in the commercial quote's infra table. |
| Email | **Resend** + **React Email** | Transactional + marketing; templates in Kameraad style; trilingual. |
| Hosting | **Vercel** | Hobby/free tier sufficient at launch. |
| Scheduled jobs | **Vercel Cron** | Checks every 30 min for due reminders (`reminder_24h`, `reminder_2h`) and rebooking emails. |
| CI/CD | **GitHub Actions** | See §5. |
| Repo | `kameraad-booking` (private GitHub repo) | |
| Domain | `kameraadhaarsnijder.be` | Already owned by client. |

Infra cost at launch (from the quote): Vercel €0, Resend €0 (free tier ~3,000 mails/month), domain already owned → **≈ €0/month** operationally. (The quote's printed comparison: Calendly Teams ≈ €16–20/user/month ≈ €80/month for 4 barbers.)

---

## 2. Architecture

**Stated intent (chat C, "Decoupling website and backend with serverless APIs"):** a decoupled three-layer architecture — **frontend / API layer / data layer** — using Next.js, serverless functions, and Postgres, with **reusability and separation of concerns** as first-class goals so the booking app could be reused across contexts.

**Caveat:** that conversation **ended before any final architectural decision was reached.** The implementation actually scaffolded (single Next.js app + Railway Postgres, with the availability API to live in the Next.js app) is closer to a **Next.js monolith** than a separately deployable API service. Whether the "decoupled, reusable API layer" is a hard requirement (separate service / package boundary) or is satisfied by clean internal API routes is **unresolved** (OPEN-QUESTIONS §9).

Planned project structure (from the README; partial):
```
/ (kameraad-booking)
├── db/
│   ├── migrations/001_initial_schema.sql
│   └── seeds/001_seed_data.sql
├── .github/
│   ├── workflows/ci-cd.yml
│   ├── workflows/migrate.yml
│   └── CICD_SETUP.md
├── lib/db.ts                  (planned)
├── .env.example               (committed)
├── next.config.ts             (planned)
├── package.json
└── README.md
```

Planned next build steps (not started): `package.json` + `next.config.ts` + Tailwind config → `lib/db.ts` (DB client) → TypeScript types generated from the schema → **the availability API (slot calculation)** first, as the hardest and most foundational logic.

---

## 3. Database schema (reproduced from `db/migrations/001_initial_schema.sql`)

> Reproduced as written, including the original Dutch comments. Known issues are flagged with ⚠ and detailed in §6 / OPEN-QUESTIONS.

```sql
-- ============================================================
-- KAMERAAD HAARSNIJDER — DATABASE SCHEMA
-- Migration: 001_initial_schema
-- DB: PostgreSQL (Railway)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ────────────────────────────────────────────────────────────
-- BARBIERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE barbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,          -- 'adil', 'avraz', 'simar', 'bas'
  name          TEXT NOT NULL,
  bio_nl        TEXT,
  bio_en        TEXT,                          -- ⚠ no bio_fr (FR is required)
  photo_url     TEXT,
  email         TEXT UNIQUE,                   -- login email voor admin
  is_active     BOOLEAN NOT NULL DEFAULT true,
  sort_order    INT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- SERVICES
-- ────────────────────────────────────────────────────────────
CREATE TABLE services (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT UNIQUE NOT NULL,        -- 'haircut', 'haircut-beard', etc.
  name_nl         TEXT NOT NULL,
  name_en         TEXT NOT NULL,               -- ⚠ no name_fr / description_fr
  description_nl  TEXT,
  description_en  TEXT,
  price_cents     INT NOT NULL,                -- prijs in eurocent (4000 = €40)
  duration_min    INT NOT NULL,                -- duur in minuten
  color           TEXT NOT NULL DEFAULT '#C9962A', -- kleur in agenda
  is_active       BOOLEAN NOT NULL DEFAULT true,
  is_walk_in      BOOLEAN NOT NULL DEFAULT false,  -- walk-in = geen tijdslot nodig
  sort_order      INT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ────────────────────────────────────────────────────────────
-- KOPPELING: welke barbier biedt welke service aan
-- ────────────────────────────────────────────────────────────
CREATE TABLE barber_services (
  barber_id   UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  service_id  UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  PRIMARY KEY (barber_id, service_id)
);

-- ────────────────────────────────────────────────────────────
-- BESCHIKBAARHEID PER BARBIER (wekelijks schema)
-- day_of_week: 0=zondag, 1=maandag ... 6=zaterdag
-- ────────────────────────────────────────────────────────────
CREATE TABLE availability (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id     UUID NOT NULL REFERENCES barbers(id) ON DELETE CASCADE,
  day_of_week   SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time    TIME NOT NULL,                 -- bijv. '09:00'
  end_time      TIME NOT NULL,                 -- bijv. '18:00'
  is_active     BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (barber_id, day_of_week)              -- ⚠ one row per weekday → no split shifts
);

-- ────────────────────────────────────────────────────────────
-- GEBLOKKEERDE PERIODES (vakantie, feestdag, pauze)
-- ────────────────────────────────────────────────────────────
CREATE TABLE blocked_slots (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id   UUID REFERENCES barbers(id) ON DELETE CASCADE, -- NULL = alle barbiers
  start_at    TIMESTAMPTZ NOT NULL,
  end_at      TIMESTAMPTZ NOT NULL,
  reason      TEXT,                            -- 'Vakantie', 'Feestdag', 'Pauze'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at)
);

-- ────────────────────────────────────────────────────────────
-- KLANTEN
-- ────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name          TEXT NOT NULL,
  last_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,
  notes               TEXT,                    -- interne notities (admin)
  marketing_opt_in    BOOLEAN NOT NULL DEFAULT false,
  rebooking_opt_in    BOOLEAN NOT NULL DEFAULT true,
  reminder_opt_in     BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- soft uniek: zelfde email = zelfde klant
  UNIQUE (email)
  -- ⚠ no preferred_language/locale column (emails are "per customer preference")
  -- ⚠ no consent_given_at timestamp despite consent checkbox at booking
);

-- ────────────────────────────────────────────────────────────
-- AFSPRAKEN
-- ────────────────────────────────────────────────────────────
CREATE TYPE appointment_status AS ENUM (
  'pending',      -- net geboekt, wacht op bevestiging (optioneel)
  'confirmed',    -- bevestigd
  'cancelled',    -- geannuleerd door klant
  'no_show',      -- niet komen opdagen
  'completed'     -- afgewerkt
);

CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id           UUID NOT NULL REFERENCES barbers(id),
  service_id          UUID NOT NULL REFERENCES services(id),
  customer_id         UUID NOT NULL REFERENCES customers(id),   -- ⚠ no ON DELETE rule (blocks GDPR cascade)
  start_at            TIMESTAMPTZ NOT NULL,
  end_at              TIMESTAMPTZ NOT NULL,
  status              appointment_status NOT NULL DEFAULT 'confirmed',
  customer_notes      TEXT,                    -- notities van klant bij boeking
  admin_notes         TEXT,                    -- interne notities admin
  cancel_token        TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  reschedule_token    TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (end_at > start_at),

  -- voorkom dubbele boekingen: zelfde barbier mag geen overlappende afspraken hebben
  EXCLUDE USING gist (
    barber_id WITH =,
    tstzrange(start_at, end_at) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

-- Index voor snelle beschikbaarheidsquery's
CREATE INDEX idx_appointments_barber_time
  ON appointments (barber_id, start_at, end_at)
  WHERE status NOT IN ('cancelled');

CREATE INDEX idx_appointments_start_at        ON appointments (start_at);
CREATE INDEX idx_appointments_customer        ON appointments (customer_id);
CREATE INDEX idx_appointments_cancel_token    ON appointments (cancel_token);
CREATE INDEX idx_appointments_reschedule_token ON appointments (reschedule_token);

-- ────────────────────────────────────────────────────────────
-- E-MAIL LOG
-- ────────────────────────────────────────────────────────────
CREATE TYPE email_type AS ENUM (
  'confirmation',     -- bevestiging direct na boeking
  'reminder_24h',     -- herinnering 24u voor
  'reminder_2h',      -- herinnering 2u voor
  'cancellation',     -- annulering bevestiging
  'reschedule',       -- verzet bevestiging
  'rebooking',        -- follow-up na X weken
  'marketing'         -- promotionele mail
);

CREATE TABLE email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id  UUID REFERENCES appointments(id) ON DELETE SET NULL,
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,  -- ⚠ keeps row on delete
  email_type      email_type NOT NULL,
  to_email        TEXT NOT NULL,               -- ⚠ raw email retained after customer hard-delete
  subject         TEXT NOT NULL,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  status          TEXT NOT NULL DEFAULT 'sent',  -- 'sent', 'failed', 'bounced'
  error_message   TEXT
);

CREATE INDEX idx_email_log_appointment ON email_log (appointment_id);
CREATE INDEX idx_email_log_customer    ON email_log (customer_id);

-- ────────────────────────────────────────────────────────────
-- AUTO-UPDATE updated_at
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trg_appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- HANDIGE VIEWS
-- ────────────────────────────────────────────────────────────

-- Volledige afspraakdetails voor de agenda
CREATE VIEW v_appointments_detail AS
SELECT
  a.id,
  a.start_at,
  a.end_at,
  a.status,
  a.customer_notes,
  a.admin_notes,
  a.cancel_token,
  a.reschedule_token,
  a.created_at,
  -- Barbier
  b.id          AS barber_id,
  b.name        AS barber_name,
  b.slug        AS barber_slug,
  b.photo_url   AS barber_photo,
  -- Service
  s.id          AS service_id,
  s.name_nl     AS service_name_nl,
  s.name_en     AS service_name_en,
  s.price_cents AS service_price_cents,
  s.duration_min AS service_duration_min,
  s.color       AS service_color,
  -- Klant
  c.id          AS customer_id,
  c.first_name  AS customer_first_name,
  c.last_name   AS customer_last_name,
  c.email       AS customer_email,
  c.phone       AS customer_phone
FROM appointments a
JOIN barbers  b ON b.id = a.barber_id
JOIN services s ON s.id = a.service_id
JOIN customers c ON c.id = a.customer_id;

-- Klantoverzicht met laatste bezoek
CREATE VIEW v_customers_overview AS
SELECT
  c.*,
  COUNT(a.id)                                 AS total_appointments,
  MAX(a.start_at)                             AS last_appointment_at,
  MIN(a.start_at)                             AS first_appointment_at,
  SUM(CASE WHEN a.status = 'completed' THEN s.price_cents ELSE 0 END) AS total_spent_cents
FROM customers c
LEFT JOIN appointments a ON a.customer_id = c.id AND a.status != 'cancelled'
LEFT JOIN services s ON s.id = a.service_id
GROUP BY c.id;
```

### Schema design highlights
- **Double-booking prevention is enforced in the database** via `EXCLUDE USING gist (barber_id WITH =, tstzrange(start_at, end_at) WITH &&)` on non-cancelled appointments. (Requires the `btree_gist` extension for the equality operator on `barber_id` — verify it is enabled on Railway; only `pgcrypto` is explicitly created in the migration. ⚠)
- **Tokenised links**: `cancel_token` / `reschedule_token` are random 32-byte hex, unique, indexed — used for login-free customer actions.
- **Money** stored as integer cents (`price_cents`).
- **Soft customer identity**: `customers.email` is unique → repeat customers are matched by email.

---

## 4. Seed data (reproduced from `db/seeds/001_seed_data.sql`)

```sql
-- ============================================================
-- KAMERAAD — SEED DATA  (run AFTER the migration)
-- ============================================================

-- BARBIERS
INSERT INTO barbers (slug, name, bio_nl, bio_en, email, sort_order) VALUES
  ('adil',  'Adil',  'Gepassioneerde barbier met oog voor detail.', 'Passionate barber with an eye for detail.',  'adil@kameraadhaarsnijder.be',  1),
  ('avraz', 'Avraz', 'Specialist in klassieke technieken en moderne stijlen.', 'Specialist in classic techniques and modern styles.', 'avraz@kameraadhaarsnijder.be', 2),
  ('simar', 'Simar', 'Jouw go-to voor scherpe lijnen en perfecte afwerking.', 'Your go-to for sharp lines and perfect finishing.', 'simar@kameraadhaarsnijder.be', 3),
  ('bas',   'Bas',   'Expert in baard styling en hot towel treatments.', 'Expert in beard styling and hot towel treatments.',   'bas@kameraadhaarsnijder.be',   4);

-- SERVICES
INSERT INTO services (slug, name_nl, name_en, description_nl, description_en, price_cents, duration_min, color, sort_order) VALUES
  ('haircut',
   'Haarsnit / Haircut', 'Haircut',
   'Een gepersonaliseerde haarsnit, afgestemd op jouw stijl en gezichtsvorm. Inclusief finishing.',
   'A personalised haircut tailored to your style and face shape. Includes finishing.',
   4000, 40, '#E8B84B', 1),
  ('haircut-beard-hotwash',
   'Haarsnit & Baard Hot Towel', 'Haircut & Beard Hot Towel Wet-Shave',
   'De ultieme barbierervaring: haarsnit gecombineerd met een hot towel wet-shave baard behandeling.',
   'The ultimate barber experience: haircut combined with a hot towel wet-shave beard treatment.',
   6000, 60, '#3D9970', 2),
  ('haircut-beardtrim',
   'Haarsnit & Baardtrim', 'Haircut & Beardtrim',
   'Haarsnit gecombineerd met een strakke baardtrim en finishing.',
   'Haircut combined with a sharp beard trim and finishing.',
   5000, 50, '#F39C12', 3),
  ('beardtrim-hotwash',
   'Baardtrim Hot Towel', 'Beardtrim with Hot Towel Wet Shave',
   'Professionele baardtrim met hot towel wet shave afwerking.',
   'Professional beard trim with hot towel wet shave finishing.',
   3500, 35, '#3498DB', 4),
  ('wet-shave',
   'Baard Glad Nat Scheren', 'Full Hot Towel Wet Shave',
   'Full hot towel wet shave voor een perfecte gladde afwerking. Klassieke barbierervaring.',
   'Full hot towel wet shave for a perfect smooth finish. Classic barber experience.',
   3500, 35, '#E74C8B', 5),
  ('walk-in',
   'Everyday Walk In', 'Everyday Walk In',
   'Geen afspraak nodig. We accepteren walk-ins tijdens openingsuren op beschikbare plaatsen.',
   'No appointment needed. We accept walk-ins during opening hours when available.',
   0, 0, '#888888', 6,
   true);   -- ⚠ SOURCE BUG: 10 values vs 9-column list; "true" is the stray is_walk_in value

-- Herschrijf walk-in correct (is_walk_in kolom)
UPDATE services SET is_walk_in = true WHERE slug = 'walk-in';

-- KOPPELING BARBIER ↔ SERVICE
-- ⚠ Voorlopig: alle barbiers bieden alle services aan (placeholder; client said some don't)
INSERT INTO barber_services (barber_id, service_id)
SELECT b.id, s.id FROM barbers b CROSS JOIN services s;

-- BESCHIKBAARHEID  (⚠ PLACEHOLDER hours — Ma–Za 09:00–18:00, zondag gesloten)
-- day_of_week: 0=zo,1=ma,2=di,3=wo,4=do,5=vr,6=za
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'adil';

INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'avraz';

-- SIMAR: di–za (vrij op maandag)
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'simar';

-- BAS: ma–vr 10:00–19:00
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '10:00'::TIME, '19:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5)) AS d(dow) WHERE b.slug = 'bas';
```

---

## 5. CI/CD (GitHub Actions)

Three files were delivered (exact YAML lives in the original outputs of chat A — pull from there; not re-captured verbatim here):

- **`.github/workflows/ci-cd.yml`** — runs tests, deploys a **preview** on push to `develop`, and deploys to **production** on push to `main`.
- **`.github/workflows/migrate.yml`** — runs database migrations automatically **after each production deploy**.
- **`.github/CICD_SETUP.md`** — step-by-step configuration.

**Required GitHub Secrets** (named in the handover): `VERCEL_TOKEN`, `DATABASE_URL`, plus the usual Vercel linkage (`VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` — confirm against `CICD_SETUP.md`).

`.env.example` is committed; real env vars are not.

---

## 6. Known technical gaps (must resolve before/at build)

1. **French (FR) has no storage.** `barbers` and `services` have only `*_nl`/`*_en` columns. A migration must add `*_fr` columns **or** move localized content into an i18n layer. (OPEN-QUESTIONS §5.)
2. **No customer language preference.** `customers` has no `preferred_language`/`locale`, yet emails are "per customer preference." Add a column and capture it at booking. (OPEN-QUESTIONS §5.)
3. **GDPR hard-delete is not implemented:**
   - `appointments.customer_id` has no `ON DELETE` rule → deleting a customer with appointments is blocked. Add `ON DELETE CASCADE` or perform ordered application-level deletes.
   - `email_log.customer_id` is `ON DELETE SET NULL` **and** `email_log.to_email` is retained → raw PII survives a "hard delete." Decide: delete `email_log` rows, or null/redact `to_email`.
   - No `gdpr_delete()` function and no **audit table** for deletion events (the POC promises an audit log). (OPEN-QUESTIONS §4.)
4. **`btree_gist` not explicitly enabled.** The `EXCLUDE USING gist (barber_id WITH =, …)` constraint needs `CREATE EXTENSION btree_gist;` — only `pgcrypto` is created in the migration. Verify on Railway.
5. **Availability cannot model split shifts.** `UNIQUE (barber_id, day_of_week)` allows one window per weekday. A lunch break must be modelled as a `blocked_slots` entry; recurring breaks have no first-class representation. (OPEN-QUESTIONS §1.)
6. **The slot-generation algorithm does not exist.** Buffers, DST, holidays, absence, lead time, granularity all undecided. (OPEN-QUESTIONS §1.)
7. **Seed bug in the walk-in INSERT** (column-count mismatch; "fixed" by a follow-up `UPDATE`). Clean up before running, or run as-is and rely on the `UPDATE`.
8. **Email body copy** (NL/EN/FR) and the **.ics** invite format do not exist. (OPEN-QUESTIONS §3.)
9. **Architecture boundary** (decoupled API vs Next.js monolith) is unresolved. (OPEN-QUESTIONS §9.)

---

## 7. Data residency / ops notes
- Database in **Railway EU region** (which specific region, backup cadence, and retention are unspecified — OPEN-QUESTIONS §13).
- Email via Resend requires a **verified sending domain** for `kameraadhaarsnijder.be` (not yet configured/confirmed).
- All app times in **Europe/Brussels**; store timestamps as `TIMESTAMPTZ` (already the case).
