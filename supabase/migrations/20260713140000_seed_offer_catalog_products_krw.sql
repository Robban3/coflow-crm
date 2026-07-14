-- Korean (KRW) package catalogue: a separate product set with won prices for
-- offers/quotes to South Korean customers. Named "<name> (KR)" to distinguish
-- from the SEK set. VAT 10% (Korean 부가가치세). Prices anchored at ~1 SEK ≈ 155
-- KRW, rounded to clean Korean price points; edit freely in the product picker.
-- Idempotent per (organization_id, name); applies to every organization.
INSERT INTO public.products (organization_id, name, description, unit_price, unit, vat_rate, is_active)
SELECT o.id, v.name, v.description, v.unit_price, v.unit, 10, true
FROM public.organizations o
CROSS JOIN (VALUES
  -- Webbplatser
  ('Landningssida (KR)', 'Fokuserad kampanj-/lanseringssida (Astro).', 1400000, 'st'),
  ('Företagshemsida (KR)', 'Flersidig företagswebbplats, upp till 7 sidor (Astro). Eget CMS ingår.', 2800000, 'st'),
  ('Dynamisk webbplats / Webbapp (KR)', 'Inloggning, bokning, kalkylator, kundportal (React).', 7600000, 'st'),
  -- E-handel (egen plattform)
  ('E-handel Start (KR)', 'Egen e-handelsplattform. Uppstart – drift ₩230 000/mån tillkommer.', 2900000, 'st'),
  ('E-handel Plus (KR)', 'Egen e-handelsplattform. Uppstart – drift ₩390 000/mån tillkommer.', 5400000, 'st'),
  ('E-handel Pro (KR)', 'Egen e-handelsplattform. Uppstart – drift ₩760 000/mån tillkommer.', 9100000, 'st'),
  ('Affärssystem-integration (KR)', 'Tillägg e-handel (Fortnox/Visma/ERP).', 1400000, 'st'),
  ('Extra språk & valuta (KR)', 'Tillägg, per språk.', 760000, 'st'),
  -- Produktbolag
  ('MVP (KR)', 'Validerad kärnfunktion (React), 4–6 veckor.', 4500000, 'st'),
  ('Webbapp (KR)', 'Produktionsklar webbapplikation (React).', 7600000, 'st'),
  ('Mobilapp (KR)', 'iOS + Android (React Native).', 12200000, 'st'),
  -- Varumärke
  ('Logotyp & varumärke (KR)', 'Logotyp, färgpalett, typsnitt, riktlinjer.', 1900000, 'st'),
  -- SEO
  ('SEO Start (KR)', 'On-page-optimering, nyckelordsanalys, månadsrapport.', 760000, 'mån'),
  ('SEO Tillväxt (KR)', 'Content, länkbygge, teknisk SEO, löpande optimering.', 1530000, 'mån'),
  -- AI-synlighet (GEO)
  ('AI-synlighet Start (KR)', 'GEO-grundoptimering, schema markup, månadsrapport.', 760000, 'mån'),
  ('AI-synlighet Tillväxt (KR)', 'Avancerad GEO, innehållsstrategi, veckorapportering.', 1380000, 'mån'),
  ('AI-synlighet Dominate (KR)', 'Full optimering, konkurrentbevakning, dedikerad rådgivare.', 2310000, 'mån'),
  ('Ny AI-optimerad hemsida (KR)', 'Webbombyggnad, tillägg till AI-synlighet.', 2800000, 'st'),
  -- Designpartner
  ('Designpartner (KR)', 'Löpande designpartner.', 1400000, 'mån')
) AS v(name, description, unit_price, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.organization_id = o.id AND p.name = v.name
);
