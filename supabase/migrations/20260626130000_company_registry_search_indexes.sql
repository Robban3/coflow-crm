-- The company_registry now holds the full Swedish register (~3M rows). The
-- prospecting register search filters on business_description/city via ILIKE
-- ('%term%') and on registration_date (>= for "newly started"), none of which
-- had a usable index — so every search did a full table scan and hit the
-- statement timeout (HTTP 500). Add the missing indexes:
--   * trigram GIN on business_description — the bransch filter ORs it with
--     sni_descriptions (which already has a trgm index); without one on BOTH
--     branches the OR can't be index-driven.
--   * trigram GIN on city — the existing btree can't serve a leading-wildcard
--     ILIKE; the search matches city with '%term%'.
--   * btree on registration_date — makes the "newly started last N months"
--     (>=) filter selective instead of scanning.
-- pg_trgm is already enabled (see the table's original migration).

CREATE INDEX IF NOT EXISTS idx_company_registry_busdesc_trgm
  ON public.company_registry USING gin (business_description gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_registry_city_trgm
  ON public.company_registry USING gin (city gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_company_registry_registration_date
  ON public.company_registry (registration_date);
