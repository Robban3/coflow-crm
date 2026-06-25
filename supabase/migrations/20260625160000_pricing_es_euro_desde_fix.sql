-- Fix: the Spanish price must mirror the base price's structure. "desde" (from)
-- belongs only on packages whose base price actually starts with "från"; fixed
-- prices (e.g. "18 000 kr", "18 000 kr + 3 900 kr/mån") must NOT get "desde".
-- Deriving the prefix from the live base `price` makes this correct regardless
-- of any manual edits. Euro amounts are unchanged from the previous migration.

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 850 €' ELSE '850 €' END
  WHERE category='Hemsidor' AND name='Landningssida';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 1 650 €' ELSE '1 650 €' END
  WHERE category='Hemsidor' AND name='Företagshemsida';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 3 200 €' ELSE '3 200 €' END
  WHERE category='Hemsidor' AND name='E-handel';

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 2 650 €' ELSE '2 650 €' END
  WHERE category='MVP & Appar' AND name='MVP';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 4 500 €' ELSE '4 500 €' END
  WHERE category='MVP & Appar' AND name='Webbapp';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 7 250 €' ELSE '7 250 €' END
  WHERE category='MVP & Appar' AND name='Mobilapp (iOS & Android)';

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 450 €' ELSE '450 €' END
  WHERE category='SEO & GEO' AND name='SEO Start';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 900 €' ELSE '900 €' END
  WHERE category='SEO & GEO' AND name='SEO Tillväxt';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 650 €' ELSE '650 €' END
  WHERE category='SEO & GEO' AND name='GEO / AI-synlighet';

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 850 €' ELSE '850 €' END
  WHERE category='Design' AND name='Designpartner';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 1 100 €' ELSE '1 100 €' END
  WHERE category='Design' AND name='Logotyp & varumärke';

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 1 650 € + 350 €/mes' ELSE '1 650 € + 350 €/mes' END
  WHERE category='Paket & kombinationer' AND name='Startpaket';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 2 300 € + 1 350 €/mes' ELSE '2 300 € + 1 350 €/mes' END
  WHERE category='Paket & kombinationer' AND name='Tillväxtpaket';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 2 650 € + 650 €/mes' ELSE '2 650 € + 650 €/mes' END
  WHERE category='Paket & kombinationer' AND name='MVP-paket';

UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 1 750 €' ELSE '1 750 €' END
  WHERE category='E-handel' AND name='E-handel Start';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 3 200 €' ELSE '3 200 €' END
  WHERE category='E-handel' AND name='E-handel Plus';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 5 400 €' ELSE '5 400 €' END
  WHERE category='E-handel' AND name='E-handel Pro';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 850 €' ELSE '850 €' END
  WHERE category='E-handel' AND name='Tillägg: Affärssystem-integration';
UPDATE public.pricing_packages
  SET price_es = CASE WHEN price ILIKE 'från%' THEN 'desde 450 €' ELSE '450 €' END
  WHERE category='E-handel' AND name='Tillägg: Extra språk & valuta';
