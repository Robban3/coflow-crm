
-- Add status column to sent_emails for draft support
ALTER TABLE sent_emails ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'
  CHECK (status IN ('draft', 'sent', 'failed'));

-- Create webhook trigger function for auto-enrich
CREATE OR REPLACE FUNCTION public.trigger_auto_enrich_lead()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  edge_url TEXT;
  service_key TEXT;
BEGIN
  edge_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- Use pg_net to call the edge function asynchronously
  PERFORM net.http_post(
    url := COALESCE(edge_url, 'https://odtiprpcpwkpbpbvljfw.supabase.co') || '/functions/v1/auto-enrich-lead',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_key, current_setting('supabase.service_role_key', true))
    ),
    body := jsonb_build_object('lead_id', NEW.id, 'trigger', 'insert')
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block lead insertion due to enrichment failures
  RAISE WARNING 'auto-enrich trigger failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_auto_enrich_lead ON leads;
CREATE TRIGGER trg_auto_enrich_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_enrich_lead();
