-- Harden public token flows for quotes/documents and remove broad anon policies.
DROP POLICY IF EXISTS "Public view quote by token" ON public.quotes;
DROP POLICY IF EXISTS "Public update quote status via token" ON public.quotes;
DROP POLICY IF EXISTS "Public view quote items via quote" ON public.quote_items;
DROP POLICY IF EXISTS "Public can view document by token" ON public.documents;
DROP POLICY IF EXISTS "Public can view blocks by document token" ON public.document_blocks;
DROP POLICY IF EXISTS "Public insert quote notifications" ON public.notifications;

CREATE OR REPLACE FUNCTION public.public_get_quote_by_token(p_token uuid)
RETURNS SETOF public.quotes
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT q.* FROM public.quotes q WHERE q.view_token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.public_get_quote_items_by_token(p_token uuid)
RETURNS SETOF public.quote_items
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT qi.* FROM public.quotes q
  JOIN public.quote_items qi ON qi.quote_id = q.id
  WHERE q.view_token = p_token
  ORDER BY qi.sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.public_track_quote_view(p_token uuid)
RETURNS TABLE (
  quote_id uuid, created_by uuid, recipient_name text, quote_number text,
  document_label text, status text, is_first_view boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_quote public.quotes%ROWTYPE;
BEGIN
  SELECT * INTO v_quote FROM public.quotes WHERE view_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.quotes
  SET viewed_at = now(),
      view_count = COALESCE(view_count, 0) + 1,
      status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE id = v_quote.id;

  IF COALESCE(v_quote.view_count, 0) = 0 AND v_quote.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_quote.created_by, 'quote_viewed',
      CASE WHEN v_quote.document_label = 'avtal' THEN 'Avtal öppnad' ELSE 'Offert öppnad' END,
      COALESCE(v_quote.recipient_name, 'Mottagaren') || ' har öppnat ' ||
      CASE WHEN v_quote.document_label = 'avtal' THEN 'avtal' ELSE 'offert' END || ' ' || COALESCE(v_quote.quote_number, ''),
      '/quotes',
      jsonb_build_object('quote_id', v_quote.id)
    );
  END IF;

  RETURN QUERY SELECT
    v_quote.id, v_quote.created_by, v_quote.recipient_name, v_quote.quote_number, v_quote.document_label,
    CASE WHEN v_quote.status = 'sent' THEN 'viewed' ELSE v_quote.status END,
    (COALESCE(v_quote.view_count, 0) = 0);
END;
$$;

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

  IF v_quote.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_quote.created_by,
      CASE WHEN p_action = 'accepted' THEN 'quote_accepted' ELSE 'quote_rejected' END,
      CASE
        WHEN p_action = 'accepted' THEN CASE WHEN v_quote.document_label = 'avtal' THEN 'Avtal accepterad! 🎉' ELSE 'Offert accepterad! 🎉' END
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

CREATE OR REPLACE FUNCTION public.public_get_document_by_token(p_token uuid)
RETURNS SETOF public.documents
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT d.* FROM public.documents d WHERE d.view_token = p_token LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.public_get_document_blocks_by_token(p_token uuid)
RETURNS SETOF public.document_blocks
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT db.* FROM public.documents d
  JOIN public.document_blocks db ON db.document_id = d.id
  WHERE d.view_token = p_token
  ORDER BY db.sort_order ASC;
$$;

CREATE OR REPLACE FUNCTION public.public_track_document_view(p_token uuid)
RETURNS TABLE (
  document_id uuid, created_by uuid, recipient_name text, title text,
  status text, is_first_view boolean
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc public.documents%ROWTYPE;
BEGIN
  SELECT * INTO v_doc FROM public.documents WHERE view_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;

  UPDATE public.documents
  SET viewed_at = now(),
      view_count = COALESCE(view_count, 0) + 1,
      status = CASE WHEN status = 'sent' THEN 'viewed' ELSE status END
  WHERE id = v_doc.id;

  IF COALESCE(v_doc.view_count, 0) = 0 AND v_doc.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_doc.created_by, 'offer_viewed', 'Offert öppnad',
      COALESCE(v_doc.recipient_name, 'Mottagaren') || ' har öppnat offert "' || COALESCE(v_doc.title, '') || '"',
      '/offers',
      jsonb_build_object('document_id', v_doc.id)
    );
  END IF;

  RETURN QUERY SELECT
    v_doc.id, v_doc.created_by, v_doc.recipient_name, v_doc.title,
    CASE WHEN v_doc.status = 'sent' THEN 'viewed' ELSE v_doc.status END,
    (COALESCE(v_doc.view_count, 0) = 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_respond_document(
  p_token uuid, p_action text, p_signature_data text DEFAULT NULL
)
RETURNS TABLE (
  document_id uuid, created_by uuid, recipient_name text, title text, status text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_doc public.documents%ROWTYPE;
BEGIN
  IF p_action NOT IN ('accepted', 'rejected') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  SELECT * INTO v_doc FROM public.documents WHERE view_token = p_token FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_doc.status NOT IN ('sent', 'viewed') THEN RETURN; END IF;

  IF p_action = 'accepted' THEN
    UPDATE public.documents
    SET status = 'accepted', accepted_at = now(), signature_status = 'signed',
        recipient_signature_data = COALESCE(p_signature_data, recipient_signature_data),
        recipient_signed_at = CASE WHEN p_signature_data IS NOT NULL THEN now() ELSE recipient_signed_at END
    WHERE id = v_doc.id;
  ELSE
    UPDATE public.documents SET status = 'rejected', rejected_at = now() WHERE id = v_doc.id;
  END IF;

  IF v_doc.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
    VALUES (
      v_doc.created_by,
      CASE WHEN p_action = 'accepted' THEN 'offer_accepted' ELSE 'offer_rejected' END,
      CASE WHEN p_action = 'accepted' THEN 'Offert accepterad! 🎉' ELSE 'Offert avböjd' END,
      COALESCE(v_doc.recipient_name, 'Mottagaren') || ' har ' ||
      CASE WHEN p_action = 'accepted' THEN 'accepterat' ELSE 'avböjt' END || ' offert "' || COALESCE(v_doc.title, '') || '"',
      '/offers',
      jsonb_build_object('document_id', v_doc.id)
    );
  END IF;

  RETURN QUERY SELECT
    v_doc.id, v_doc.created_by, v_doc.recipient_name, v_doc.title, p_action;
END;
$$;

GRANT EXECUTE ON FUNCTION public.public_get_quote_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_quote_items_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_track_quote_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_respond_quote(uuid, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_document_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_get_document_blocks_by_token(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_track_document_view(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_respond_document(uuid, text, text) TO anon, authenticated;