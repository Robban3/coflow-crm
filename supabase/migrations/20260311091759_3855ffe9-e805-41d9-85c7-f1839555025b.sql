-- Add 'sent' to enrichment_status check constraint
ALTER TABLE leads DROP CONSTRAINT leads_enrichment_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_enrichment_status_check 
  CHECK (enrichment_status = ANY (ARRAY['pending','processing','ready','failed','skipped','sent']));

-- Fix existing stuck leads: mark as 'sent' if they already have sent emails
UPDATE leads 
SET enrichment_status = 'sent' 
WHERE imported_via_prospecting = true 
  AND enrichment_status = 'ready' 
  AND id IN (SELECT DISTINCT lead_id FROM sent_emails WHERE lead_id IS NOT NULL);