-- Admin-only: revert a test deal/offer back to a normal lead.
--
-- "Affär" = leads.lead_status = 'won' (auto-creates a sales ticket + optional
-- deal_handoffs row); "offert" = documents/quotes rows. This RPC, restricted to
-- admins, cleans up those artefacts and resets the lead to a plain active lead:
--   * delete the lead's offers/agreements (documents + quotes; children cascade)
--   * delete the auto-created sales ticket(s) for the deal
--   * delete deal_handoffs rows for the lead
--   * reset lead_status to 'active' (ownership/history preserved)
-- SECURITY DEFINER so it can clean up regardless of row-level policies; the admin
-- check and org check are enforced explicitly.

CREATE OR REPLACE FUNCTION public.admin_revert_deal_to_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_doc_ids uuid[];
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Endast admin kan återställa en affär till lead';
  END IF;

  SELECT organization_id INTO v_org FROM public.leads WHERE id = _lead_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF v_org <> public.get_user_organization_id(auth.uid()) THEN
    RAISE EXCEPTION 'Lead belongs to another organization';
  END IF;

  -- The lead's offer documents (for clearing the no-cascade ticket FK below).
  SELECT array_agg(id) INTO v_doc_ids FROM public.documents WHERE lead_id = _lead_id;

  -- Remove the auto-created sales ticket(s); clear any remaining ticket→document
  -- FK before deleting the documents (tickets.document_id has no ON DELETE rule).
  DELETE FROM public.tickets WHERE lead_id = _lead_id AND type = 'sales';
  IF v_doc_ids IS NOT NULL THEN
    UPDATE public.tickets SET document_id = NULL WHERE document_id = ANY(v_doc_ids);
  END IF;

  -- Delete the offers/agreements (document_blocks/recipients and quote_items
  -- cascade; deal_handoffs.quote_id is ON DELETE SET NULL).
  DELETE FROM public.documents WHERE lead_id = _lead_id;
  DELETE FROM public.quotes WHERE lead_id = _lead_id;

  -- Drop the deal handoff record(s).
  DELETE FROM public.deal_handoffs WHERE lead_id = _lead_id;

  -- Reset to a normal active lead (keep assigned_to / created_by / history).
  UPDATE public.leads
  SET lead_status = 'active',
      is_not_interested = false,
      not_interested_at = NULL,
      not_interested_reason = NULL
  WHERE id = _lead_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revert_deal_to_lead(uuid) TO authenticated;
