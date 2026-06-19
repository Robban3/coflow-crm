-- Seed e-commerce packages (own platform/CMS) under an "E-handel" category for
-- the Applabbet org. Setup fee shown as the price; monthly platform fee is the
-- first feature. Skips if the org already has E-handel packages.
INSERT INTO public.pricing_packages
  (organization_id, category, name, price, unit, description, features, highlighted, sort_order)
SELECT p.organization_id, v.category, v.name, v.price, v.unit, v.description, v.features::jsonb, v.highlighted, v.ord
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
CROSS JOIN (VALUES
  ('E-handel','E-handel Start','från 19 000 kr','uppstart','För mindre butiker',
   '["Plattform: från 1 490 kr/mån","Eget CMS","Upp till ~100 produkter","Betalning (Klarna/Stripe)","Frakt & mobilanpassad","Grundläggande SEO"]', false, 5),
  ('E-handel','E-handel Plus','från 35 000 kr','uppstart','Vår populäraste – för växande butiker',
   '["Plattform: från 2 490 kr/mån","Upp till ~1 000 produkter","Flera betalningslösningar","Rabattkoder & kundkonton","Nyhetsbrev-integration","On-page SEO + GA/Pixel"]', true, 6),
  ('E-handel','E-handel Pro','från 59 000 kr','uppstart / offert','Stora kataloger & integrationer',
   '["Plattform: från 4 900 kr/mån","Obegränsat antal produkter","ERP-integration (Fortnox/Visma)","B2B-priser & lagersaldo","Flera språk & valutor","Prioriterad support (SLA)"]', false, 7),
  ('E-handel','Tillägg: Affärssystem-integration','från 9 000 kr','engångs','Koppla e-handeln till ditt ERP',
   '["Fortnox / Visma / Specter","Order- & lagersynk","Automatiska fakturor"]', false, 8),
  ('E-handel','Tillägg: Extra språk & valuta','från 4 900 kr','per språk','Sälj internationellt',
   '["Översatt butik","Lokala valutor","Geo-anpassad frakt"]', false, 9)
) AS v(category, name, price, unit, description, features, highlighted, ord)
WHERE lower(u.email) = 'robert@applabbet.com'
  AND p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.pricing_packages pp
    WHERE pp.organization_id = p.organization_id AND pp.category = 'E-handel'
  );
