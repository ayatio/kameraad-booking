-- ============================================================
-- KAMERAAD HAARSNIJDER — DATABASE SCHEMA
-- Migration: 001_initial_schema
-- DB: PostgreSQL 16
--
-- NOTE: reconstructed verbatim from docs/TECHNICAL-BASELINE.md §3
-- (the file was absent from the repo) with the two fixes required
-- by docs/PHASES.md Phase 1 item 2 applied:
--   1. CREATE EXTENSION IF NOT EXISTS btree_gist (needed by the
--      EXCLUDE constraint's barber_id WITH = operator).
--   2. (seed fix lives in db/seeds/001_seed_data.sql)
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
-- Required for EXCLUDE USING gist (barber_id WITH =, tstzrange WITH &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- ────────────────────────────────────────────────────────────
-- BARBIERS
-- ────────────────────────────────────────────────────────────
CREATE TABLE barbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          TEXT UNIQUE NOT NULL,          -- 'adil', 'avraz', 'simar', 'bas'
  name          TEXT NOT NULL,
  bio_nl        TEXT,
  bio_en        TEXT,                          -- bio_fr added in migration 002
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
  name_en         TEXT NOT NULL,               -- *_fr columns added in migration 002
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
  UNIQUE (barber_id, day_of_week)              -- relaxed to (…, start_time) in 002 (D8)
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
  -- preferred_language / consent_given_at / no_show_count / unsubscribe_token → migration 002
);

-- ────────────────────────────────────────────────────────────
-- AFSPRAKEN
-- ────────────────────────────────────────────────────────────
CREATE TYPE appointment_status AS ENUM (
  'pending',      -- net geboekt, wacht op bevestiging (ongebruikt in v1, D13)
  'confirmed',    -- bevestigd
  'cancelled',    -- geannuleerd door klant
  'no_show',      -- niet komen opdagen
  'completed'     -- afgewerkt
);

CREATE TABLE appointments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id           UUID NOT NULL REFERENCES barbers(id),
  service_id          UUID NOT NULL REFERENCES services(id),
  customer_id         UUID NOT NULL REFERENCES customers(id),   -- ON DELETE RESTRICT added in 002 (FR-082)
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
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  email_type      email_type NOT NULL,
  to_email        TEXT NOT NULL,
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
