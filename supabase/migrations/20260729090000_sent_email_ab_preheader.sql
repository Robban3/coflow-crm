-- A/B subject testing + preheader for outbound emails.
-- subject_variant records which subject line was actually sent ('a' | 'b'),
-- so open-rate can be compared per variant. preheader stores the preview text.
ALTER TABLE public.sent_emails
  ADD COLUMN IF NOT EXISTS subject_variant text,   -- 'a' | 'b' | null (legacy)
  ADD COLUMN IF NOT EXISTS preheader text;

-- Persisted drafts carry the second subject + preheader so the eventual send
-- can still A/B and set the preview (generation and send happen in separate steps).
ALTER TABLE public.prospecting_drafts
  ADD COLUMN IF NOT EXISTS subject_b text,
  ADD COLUMN IF NOT EXISTS preheader text;

ALTER TABLE public.sequence_step_executions
  ADD COLUMN IF NOT EXISTS generated_subject_b text,
  ADD COLUMN IF NOT EXISTS generated_preheader text;
