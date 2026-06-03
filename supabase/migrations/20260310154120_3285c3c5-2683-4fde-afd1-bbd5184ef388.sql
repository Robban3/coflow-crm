
-- Clear queue: set imported_via_prospecting to false for leads that are NOT linked to any sent email
UPDATE leads 
SET imported_via_prospecting = false 
WHERE imported_via_prospecting = true 
  AND enrichment_status IN ('pending', 'processing', 'ready', 'failed', 'skipped')
  AND id NOT IN (SELECT DISTINCT lead_id FROM sent_emails WHERE lead_id IS NOT NULL);

-- Clear drafts: set status to 'rejected' for non-sent drafts
UPDATE prospecting_drafts 
SET status = 'rejected' 
WHERE status IN ('draft', 'approved', 'failed')
  AND lead_id NOT IN (SELECT DISTINCT lead_id FROM sent_emails WHERE lead_id IS NOT NULL);
