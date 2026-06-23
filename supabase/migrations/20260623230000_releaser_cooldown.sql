-- Longer cooldown for the seller who released the lead: they must wait longer
-- than everyone else before they can reclaim it, which forces real sharing.
--   * Others:            lead_pool_cooldown_days          (default 14)
--   * The releasing seller: lead_pool_releaser_cooldown_days (default 30)
--
-- Requires `supabase db push`.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lead_pool_releaser_cooldown_days integer NOT NULL DEFAULT 30;

CREATE OR REPLACE FUNCTION public.claim_pool_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_released_at timestamptz;
  v_released_by uuid;
  v_cooldown integer;
  v_releaser_cooldown integer;
  v_available_at timestamptz;
  v_updated integer;
BEGIN
  SELECT organization_id, released_at, released_by
    INTO v_org, v_released_at, v_released_by
  FROM public.leads WHERE id = _lead_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  IF v_org <> public.get_user_organization_id(auth.uid()) THEN
    RAISE EXCEPTION 'Lead belongs to another organization';
  END IF;
  IF v_released_at IS NULL THEN
    RAISE EXCEPTION 'This lead is not in the pool';
  END IF;

  SELECT COALESCE(lead_pool_cooldown_days, 14),
         COALESCE(lead_pool_releaser_cooldown_days, 30)
    INTO v_cooldown, v_releaser_cooldown
  FROM public.organizations WHERE id = v_org;

  -- The seller who released the lead waits a longer cooldown than others.
  IF v_released_by IS NOT NULL AND v_released_by = auth.uid() THEN
    v_available_at := v_released_at + make_interval(days => COALESCE(v_releaser_cooldown, 30));
  ELSE
    v_available_at := v_released_at + make_interval(days => COALESCE(v_cooldown, 14));
  END IF;

  IF now() < v_available_at THEN
    RAISE EXCEPTION 'Lead is in cooldown until %', to_char(v_available_at, 'YYYY-MM-DD');
  END IF;

  -- Claim it: assign to the caller, reactivate, and clear all release/no-deal
  -- markers. History stays attached to the lead.
  UPDATE public.leads
  SET assigned_to = auth.uid(),
      lead_status = 'active',
      released_at = NULL,
      released_by = NULL,
      released_reason = NULL,
      is_not_interested = false,
      not_interested_at = NULL,
      not_interested_reason = NULL
  WHERE id = _lead_id
    AND assigned_to IS NULL
    AND released_at IS NOT NULL;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated = 0 THEN
    RAISE EXCEPTION 'Lead was already claimed by someone else';
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.claim_pool_lead(uuid) TO authenticated;
