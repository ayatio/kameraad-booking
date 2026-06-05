-- ============================================================
-- KAMERAAD — SEED 001  (run AFTER migrations)
-- Reconstructed from docs/TECHNICAL-BASELINE.md §4 with the
-- walk-in INSERT fixed per docs/PHASES.md Phase 1 item 2:
-- is_walk_in is now in the column list (no column-count bug,
-- no follow-up UPDATE needed).
-- ============================================================

-- BARBIERS
INSERT INTO barbers (slug, name, bio_nl, bio_en, email, sort_order) VALUES
  ('adil',  'Adil',  'Gepassioneerde barbier met oog voor detail.', 'Passionate barber with an eye for detail.',  'adil@kameraadhaarsnijder.be',  1),
  ('avraz', 'Avraz', 'Specialist in klassieke technieken en moderne stijlen.', 'Specialist in classic techniques and modern styles.', 'avraz@kameraadhaarsnijder.be', 2),
  ('simar', 'Simar', 'Jouw go-to voor scherpe lijnen en perfecte afwerking.', 'Your go-to for sharp lines and perfect finishing.', 'simar@kameraadhaarsnijder.be', 3),
  ('bas',   'Bas',   'Expert in baard styling en hot towel treatments.', 'Expert in beard styling and hot towel treatments.',   'bas@kameraadhaarsnijder.be',   4)
ON CONFLICT (slug) DO NOTHING;

-- SERVICES (walk-in row fixed: is_walk_in included in the column list)
INSERT INTO services (slug, name_nl, name_en, description_nl, description_en, price_cents, duration_min, color, sort_order, is_walk_in) VALUES
  ('haircut',
   'Haarsnit / Haircut', 'Haircut',
   'Een gepersonaliseerde haarsnit, afgestemd op jouw stijl en gezichtsvorm. Inclusief finishing.',
   'A personalised haircut tailored to your style and face shape. Includes finishing.',
   4000, 40, '#E8B84B', 1, false),
  ('haircut-beard-hotwash',
   'Haarsnit & Baard Hot Towel', 'Haircut & Beard Hot Towel Wet-Shave',
   'De ultieme barbierervaring: haarsnit gecombineerd met een hot towel wet-shave baard behandeling.',
   'The ultimate barber experience: haircut combined with a hot towel wet-shave beard treatment.',
   6000, 60, '#3D9970', 2, false),
  ('haircut-beardtrim',
   'Haarsnit & Baardtrim', 'Haircut & Beardtrim',
   'Haarsnit gecombineerd met een strakke baardtrim en finishing.',
   'Haircut combined with a sharp beard trim and finishing.',
   5000, 50, '#F39C12', 3, false),
  ('beardtrim-hotwash',
   'Baardtrim Hot Towel', 'Beardtrim with Hot Towel Wet Shave',
   'Professionele baardtrim met hot towel wet shave afwerking.',
   'Professional beard trim with hot towel wet shave finishing.',
   3500, 35, '#3498DB', 4, false),
  ('wet-shave',
   'Baard Glad Nat Scheren', 'Full Hot Towel Wet Shave',
   'Full hot towel wet shave voor een perfecte gladde afwerking. Klassieke barbierervaring.',
   'Full hot towel wet shave for a perfect smooth finish. Classic barber experience.',
   3500, 35, '#E74C8B', 5, false),
  ('walk-in',
   'Everyday Walk In', 'Everyday Walk In',
   'Geen afspraak nodig. We accepteren walk-ins tijdens openingsuren op beschikbare plaatsen.',
   'No appointment needed. We accept walk-ins during opening hours when available.',
   0, 0, '#888888', 6, true)
ON CONFLICT (slug) DO NOTHING;

-- KOPPELING BARBIER ↔ SERVICE
-- PROVISIONAL: alle barbiers bieden alle services aan (client said some don't; OQ §2, FR-004)
INSERT INTO barber_services (barber_id, service_id)
SELECT b.id, s.id FROM barbers b CROSS JOIN services s
ON CONFLICT DO NOTHING;

-- BESCHIKBAARHEID
-- PROVISIONAL hours — Ma–Za 09:00–18:00, zondag gesloten (real hours pending client, OQ §1.10)
-- day_of_week: 0=zo,1=ma,2=di,3=wo,4=do,5=vr,6=za
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'adil'
ON CONFLICT (barber_id, day_of_week, start_time) DO NOTHING;

INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'avraz'
ON CONFLICT (barber_id, day_of_week, start_time) DO NOTHING;

-- SIMAR: di–za (vrij op maandag)  -- PROVISIONAL
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '09:00'::TIME, '18:00'::TIME
FROM barbers b, (VALUES (2),(3),(4),(5),(6)) AS d(dow) WHERE b.slug = 'simar'
ON CONFLICT (barber_id, day_of_week, start_time) DO NOTHING;

-- BAS: ma–vr 10:00–19:00  -- PROVISIONAL
INSERT INTO availability (barber_id, day_of_week, start_time, end_time)
SELECT b.id, d.dow, '10:00'::TIME, '19:00'::TIME
FROM barbers b, (VALUES (1),(2),(3),(4),(5)) AS d(dow) WHERE b.slug = 'bas'
ON CONFLICT (barber_id, day_of_week, start_time) DO NOTHING;
