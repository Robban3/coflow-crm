-- Spanish pricing should be shown in euros, not kronor.
-- Rate anchored on the user's reference: 18 000 kr ≈ 1 650 € (~0.0917 €/kr).
-- Amounts rounded to clean values. Idempotent: only touches rows whose Spanish
-- price/feature still contains "kr". English prices keep kr.

UPDATE public.pricing_packages SET price_es='desde 850 €'
  WHERE category='Hemsidor' AND name='Landningssida' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='1 650 €'
  WHERE category='Hemsidor' AND name='Företagshemsida' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 3 200 €'
  WHERE category='Hemsidor' AND name='E-handel' AND price_es LIKE '%kr%';

UPDATE public.pricing_packages SET price_es='desde 2 650 €'
  WHERE category='MVP & Appar' AND name='MVP' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 4 500 €'
  WHERE category='MVP & Appar' AND name='Webbapp' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 7 250 €'
  WHERE category='MVP & Appar' AND name='Mobilapp (iOS & Android)' AND price_es LIKE '%kr%';

UPDATE public.pricing_packages SET price_es='desde 450 €'
  WHERE category='SEO & GEO' AND name='SEO Start' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 900 €'
  WHERE category='SEO & GEO' AND name='SEO Tillväxt' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 650 €'
  WHERE category='SEO & GEO' AND name='GEO / AI-synlighet' AND price_es LIKE '%kr%';

UPDATE public.pricing_packages SET price_es='desde 850 €'
  WHERE category='Design' AND name='Designpartner' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 1 100 €'
  WHERE category='Design' AND name='Logotyp & varumärke' AND price_es LIKE '%kr%';

UPDATE public.pricing_packages SET price_es='1 650 € + 350 €/mes'
  WHERE category='Paket & kombinationer' AND name='Startpaket' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 2 300 € + 1 350 €/mes'
  WHERE category='Paket & kombinationer' AND name='Tillväxtpaket' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 2 650 € + 650 €/mes'
  WHERE category='Paket & kombinationer' AND name='MVP-paket' AND price_es LIKE '%kr%';
-- "Full digital närvaro" stays "Contáctanos" (no amount) — nothing to convert.

UPDATE public.pricing_packages SET
  price_es='desde 1 750 €',
  features_es='["Plataforma: desde 140 €/mes","CMS propio","Hasta ~100 productos","Pago (Klarna/Stripe)","Envío y adaptado a móvil","SEO básico"]'::jsonb
  WHERE category='E-handel' AND name='E-handel Start' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET
  price_es='desde 3 200 €',
  features_es='["Plataforma: desde 230 €/mes","Hasta ~1 000 productos","Varias soluciones de pago","Códigos de descuento y cuentas de cliente","Integración de boletín","SEO on-page + GA/Pixel"]'::jsonb
  WHERE category='E-handel' AND name='E-handel Plus' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET
  price_es='desde 5 400 €',
  features_es='["Plataforma: desde 450 €/mes","Productos ilimitados","Integración ERP (Fortnox/Visma)","Precios B2B y existencias","Varios idiomas y monedas","Soporte prioritario (SLA)"]'::jsonb
  WHERE category='E-handel' AND name='E-handel Pro' AND price_es LIKE '%kr%';

UPDATE public.pricing_packages SET price_es='desde 850 €'
  WHERE category='E-handel' AND name='Tillägg: Affärssystem-integration' AND price_es LIKE '%kr%';
UPDATE public.pricing_packages SET price_es='desde 450 €'
  WHERE category='E-handel' AND name='Tillägg: Extra språk & valuta' AND price_es LIKE '%kr%';
