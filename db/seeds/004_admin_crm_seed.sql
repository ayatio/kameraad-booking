-- ============================================================
-- KAMERAAD — SEED 004 (Admin + CRM, per docs/PHASES.md Phase 3)
-- Idempotent (ON CONFLICT / WHERE NOT EXISTS). Run after migrations.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Barber admin accounts (FR-041, §1 actors: Adil, Avraz, Simar, Bas)
--    Owner seeds barber accounts → invite flow. No plaintext password is
--    committed: password_hash stays NULL until set-password completes; an
--    invite token (48h) is generated at seed time. role='barber', linked
--    to the matching barbers row via barber_id.
-- ────────────────────────────────────────────────────────────
INSERT INTO admin_users (email, role, barber_id, set_password_token, set_password_expires_at)
SELECT b.email, 'barber', b.id,
       encode(gen_random_bytes(32), 'hex'),
       now() + interval '48 hours'
FROM barbers b
WHERE b.slug IN ('adil', 'avraz', 'simar', 'bas')
  AND b.email IS NOT NULL
ON CONFLICT (email) DO NOTHING;

-- ────────────────────────────────────────────────────────────
-- 2. Seasonal banner content row (D20, FR-062). One editable banner,
--    inactive by default. Per-locale title/text are PROVISIONAL agent
--    drafts pending client copy (same review status as FR-094 content).
-- ────────────────────────────────────────────────────────────
-- PROVISIONAL: agent-drafted banner copy, pending client review (D20, FR-062)
INSERT INTO content (key, is_active,
  title_nl, title_en, title_fr, title_es, title_le,
  text_nl, text_en, text_fr, text_es, text_le)
VALUES ('banner', false,
  'Welkom bij Kameraad Haarsnijder',
  'Welcome to Kameraad Haarsnijder',
  'Bienvenue chez Kameraad Haarsnijder',
  'Bienvenido a Kameraad Haarsnijder',
  'Welgekoame bij Kameraad Haarsnijder',  -- DRAFT Leuvens
  'Boek vandaag nog je afspraak.',
  'Book your appointment today.',
  'Réservez votre rendez-vous dès aujourd''hui.',
  'Reserva tu cita hoy mismo.',
  'Boek vandaag nog ne keer na den Kameraad.')  -- DRAFT Leuvens
ON CONFLICT (key) DO NOTHING;
