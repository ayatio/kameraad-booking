-- ============================================================
-- KAMERAAD — SEED 002 (Foundation, per docs/PHASES.md Phase 1 item 4)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. FR draft content for barbers + services (FR-094)
-- ────────────────────────────────────────────────────────────
-- DRAFT translation -- PROVISIONAL: agent-drafted French copy, pending client review (FR-094)
UPDATE barbers SET bio_fr = 'Barbier passionné avec le souci du détail.' WHERE slug = 'adil'  AND bio_fr IS NULL;
UPDATE barbers SET bio_fr = 'Spécialiste des techniques classiques et des styles modernes.' WHERE slug = 'avraz' AND bio_fr IS NULL;
UPDATE barbers SET bio_fr = 'Votre référence pour des lignes nettes et une finition parfaite.' WHERE slug = 'simar' AND bio_fr IS NULL;
UPDATE barbers SET bio_fr = 'Expert en stylisme de barbe et soins à la serviette chaude.' WHERE slug = 'bas'   AND bio_fr IS NULL;

-- DRAFT translation -- PROVISIONAL: agent-drafted French copy, pending client review (FR-094)
UPDATE services SET
  name_fr = 'Coupe de cheveux',
  description_fr = 'Une coupe personnalisée, adaptée à votre style et à la forme de votre visage. Finition incluse.'
WHERE slug = 'haircut' AND name_fr IS NULL;

UPDATE services SET
  name_fr = 'Coupe & Barbe Serviette Chaude',
  description_fr = 'L''expérience barbier ultime : coupe de cheveux combinée à un rasage à la serviette chaude pour la barbe.'
WHERE slug = 'haircut-beard-hotwash' AND name_fr IS NULL;

UPDATE services SET
  name_fr = 'Coupe & Taille de barbe',
  description_fr = 'Coupe de cheveux combinée à une taille de barbe nette et une finition soignée.'
WHERE slug = 'haircut-beardtrim' AND name_fr IS NULL;

UPDATE services SET
  name_fr = 'Taille de barbe Serviette Chaude',
  description_fr = 'Taille de barbe professionnelle avec finition au rasage à la serviette chaude.'
WHERE slug = 'beardtrim-hotwash' AND name_fr IS NULL;

UPDATE services SET
  name_fr = 'Rasage complet à la serviette chaude',
  description_fr = 'Rasage complet à la serviette chaude pour une finition parfaitement lisse. Expérience barbier classique.'
WHERE slug = 'wet-shave' AND name_fr IS NULL;

UPDATE services SET
  name_fr = 'Sans rendez-vous',
  description_fr = 'Pas de rendez-vous nécessaire. Nous acceptons les visites sans rendez-vous pendant les heures d''ouverture, selon disponibilité.'
WHERE slug = 'walk-in' AND name_fr IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Belgian public holidays 2026–2027 as all-barber blocks (D9)
--    barber_id NULL = all barbers; full local days Europe/Brussels.
--    Deletable by admin per D9.
-- ────────────────────────────────────────────────────────────
INSERT INTO blocked_slots (barber_id, start_at, end_at, reason)
SELECT NULL,
       (d.day || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Brussels',
       ((d.day::date + 1) || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Brussels',
       d.reason
FROM (VALUES
  -- 2026
  ('2026-01-01', 'Feestdag: Nieuwjaar'),
  ('2026-04-06', 'Feestdag: Paasmaandag'),
  ('2026-05-01', 'Feestdag: Dag van de Arbeid'),
  ('2026-05-14', 'Feestdag: O.L.H. Hemelvaart'),
  ('2026-05-25', 'Feestdag: Pinkstermaandag'),
  ('2026-07-21', 'Feestdag: Nationale feestdag'),
  ('2026-08-15', 'Feestdag: O.L.V. Hemelvaart'),
  ('2026-11-01', 'Feestdag: Allerheiligen'),
  ('2026-11-11', 'Feestdag: Wapenstilstand'),
  ('2026-12-25', 'Feestdag: Kerstmis'),
  -- 2027
  ('2027-01-01', 'Feestdag: Nieuwjaar'),
  ('2027-03-29', 'Feestdag: Paasmaandag'),
  ('2027-05-01', 'Feestdag: Dag van de Arbeid'),
  ('2027-05-06', 'Feestdag: O.L.H. Hemelvaart'),
  ('2027-05-17', 'Feestdag: Pinkstermaandag'),
  ('2027-07-21', 'Feestdag: Nationale feestdag'),
  ('2027-08-15', 'Feestdag: O.L.V. Hemelvaart'),
  ('2027-11-01', 'Feestdag: Allerheiligen'),
  ('2027-11-11', 'Feestdag: Wapenstilstand'),
  ('2027-12-25', 'Feestdag: Kerstmis')
) AS d(day, reason)
WHERE NOT EXISTS (
  SELECT 1 FROM blocked_slots bs
  WHERE bs.barber_id IS NULL
    AND bs.reason = d.reason
    AND bs.start_at = (d.day || ' 00:00:00')::timestamp AT TIME ZONE 'Europe/Brussels'
);

-- ────────────────────────────────────────────────────────────
-- 3. Owner admin user (D17, FR-041)
--    No plaintext password committed: password_hash stays NULL;
--    a set-password token is generated at seed time (invite flow).
--    PROVISIONAL: owner email unconfirmed — placeholder pending client
--    confirmation (asked in the Phase 1 PR).
-- ────────────────────────────────────────────────────────────
INSERT INTO admin_users (email, role, set_password_token, set_password_expires_at)
VALUES (
  'info@kameraadhaarsnijder.be',  -- PROVISIONAL owner email
  'owner',
  encode(gen_random_bytes(32), 'hex'),
  now() + interval '48 hours'
)
ON CONFLICT (email) DO NOTHING;
