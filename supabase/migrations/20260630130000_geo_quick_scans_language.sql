-- Persist the creator's UI language on each quick scan so the async run, the
-- emailed mini-report and the public view all render in the right language.
ALTER TABLE public.geo_quick_scans
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'sv';
