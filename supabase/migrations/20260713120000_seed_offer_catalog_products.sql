-- Offer/quote catalogue: fix the misspelled "hensida" product and seed the full
-- package catalogue into public.products so every package is selectable in the
-- "select from catalog" picker (QuoteEditor / document offers).
-- Idempotent per (organization_id, name); applies to every organization.

-- 1. Fix the misspelling: "hensida" -> "Hemsida" (case-insensitive match).
UPDATE public.products
SET name = 'Hemsida'
WHERE lower(name) = 'hensida';

-- 2. Seed the full catalogue. One row per package. Recurring packages use unit
--    'mån'; one-time packages use 'st'. For e-commerce (both start-up + monthly)
--    the row price is the start-up fee and the monthly drift is noted in the
--    description. All prices in SEK, 25% VAT. Skipped only if the org already
--    has a product with that exact name.
INSERT INTO public.products (organization_id, name, description, unit_price, unit, vat_rate, is_active)
SELECT o.id, v.name, v.description, v.unit_price, v.unit, 25, true
FROM public.organizations o
CROSS JOIN (VALUES
  -- Webbplatser
  ('Landningssida', 'Fokuserad kampanj-/lanseringssida (Astro). Från-pris.', 9000, 'st'),
  ('Företagshemsida', 'Flersidig företagswebbplats, upp till 7 sidor (Astro). Eget CMS ingår.', 18000, 'st'),
  ('Dynamisk webbplats / Webbapp', 'Inloggning, bokning, kalkylator, kundportal (React). Från-pris.', 49000, 'st'),
  -- E-handel (egen plattform)
  ('E-handel Start', 'Egen e-handelsplattform. Uppstart – drift 1 490 kr/mån tillkommer.', 19000, 'st'),
  ('E-handel Plus', 'Egen e-handelsplattform. Uppstart – drift 2 490 kr/mån tillkommer.', 35000, 'st'),
  ('E-handel Pro', 'Egen e-handelsplattform. Uppstart – drift 4 900 kr/mån tillkommer.', 59000, 'st'),
  ('Affärssystem-integration', 'Tillägg e-handel (Fortnox/Visma/ERP). Från-pris.', 9000, 'st'),
  ('Extra språk & valuta', 'Tillägg, per språk.', 4900, 'st'),
  -- Produktbolag
  ('MVP', 'Validerad kärnfunktion (React), 4–6 veckor. Från-pris.', 29000, 'st'),
  ('Webbapp', 'Produktionsklar webbapplikation (React). Från-pris.', 49000, 'st'),
  ('Mobilapp', 'iOS + Android (React Native). Från-pris.', 79000, 'st'),
  -- Varumärke
  ('Logotyp & varumärke', 'Logotyp, färgpalett, typsnitt, riktlinjer. Från-pris.', 12000, 'st'),
  -- SEO
  ('SEO Start', 'On-page-optimering, nyckelordsanalys, månadsrapport.', 4900, 'mån'),
  ('SEO Tillväxt', 'Content, länkbygge, teknisk SEO, löpande optimering.', 9900, 'mån'),
  -- AI-synlighet (GEO)
  ('AI-synlighet Start', 'GEO-grundoptimering, schema markup, månadsrapport.', 4900, 'mån'),
  ('AI-synlighet Tillväxt', 'Avancerad GEO, innehållsstrategi, veckorapportering.', 8900, 'mån'),
  ('AI-synlighet Dominate', 'Full optimering, konkurrentbevakning, dedikerad rådgivare.', 14900, 'mån'),
  ('Ny AI-optimerad hemsida', 'Webbombyggnad, tillägg till AI-synlighet. Från-pris.', 18000, 'st'),
  -- Designpartner
  ('Designpartner', 'Löpande designpartner. Från-pris.', 9000, 'mån')
) AS v(name, description, unit_price, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.organization_id = o.id AND p.name = v.name
);
