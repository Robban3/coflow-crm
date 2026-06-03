
-- Add progress tracking and error classification columns to geo_quick_scans
ALTER TABLE public.geo_quick_scans 
  ADD COLUMN IF NOT EXISTS progress_step integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS error_code text;
