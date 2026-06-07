-- ============================================================
-- KAMERAAD HAARSNIJDER — Migration: 004_admin_crm
-- Per docs/PHASES.md Phase 3 (spec: docs/FUNCTIONAL-ANALYSIS.md
-- FR-040..063, FR-080..083, §6 permission matrix, decisions D10/D14/D20).
--
-- New numbered migration only — db/migrations/001..003 are never edited.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Carry-over backlog (Phase 2 simplification): persistent ICS
--    SEQUENCE counter so admin cancel/reschedule emit correctly
--    sequenced calendar updates (FR-071, RFC 5545 §3.8.7.4).
--    Phase 2 derived SEQUENCE from email type (0 confirm / 1 reschedule);
--    that breaks on a SECOND reschedule. Persist + increment instead.
-- ────────────────────────────────────────────────────────────
ALTER TABLE appointments
  ADD COLUMN ics_sequence INT NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- 2. Manual (walk-in / phone) bookings (FR-052): a customer may be
--    created without a real email. customers.email is NOT NULL UNIQUE,
--    so such records carry a synthetic unique placeholder address and
--    are flagged email_missing = true; ALL email dispatch excludes them.
--    NB: FA FR-052 copy ("flagged email_missing=false…") is ambiguous —
--    interpretation recorded in the Phase 3 PR comment.
-- ────────────────────────────────────────────────────────────
ALTER TABLE customers
  ADD COLUMN email_missing BOOLEAN NOT NULL DEFAULT false;

-- ────────────────────────────────────────────────────────────
-- 3. Account lockout rolling window (FR-043).
--    admin_users already has failed_login_count + locked_until (002).
--    Add the timestamp of the most recent failed attempt so the service
--    layer can reset the counter once the 15-min window has elapsed.
-- ────────────────────────────────────────────────────────────
ALTER TABLE admin_users
  ADD COLUMN last_failed_login_at TIMESTAMPTZ;

-- ────────────────────────────────────────────────────────────
-- 4. Content / banner editor (D20, FR-062): a single editable seasonal
--    banner with per-locale title + text and one active flag. Public
--    homepage reads the active row at request time (no redeploy, ≤60s).
-- ────────────────────────────────────────────────────────────
CREATE TABLE content (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT UNIQUE NOT NULL,        -- 'banner' (only editable surface in v1, D20)
  title_nl    TEXT,
  title_en    TEXT,
  title_fr    TEXT,
  title_es    TEXT,
  title_le    TEXT,
  text_nl     TEXT,
  text_en     TEXT,
  text_fr     TEXT,
  text_es     TEXT,
  text_le     TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT false,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  TEXT                          -- admin_users.email of last editor (FR-045 context)
);

CREATE TRIGGER trg_content_updated_at
  BEFORE UPDATE ON content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ────────────────────────────────────────────────────────────
-- 5. GDPR purge function (FR-080..083, D12, §8). Single transaction
--    (a plpgsql function body is atomic): delete email_log → appointments
--    → customer, then write exactly ONE PII-free audit_log event.
--    Owner-only + type-to-confirm are enforced in the service/route layer
--    (FR-083); ON DELETE RESTRICT (migration 002) blocks ad-hoc deletes so
--    only this function ever removes a customer.
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION gdpr_delete(p_customer_id UUID, p_actor TEXT)
RETURNS void AS $$
DECLARE
  v_email_deleted INT;
  v_appt_deleted  INT;
BEGIN
  -- §8.1: email_log rows for this customer OR any of their appointments
  DELETE FROM email_log
   WHERE customer_id = p_customer_id
      OR appointment_id IN (SELECT id FROM appointments WHERE customer_id = p_customer_id);
  GET DIAGNOSTICS v_email_deleted = ROW_COUNT;

  -- §8.2: appointments (deleted before the customer so ON DELETE RESTRICT is satisfied)
  DELETE FROM appointments WHERE customer_id = p_customer_id;
  GET DIAGNOSTICS v_appt_deleted = ROW_COUNT;

  -- §8.3: the customer row itself (all PII)
  DELETE FROM customers WHERE id = p_customer_id;

  -- §8.4: exactly one audit event, NO PII (hash of id + counts only)
  INSERT INTO audit_log (actor, action, payload)
  VALUES (
    p_actor,
    'gdpr_delete',
    jsonb_build_object(
      'customer_id_hash',     encode(digest(p_customer_id::text, 'sha256'), 'hex'),
      'email_log_deleted',    v_email_deleted,
      'appointments_deleted', v_appt_deleted
    )
  );
END;
$$ LANGUAGE plpgsql;
