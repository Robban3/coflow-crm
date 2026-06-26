-- Fiscal year for the scraped revenue figure, so the lead card can show e.g.
-- "2024" above "34 621 tkr".
ALTER TABLE public.company_registry ADD COLUMN IF NOT EXISTS revenue_year text;
