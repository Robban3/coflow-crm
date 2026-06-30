-- Admin-only hard delete of a deal: removes the lead and all its sales
-- artefacts (offer documents, quotes, tickets, deal handoff, sent emails).
-- Used to clean up test deals that linger both as offers and as won deals.
--
-- The whole thing runs in one transaction, so a failure rolls everything back —
-- no partial deletes. Child rows are removed in FK-safe order: the tables that
-- reference leads / documents with NO ON DELETE action are cleared first; the
-- remaining references to leads use ON DELETE CASCADE / SET NULL and clean up
-- automatically when the lead row goes.

CREATE OR REPLACE FUNCTION public.admin_delete_deal(_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Endast admin kan radera affärer';
  END IF;

  SELECT organization_id INTO v_org FROM public.leads WHERE id = _lead_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF v_org <> public.get_user_organization_id(auth.uid()) THEN
    RAISE EXCEPTION 'Lead belongs to another organization';
  END IF;

  -- FK-safe order: deal_handoffs (references quotes) → sent_emails → tickets
  -- (references documents) → documents → quotes → lead.
  DELETE FROM public.deal_handoffs WHERE lead_id = _lead_id;
  DELETE FROM public.sent_emails WHERE lead_id = _lead_id;
  DELETE FROM public.tickets WHERE lead_id = _lead_id;
  DELETE FROM public.documents WHERE lead_id = _lead_id;
  DELETE FROM public.quotes WHERE lead_id = _lead_id;

  DELETE FROM public.leads WHERE id = _lead_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_delete_deal(uuid) TO authenticated;

-- Tighten legacy quotes DELETE to admin-only (was: any org member could delete).
-- Offer deletion from the UI is an admin action, matching the documents policy.
DROP POLICY IF EXISTS "Users delete own org quotes" ON public.quotes;
CREATE POLICY "Admins delete org quotes" ON public.quotes
FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);
