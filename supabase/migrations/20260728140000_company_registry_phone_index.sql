-- Enable searching the company registry by phone number. company_name already
-- has a trigram index; phone did not, so an ILIKE '%digits%' phone lookup was a
-- full scan. Add a trigram GIN index so phone search stays fast.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_company_registry_phone_trgm
  ON public.company_registry USING gin (phone gin_trgm_ops);
