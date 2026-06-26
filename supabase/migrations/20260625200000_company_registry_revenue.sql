-- Company turnover (omsättning). Not available from Bolagsverket's API, so it is
-- scraped best-effort from allabolag.se during enrichment. Stored as a display
-- string (e.g. "12 345 tkr").
ALTER TABLE public.company_registry ADD COLUMN IF NOT EXISTS revenue text;
