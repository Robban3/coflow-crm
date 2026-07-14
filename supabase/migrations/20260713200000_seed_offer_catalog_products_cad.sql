-- Canadian (CAD) package catalogue: a separate English product set for offers to
-- Canadian customers. Named "<name> (CA)". Prices = SEK × 0.15. VAT defaulted to
-- 13% (HST) — Canadian sales tax varies by province (5% GST to 15% HST), so adjust
-- per product/customer as needed. Idempotent per (organization_id, name).
INSERT INTO public.products (organization_id, name, description, unit_price, unit, vat_rate, is_active)
SELECT o.id, v.name, v.description, v.unit_price, v.unit, 13, true
FROM public.organizations o
CROSS JOIN (VALUES
  -- Websites
  ('Landing page (CA)', 'Focused campaign/launch landing page (Astro).', 1350, 'ea'),
  ('Business website (CA)', 'Multi-page business website, up to 7 pages (Astro). Own CMS included.', 2700, 'ea'),
  ('Dynamic website / Web app (CA)', 'Login, booking, calculator, customer portal (React).', 7350, 'ea'),
  -- E-commerce (own platform)
  ('E-commerce Start (CA)', 'Own e-commerce platform. Setup — running fee C$225/mo applies.', 2850, 'ea'),
  ('E-commerce Plus (CA)', 'Own e-commerce platform. Setup — running fee C$375/mo applies.', 5250, 'ea'),
  ('E-commerce Pro (CA)', 'Own e-commerce platform. Setup — running fee C$735/mo applies.', 8850, 'ea'),
  ('ERP/accounting integration (CA)', 'E-commerce add-on (ERP/accounting system integration).', 1350, 'ea'),
  ('Extra language & currency (CA)', 'Add-on, per language.', 735, 'ea'),
  -- Product companies
  ('MVP (CA)', 'Validated core feature (React), 4–6 weeks.', 4350, 'ea'),
  ('Web app (CA)', 'Production-ready web application (React).', 7350, 'ea'),
  ('Mobile app (CA)', 'iOS + Android (React Native).', 11850, 'ea'),
  -- Brand
  ('Logo & branding (CA)', 'Logo, colour palette, typography, brand guidelines.', 1800, 'ea'),
  -- SEO
  ('SEO Start (CA)', 'On-page optimization, keyword analysis, monthly report.', 735, 'mo'),
  ('SEO Growth (CA)', 'Content, link building, technical SEO, ongoing optimization.', 1485, 'mo'),
  -- AI visibility (GEO)
  ('AI visibility Start (CA)', 'GEO base optimization, schema markup, monthly report.', 735, 'mo'),
  ('AI visibility Growth (CA)', 'Advanced GEO, content strategy, weekly reporting.', 1335, 'mo'),
  ('AI visibility Dominate (CA)', 'Full optimization, competitor monitoring, dedicated advisor.', 2235, 'mo'),
  ('New AI-optimized website (CA)', 'Website rebuild, add-on to AI visibility.', 2700, 'ea'),
  -- Design partner
  ('Design partner (CA)', 'Ongoing design partner.', 1350, 'mo')
) AS v(name, description, unit_price, unit)
WHERE NOT EXISTS (
  SELECT 1 FROM public.products p
  WHERE p.organization_id = o.id AND p.name = v.name
);
