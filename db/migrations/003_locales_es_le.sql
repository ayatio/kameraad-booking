-- ============================================================
-- KAMERAAD HAARSNIJDER — Migration: 003_locales_es_le
-- Scope change decided by Ayat 2026-06-05: the product supports
-- 5 locales — nl (default), en, fr, es, le (Leuvens dialect).
-- Adds *_es and *_le content columns alongside the existing *_fr
-- pattern (FR-092 extended) and widens the customers.preferred_language
-- CHECK to the 5 codes (D2 extended).
-- NOTE: 'le' is switcher-only — browsers never send it in
-- Accept-Language and it is never auto-selected (FR-090 extended).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Spanish + Leuvens content columns (FR-092 extended)
-- ────────────────────────────────────────────────────────────
ALTER TABLE barbers  ADD COLUMN bio_es         TEXT;
ALTER TABLE barbers  ADD COLUMN bio_le         TEXT;
ALTER TABLE services ADD COLUMN name_es        TEXT;
ALTER TABLE services ADD COLUMN description_es TEXT;
ALTER TABLE services ADD COLUMN name_le        TEXT;
ALTER TABLE services ADD COLUMN description_le TEXT;

-- ────────────────────────────────────────────────────────────
-- 2. customers.preferred_language: widen CHECK to 5 locales
-- ────────────────────────────────────────────────────────────
ALTER TABLE customers
  DROP CONSTRAINT customers_preferred_language_check,
  ADD CONSTRAINT customers_preferred_language_check
    CHECK (preferred_language IN ('nl', 'en', 'fr', 'es', 'le'));
