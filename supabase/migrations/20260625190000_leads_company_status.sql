-- Carry the official company status (Avregistrerad / Aktiv / Ej verksam) on the
-- lead itself so prospecting lists can flag/filter deregistered companies
-- without joining company_registry. Populated by auto-enrich-lead and the
-- backfill function.
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS company_status text;
