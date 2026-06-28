-- Admin-only "test/demo" flag on leads. Lets admins mark leads used in demos so
-- they're hidden from normal lists, the pipeline and statistics (real numbers
-- stay clean). Orthogonal to lead_status, so a demo lead can still go through the
-- whole won/offer flow during a demo.

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_test boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_leads_is_test
  ON public.leads (organization_id, is_test);

-- Only admins may set/clear the flag (enforced at the DB layer, not just the UI).
CREATE OR REPLACE FUNCTION public.admin_set_lead_test(_lead_id uuid, _is_test boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Endast admin kan markera leads som test';
  END IF;

  SELECT organization_id INTO v_org FROM public.leads WHERE id = _lead_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF v_org <> public.get_user_organization_id(auth.uid()) THEN
    RAISE EXCEPTION 'Lead belongs to another organization';
  END IF;

  UPDATE public.leads SET is_test = _is_test WHERE id = _lead_id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_lead_test(uuid, boolean) TO authenticated;
