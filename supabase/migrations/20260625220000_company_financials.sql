-- Financial figures (net revenue / Nettoomsättning) extracted from Bolagsverket
-- digital annual reports (iXBRL). Reference data, keyed on org number + fiscal
-- year so several years per company can be stored. Loaded by a local import
-- script via the service role; readable by all authenticated users.
CREATE TABLE IF NOT EXISTS public.company_financials (
  org_number    text NOT NULL,          -- digits only (e.g. 5560187493)
  fiscal_year   int  NOT NULL,          -- period end year (e.g. 2025)
  period_end    date,
  net_revenue   bigint,                 -- SEK (Nettoomsättning)
  company_name  text,
  source        text NOT NULL DEFAULT 'arsredovisning',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_number, fiscal_year)
);

CREATE INDEX IF NOT EXISTS idx_company_financials_org ON public.company_financials (org_number);
CREATE INDEX IF NOT EXISTS idx_company_financials_revenue ON public.company_financials (net_revenue);
CREATE INDEX IF NOT EXISTS idx_company_financials_year ON public.company_financials (fiscal_year);

ALTER TABLE public.company_financials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view company financials"
  ON public.company_financials FOR SELECT
  USING (auth.uid() IS NOT NULL);
