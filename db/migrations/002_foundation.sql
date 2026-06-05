-- ============================================================
-- KAMERAAD HAARSNIJDER — Migration: 002_foundation
-- Per docs/PHASES.md Phase 1 item 3 (spec: docs/FUNCTIONAL-ANALYSIS.md)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. French content columns (D2, FR-092)
-- ────────────────────────────────────────────────────────────
ALTER TABLE barbers  ADD COLUMN bio_fr         TEXT;
ALTER TABLE services ADD COLUMN name_fr        TEXT;
ALTER TABLE services ADD COLUMN description_fr TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. Customers: language, GDPR, no-show, unsubscribe (D2, D14, FR-072)
-- ────────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN preferred_language TEXT NOT NULL DEFAULT 'nl'
    CHECK (preferred_language IN ('nl', 'en', 'fr')),
  ADD COLUMN no_show_count INT NOT NULL DEFAULT 0,
  ADD COLUMN consent_given_at TIMESTAMPTZ,
  ADD COLUMN unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex');

-- ────────────────────────────────────────────────────────────
-- 3. Split shifts (D8): one row per window, not per weekday
-- ────────────────────────────────────────────────────────────
ALTER TABLE availability
  DROP CONSTRAINT availability_barber_id_day_of_week_key,
  ADD CONSTRAINT availability_barber_day_start_key
    UNIQUE (barber_id, day_of_week, start_time);

-- ────────────────────────────────────────────────────────────
-- 4. Settings (FR-008, FA §2): runtime-editable key/value
-- ────────────────────────────────────────────────────────────
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO settings (key, value) VALUES
  ('cancellation_window_hours', '24'::jsonb),  -- D4 (default pending client confirmation)
  ('buffer_min',                '0'::jsonb),   -- D5
  ('min_lead_time_hours',       '2'::jsonb),   -- D7
  ('booking_horizon_days',      '56'::jsonb),  -- D7
  ('rebooking_weeks',           '5'::jsonb)    -- D16
ON CONFLICT (key) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 5. Audit log (FR-045, §8: GDPR + settings changes; payload non-PII)
-- ────────────────────────────────────────────────────────────
CREATE TABLE audit_log (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor      TEXT NOT NULL,           -- admin_users.email or 'system'
  action     TEXT NOT NULL,           -- e.g. 'gdpr_delete', 'settings_update'
  payload    JSONB,                   -- non-PII payload only
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_created_at ON audit_log (created_at);

-- ────────────────────────────────────────────────────────────
-- 6. Admin users (D17, FR-040..043)
-- ────────────────────────────────────────────────────────────
CREATE TYPE admin_role AS ENUM ('owner', 'barber');

CREATE TABLE admin_users (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                  TEXT UNIQUE NOT NULL,
  password_hash          TEXT,                  -- bcrypt cost >= 12; NULL until set-password completes
  role                   admin_role NOT NULL,
  barber_id              UUID REFERENCES barbers(id),
  set_password_token     TEXT UNIQUE,           -- invite (48h) / reset (2h) token
  set_password_expires_at TIMESTAMPTZ,
  failed_login_count     INT NOT NULL DEFAULT 0,
  locked_until           TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 7. Email idempotency (FR-007, FR-070)
-- ────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX uq_email_log_appointment_type_sent
  ON email_log (appointment_id, email_type)
  WHERE status = 'sent';

-- ────────────────────────────────────────────────────────────
-- 8. GDPR: appointments.customer_id ON DELETE RESTRICT (FR-082)
--    Only gdpr_delete() removes customers, never ad-hoc cascades.
-- ────────────────────────────────────────────────────────────
ALTER TABLE appointments
  DROP CONSTRAINT appointments_customer_id_fkey,
  ADD CONSTRAINT appointments_customer_id_fkey
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT;
