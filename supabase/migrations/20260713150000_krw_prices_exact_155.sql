-- Align every KRW (KR) product to an exact 1 SEK = 155 KRW conversion, rounded
-- to the nearest 10 000 won. Corrects a few prices that were rounded loosely in
-- the initial KRW seed (20260713140000). Matches by product name across all orgs.
UPDATE public.products p
SET unit_price = v.price
FROM (VALUES
  ('Landningssida (KR)', 1400000),
  ('Företagshemsida (KR)', 2790000),
  ('Dynamisk webbplats / Webbapp (KR)', 7600000),
  ('E-handel Start (KR)', 2950000),
  ('E-handel Plus (KR)', 5430000),
  ('E-handel Pro (KR)', 9150000),
  ('Affärssystem-integration (KR)', 1400000),
  ('Extra språk & valuta (KR)', 760000),
  ('MVP (KR)', 4500000),
  ('Webbapp (KR)', 7600000),
  ('Mobilapp (KR)', 12250000),
  ('Logotyp & varumärke (KR)', 1860000),
  ('SEO Start (KR)', 760000),
  ('SEO Tillväxt (KR)', 1530000),
  ('AI-synlighet Start (KR)', 760000),
  ('AI-synlighet Tillväxt (KR)', 1380000),
  ('AI-synlighet Dominate (KR)', 2310000),
  ('Ny AI-optimerad hemsida (KR)', 2790000),
  ('Designpartner (KR)', 1400000)
) AS v(name, price)
WHERE p.name = v.name;
