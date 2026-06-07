-- ============================================================
-- KAMERAAD — SEED 003 (Phase 2 locale scope change: es + le)
-- ES + Leuvens (le) content for barbers/services.
-- Style reference: docs/design/gate-a/i18n.js (DRAFT — non-binding
-- mockup copy; FUNCTIONAL-ANALYSIS service catalogue wins).
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Spanish content
-- -- DRAFT translation -- PROVISIONAL: agent-drafted Spanish copy, pending client review (FR-094 extended)
-- ────────────────────────────────────────────────────────────
UPDATE barbers SET bio_es = 'Barbero apasionado con ojo para el detalle.' WHERE slug = 'adil'  AND bio_es IS NULL;
UPDATE barbers SET bio_es = 'Especialista en técnicas clásicas y estilos modernos.' WHERE slug = 'avraz' AND bio_es IS NULL;
UPDATE barbers SET bio_es = 'Tu referencia para líneas marcadas y un acabado perfecto.' WHERE slug = 'simar' AND bio_es IS NULL;
UPDATE barbers SET bio_es = 'Experto en el estilismo de barba y tratamientos con toalla caliente.' WHERE slug = 'bas'   AND bio_es IS NULL;

UPDATE services SET
  name_es = 'Corte de pelo',
  description_es = 'Un corte personalizado, adaptado a tu estilo y a la forma de tu rostro. Acabado incluido.'
WHERE slug = 'haircut' AND name_es IS NULL;

UPDATE services SET
  name_es = 'Corte & Barba con toalla caliente',
  description_es = 'La experiencia barbera definitiva: corte de pelo combinado con un afeitado de barba con toalla caliente.'
WHERE slug = 'haircut-beard-hotwash' AND name_es IS NULL;

UPDATE services SET
  name_es = 'Corte & Arreglo de barba',
  description_es = 'Corte de pelo combinado con un arreglo de barba marcado y un acabado cuidado.'
WHERE slug = 'haircut-beardtrim' AND name_es IS NULL;

UPDATE services SET
  name_es = 'Arreglo de barba con toalla caliente',
  description_es = 'Arreglo de barba profesional con acabado de afeitado con toalla caliente.'
WHERE slug = 'beardtrim-hotwash' AND name_es IS NULL;

UPDATE services SET
  name_es = 'Afeitado completo con toalla caliente',
  description_es = 'Afeitado completo con toalla caliente para un acabado perfectamente liso. Experiencia barbera clásica.'
WHERE slug = 'wet-shave' AND name_es IS NULL;

UPDATE services SET
  name_es = 'Sin cita',
  description_es = 'No necesitas cita. Aceptamos visitas sin cita durante el horario de apertura, según disponibilidad.'
WHERE slug = 'walk-in' AND name_es IS NULL;

-- ────────────────────────────────────────────────────────────
-- 2. Leuvens (le) content
-- -- DRAFT Leuvens -- PROVISIONAL: first approximation in the spirit of
-- docs/design/gate-a/i18n.js; Adil delivers the definitive Leuvens
-- translation later. Do not treat as final copy.
-- ────────────────────────────────────────────────────────────
UPDATE barbers SET bio_le = 'Gepassioneerde barbier me oêog veu detail.' WHERE slug = 'adil'  AND bio_le IS NULL;
UPDATE barbers SET bio_le = 'Specialist in klassieke technieke en modern stijle.' WHERE slug = 'avraz' AND bio_le IS NULL;
UPDATE barbers SET bio_le = 'Aave go-to veu scherpe lijne en een perfect afwerking.' WHERE slug = 'simar' AND bio_le IS NULL;
UPDATE barbers SET bio_le = 'Expert in boordstyling en hot towel behandelinge.' WHERE slug = 'bas'   AND bio_le IS NULL;

UPDATE services SET
  name_le = 'Haarsnit',
  description_le = 'Een gepersonaliseerde snit, afgestemd op aave stijl en a gezicht. Finishing inbegrepe.'
WHERE slug = 'haircut' AND name_le IS NULL;

UPDATE services SET
  name_le = 'Haarsnit & Boord Hot Towel',
  description_le = 'De ultieme barbierervaring: haarsnit gecombineerd me een hot towel wet-shave boordbehandeling.'
WHERE slug = 'haircut-beard-hotwash' AND name_le IS NULL;

UPDATE services SET
  name_le = 'Haarsnit & Boordtrim',
  description_le = 'Haarsnit gecombineerd me een strakke boordtrim en finishing.'
WHERE slug = 'haircut-beardtrim' AND name_le IS NULL;

UPDATE services SET
  name_le = 'Boordtrim Hot Towel',
  description_le = 'Professionele boordtrim me hot towel wet shave afwerking.'
WHERE slug = 'beardtrim-hotwash' AND name_le IS NULL;

UPDATE services SET
  name_le = 'Boord Glad Nat Schere',
  description_le = 'Full hot towel wet shave veu een perfect gladde afwerking. Klassieke barbierervaring.'
WHERE slug = 'wet-shave' AND name_le IS NULL;

UPDATE services SET
  name_le = 'Everyday Walk In',
  description_le = 'Gên afsprak noêdig. Komt gewoêon binne tijdens de openingsure as er plek is.'
WHERE slug = 'walk-in' AND name_le IS NULL;
