-- Return-to-pool: when a lead does not turn into a deal it goes back to a shared
-- pool so another salesperson can pick it up, while ALL history (calls, notes,
-- emails, tasks) stays attached to the lead and becomes visible to the next
-- owner (already handled by can_access_lead once they are assigned).
--
-- Decisions (from product owner):
--   * Trigger: auto-release when a lead is set to 'lost' or 'not_interested',
--     AND an explicit "Tillbaka till poolen" action.
--   * Cooldown: after release the lead is frozen for N days (default 14) — not
--     claimable by anyone, which both protects the prospect from being called
--     again immediately and stops the releasing seller from grabbing it back.
--     After the cooldown it becomes claimable by anyone in the org.
--   * Discovery: released+cooldown-elapsed leads become visible to the whole org
--     (in the existing leads list) so they can be claimed.
--
-- Requires `supabase db push`.

-- ============================================================================
-- 1) RELEASE BOOKKEEPING ON LEADS + CONFIGURABLE COOLDOWN
-- ============================================================================
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid,
  ADD COLUMN IF NOT EXISTS released_reason text;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS lead_pool_cooldown_days integer NOT NULL DEFAULT 14;

-- Fast lookup of the claimable pool within an org.
CREATE INDEX IF NOT EXISTS idx_leads_pool_available
  ON public.leads (organization_id, released_at)
  WHERE assigned_to IS NULL AND released_at IS NOT NULL;

-- ============================================================================
-- 2) AUTO-RELEASE WHEN A LEAD IS SET TO A "NO DEAL" STATUS
--    BEFORE trigger so we can clear assigned_to in-place (no recursion). It only
--    listens on lead_status, so it never collides with enforce_lead_assignment_
--    rules (which fires on UPDATE OF assigned_to).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.auto_release_lead_on_no_deal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.lead_status IN ('lost', 'not_interested')
     AND OLD.lead_status IS DISTINCT FROM NEW.lead_status
     AND NEW.released_at IS NULL
  THEN
    NEW.released_by := COALESCE(OLD.assigned_to, OLD.created_by);
    NEW.released_at := now();
    NEW.released_reason := COALESCE(
      NULLIF(NEW.released_reason, ''),
      NULLIF(NEW.not_interested_reason, ''),
      'Markerad som ' || NEW.lead_status
    );
    NEW.assigned_to := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_release_lead_on_no_deal ON public.leads;
CREATE TRIGGER auto_release_lead_on_no_deal
  BEFORE UPDATE OF lead_status ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.auto_release_lead_on_no_deal();

-- ============================================================================
-- 3) EXPLICIT "RETURN TO POOL" ACTION
-- ============================================================================
CREATE OR REPLACE FUNCTION public.release_lead_to_pool(_lead_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.can_access_lead(_lead_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to release this lead';
  END IF;

  UPDATE public.leads l
  SET assigned_to = NULL,
      released_by = COALESCE(l.assigned_to, l.created_by),
      released_at = now(),
      released_reason = NULLIF(_reason, '')
  WHERE l.id = _lead_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_lead_to_pool(uuid, text) TO authenticated;

-- ============================================================================
-- 4) CLAIM A LEAD FROM THE POOL (after the cooldown)
--    Atomic: the WHERE guard prevents two sellers from claiming the same lead,
--    and enforces that the cooldown has elapsed. The per-user cap and self-claim
--    rules are still enforced by enforce_lead_assignment_rules (assigned_to is
--    set to auth.uid() here, which a non-admin is allowed to do).
-- ============================================================================
CREATE OR REPLACE FUNCTION public.claim_pool_lead(_lead_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_released_at timestamptz;
  v_cooldown integer;
  v_available_at timestamptz;
  v_updated integer;
BEGIN
  SELECT organization_id, released_at INTO v_org, v_released_at
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

  SELECT COALESCE(lead_pool_cooldown_days, 14) INTO v_cooldown
  FROM public.organizations WHERE id = v_org;
  v_available_at := v_released_at + make_interval(days => COALESCE(v_cooldown, 14));

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

-- ============================================================================
-- 5) POOL VISIBILITY: org members may see released leads once the cooldown has
--    elapsed (so they appear in the leads list and can be claimed). Private
--    ownership is otherwise unchanged.
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own leads" ON public.leads;
CREATE POLICY "Users can view own leads"
ON public.leads FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.is_lead_member(id, auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      assigned_to IS NULL
      AND released_at IS NOT NULL
      AND released_at <= now() - make_interval(days => COALESCE(
        (SELECT o.lead_pool_cooldown_days FROM public.organizations o WHERE o.id = organization_id),
        14))
    )
  )
);
