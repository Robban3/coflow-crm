-- Add 'needs_enrichment' to the enrichment_status check constraint.
-- Imported (light-mode) leads that haven't had their full on-demand analysis yet
-- should read "Måste berikas" (needs enrichment) instead of the red "Misslyckad"
-- (failed) — it is not an error, the heavy analysis simply runs on demand.
ALTER TABLE leads DROP CONSTRAINT leads_enrichment_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_enrichment_status_check
  CHECK (enrichment_status = ANY (ARRAY['pending','processing','ready','failed','skipped','sent','needs_enrichment']));

-- One-time backfill: flip existing prospecting-import leads that were wrongly
-- marked "failed" (by the light-mode status gate) over to "needs_enrichment"
-- so they stop showing as red failures.
UPDATE leads
SET enrichment_status = 'needs_enrichment',
    enrichment_error = NULL
WHERE enrichment_status = 'failed'
  AND imported_via_prospecting = true;
