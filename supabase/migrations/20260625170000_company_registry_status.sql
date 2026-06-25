-- Surface company status (e.g. "Avregistrerad") from Bolagsverket. The
-- värdefulla-datamängder client already computes it (Avregistrerad / Aktiv /
-- Ej verksam) but auto-enrich-lead dropped it because the column didn't exist.
ALTER TABLE public.company_registry ADD COLUMN IF NOT EXISTS status text;
