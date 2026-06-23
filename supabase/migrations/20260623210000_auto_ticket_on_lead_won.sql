-- Couple a won deal to a ticket under "Ärenden".
-- This mirrors the existing trg_auto_ticket_on_doc_accept trigger (which only
-- fires for the `documents` offer system) so that EVERY won path also creates a
-- sales ticket: the quote editor "mark won" (sets leads.lead_status = 'won'),
-- the pipeline drag to the "won" column, and the public quote accept
-- (public_respond_quote, which sets the linked lead to 'won').
--
-- One trigger on `leads` covers all of those with exactly one ticket. It does
-- not collide with the documents trigger: that one is keyed off document_id,
-- this one off lead_id, and they fire on different tables.
CREATE OR REPLACE FUNCTION public.auto_create_ticket_on_lead_won()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_status = 'won' AND OLD.lead_status IS DISTINCT FROM 'won' THEN
    -- Avoid duplicates if a ticket for this lead already exists.
    IF NOT EXISTS (
      SELECT 1 FROM public.tickets
      WHERE lead_id = NEW.id AND type = 'sales'
    ) THEN
      INSERT INTO public.tickets (
        organization_id, title, description, type, status, priority,
        created_by, customer_id, lead_id
      )
      VALUES (
        NEW.organization_id,
        'Ny affär vunnen: ' || COALESCE(NEW.company_name, 'Lead'),
        'Automatiskt skapat ärende för en vunnen affär.',
        'sales',
        'new',
        'high',
        COALESCE(NEW.assigned_to, NEW.created_by),
        NEW.converted_to_customer_id,
        NEW.id
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_ticket_on_lead_won ON public.leads;
CREATE TRIGGER trg_auto_ticket_on_lead_won
  AFTER UPDATE ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_ticket_on_lead_won();
