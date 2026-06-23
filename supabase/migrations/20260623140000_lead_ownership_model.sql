-- Lead ownership model: private leads, capped self-claim, admin-only reassign,
-- and automatic release of stale (un-worked) leads back to the pool.
--
-- Decisions (from product owner):
--   * Leads are PRIVATE: a user sees only their own (created_by / assigned_to /
--     lead member); admins see all in the org. (Reverts the earlier org-wide
--     leads SELECT from 20260623120000.)
--   * Only admins may assign a lead to ANOTHER user. A normal user may claim an
--     unassigned lead to themselves (self-claim), subject to a cap.
--   * Anti-hoarding: a per-user cap on OPEN assigned leads, plus auto-release of
--     assigned leads with no activity for 7 days.
--
-- Requires `supabase db push`.

-- ============================================================================
-- 1) LEADS PRIVATE AGAIN (revert org-wide SELECT)
-- ============================================================================
DROP POLICY IF EXISTS "Users can view leads in their organization" ON public.leads;
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
  )
);

-- ============================================================================
-- 2) CONFIGURABLE CAP (per organization)
-- ============================================================================
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS max_open_leads_per_user integer NOT NULL DEFAULT 50;

-- Which lead_status values count as "open" (still being worked). Everything not
-- in this closed set is treated as open. Adjust the closed set as needed.
CREATE OR REPLACE FUNCTION public.lead_is_open(_status text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(_status, 'active') NOT IN (
    'won', 'lost', 'closed', 'not_interested', 'customer', 'archived', 'converted'
  );
$$;

-- ============================================================================
-- 3) ASSIGNMENT RULES (admin-only reassign + cap) via a BEFORE trigger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_lead_assignment_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer;
  v_open_count integer;
BEGIN
  -- System / service-role writes (no JWT) bypass these app-level rules.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only act when assigned_to is being set or changed to a non-null user.
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to)
  THEN
    -- Admin-only reassignment: a non-admin may only claim a lead to THEMSELVES.
    IF NEW.assigned_to <> auth.uid()
       AND NOT public.has_role(auth.uid(), 'admin'::app_role)
    THEN
      RAISE EXCEPTION 'Only admins can assign a lead to another user';
    END IF;

    -- Cap: the target user may not exceed max_open_leads_per_user OPEN leads.
    SELECT COALESCE(max_open_leads_per_user, 50) INTO v_cap
    FROM public.organizations
    WHERE id = NEW.organization_id;

    SELECT count(*) INTO v_open_count
    FROM public.leads l
    WHERE l.assigned_to = NEW.assigned_to
      AND l.id <> NEW.id
      AND public.lead_is_open(l.lead_status);

    IF v_open_count >= COALESCE(v_cap, 50) THEN
      RAISE EXCEPTION 'Lead cap reached: this user already has % open leads (max %)',
        v_open_count, COALESCE(v_cap, 50);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_lead_assignment_rules ON public.leads;
CREATE TRIGGER enforce_lead_assignment_rules
  BEFORE INSERT OR UPDATE OF assigned_to ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lead_assignment_rules();

-- ============================================================================
-- 4) AUTO-RELEASE STALE LEADS (no activity for 7 days -> back to the pool)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.release_stale_leads(_stale_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  WITH stale AS (
    SELECT l.id
    FROM public.leads l
    WHERE l.assigned_to IS NOT NULL
      AND public.lead_is_open(l.lead_status)
      -- grace period: don't release very freshly assigned/created leads
      AND l.created_at < now() - make_interval(days => _stale_days)
      -- no recent activity of any kind
      AND NOT EXISTS (
        SELECT 1 FROM public.activities a
        WHERE a.lead_id = l.id AND a.created_at >= now() - make_interval(days => _stale_days)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.call_logs c
        WHERE c.lead_id = l.id AND c.created_at >= now() - make_interval(days => _stale_days)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.sent_emails e
        WHERE e.lead_id = l.id AND e.created_at >= now() - make_interval(days => _stale_days)
      )
  )
  UPDATE public.leads l
  SET assigned_to = NULL
  FROM stale
  WHERE l.id = stale.id;

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- Schedule it daily at 03:00 if pg_cron is available. If pg_cron is not enabled
-- on this project, this block is skipped — call public.release_stale_leads()
-- from a scheduled Supabase Edge Function instead.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('release-stale-leads')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'release-stale-leads');
    PERFORM cron.schedule('release-stale-leads', '0 3 * * *',
      $cron$ SELECT public.release_stale_leads(7); $cron$);
  END IF;
END $$;

-- ============================================================================
-- 5) PROSPECTING: expose which pool companies are already claimed (+ owner)
--    so the prospecting UI can grey them out. Leads stay private; this only
--    reveals the claimed status + owner name within the caller's org.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_pool_claim_status()
RETURNS TABLE (lead_pool_id uuid, owner_id uuid, owner_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (l.lead_pool_id)
    l.lead_pool_id,
    COALESCE(l.assigned_to, l.created_by) AS owner_id,
    p.full_name AS owner_name
  FROM public.leads l
  LEFT JOIN public.profiles p ON p.id = COALESCE(l.assigned_to, l.created_by)
  WHERE l.organization_id = public.get_user_organization_id(auth.uid())
    AND l.lead_pool_id IS NOT NULL
  ORDER BY l.lead_pool_id, l.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_pool_claim_status() TO authenticated;
