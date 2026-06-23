-- Auto-advance the linked lead's pipeline status when a quote is responded to
-- from the public page: accepted -> won, rejected -> lost. Mirrors the
-- existing public_respond_quote behaviour, just adds the lead status update
-- (SECURITY DEFINER, so it works for the unauthenticated recipient).
CREATE OR REPLACE FUNCTION public.public_respond_quote(
  p_token uuid, p_action text, p_signature_data text DEFAULT NULL
)
RETURNS TABLE (
  quote_id uuid, created_by uuid, recipient_name text, quote_number text,
  document_label text, status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
BEGIN
  IF p_action NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  SELECT * INTO v_quote FROM public.quotes WHERE view_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_quote.status NOT IN ('sent', 'viewed') THEN RETURN; END IF;

  IF p_action = 'accepted' THEN
    UPDATE public.quotes
    SET status = 'accepted', accepted_at = now(),
        recipient_signature_data = COALESCE(p_signature_data, recipient_signature_data),
        recipient_signed_at = CASE WHEN p_signature_data IS NOT NULL THEN now() ELSE recipient_signed_at END
    WHERE id = v_quote.id;
  ELSE
    UPDATE public.quotes SET status = 'rejected', rejected_at = now() WHERE id = v_quote.id;
  END IF;

  -- Move the linked lead to the matching pipeline stage.
  IF v_quote.lead_id IS NOT NULL THEN
    UPDATE public.leads
    SET lead_status = CASE WHEN p_action = 'accepted' THEN 'won' ELSE 'lost' END
    WHERE id = v_quote.lead_id;
  END IF;

  IF v_quote.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_quote.created_by,
      CASE WHEN p_action = 'accepted' THEN 'quote_accepted' ELSE 'quote_rejected' END,
      CASE
        WHEN p_action = 'accepted' THEN CASE WHEN v_quote.document_label = 'avtal' THEN 'Avtal accepterad!' ELSE 'Offert accepterad!' END
        ELSE CASE WHEN v_quote.document_label = 'avtal' THEN 'Avtal avböjd' ELSE 'Offert avböjd' END
      END,
      COALESCE(v_quote.recipient_name, 'Mottagaren') || ' har ' ||
      CASE WHEN p_action = 'accepted' THEN 'accepterat' ELSE 'avböjt' END || ' ' ||
      CASE WHEN v_quote.document_label = 'avtal' THEN 'avtal' ELSE 'offert' END || ' ' || COALESCE(v_quote.quote_number, ''),
      '/quotes',
      jsonb_build_object('quote_id', v_quote.id)
    );
  END IF;

  RETURN QUERY SELECT
    v_quote.id, v_quote.created_by, v_quote.recipient_name, v_quote.quote_number, v_quote.document_label, p_action;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_respond_quote(uuid, text, text) TO anon, authenticated;
