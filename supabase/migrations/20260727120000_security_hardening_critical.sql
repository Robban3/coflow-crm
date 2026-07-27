-- ─────────────────────────────────────────────────────────────────────
-- CRITICAL security hardening.
--
-- 1) release_stale_leads was callable by anyone holding the anon key (which
--    ships in the browser bundle) and had no organization filter, so a single
--    POST /rest/v1/rpc/release_stale_leads {"_stale_days": 0} unassigned every
--    open lead in EVERY organization.
-- 2) Creating an organization granted the creator the (global, un-org-scoped)
--    'admin' role, and profiles.organization_id was freely self-writable.
--    Chained, those two gave any authenticated user cross-tenant admin.
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1) release_stale_leads — lock down execution + clamp the window
-- ============================================================================
-- Called only by the nightly pg_cron job, which runs as the job owner and is
-- unaffected by these REVOKEs.
REVOKE EXECUTE ON FUNCTION public.release_stale_leads(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_stale_leads(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.release_stale_leads(integer) FROM authenticated;

-- Defense in depth: even from a privileged context, a zero/negative window
-- would make `created_at < now()` match every row ever created. Clamp it.
CREATE OR REPLACE FUNCTION public.release_stale_leads(_stale_days integer DEFAULT 7)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_released integer;
BEGIN
  IF _stale_days IS NULL OR _stale_days < 1 THEN
    _stale_days := 7;
  END IF;

  WITH stale AS (
    SELECT l.id
    FROM public.leads l
    WHERE l.assigned_to IS NOT NULL
      AND public.lead_is_open(l.lead_status)
      AND l.created_at < now() - make_interval(days => _stale_days)
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
  SET assigned_to = NULL,
      released_at = now(),
      released_reason = 'stale_auto_release'
  FROM stale
  WHERE l.id = stale.id;

  GET DIAGNOSTICS v_released = ROW_COUNT;
  RETURN v_released;
END;
$$;

-- ============================================================================
-- 2a) Organization creation must not hand out global admin
-- ============================================================================
-- `user_roles` has no organization_id — the role is global. Granting it on every
-- organization INSERT meant any authenticated user could elevate themselves
-- inside their EXISTING org simply by creating a throwaway second org.
-- Bootstrap admin only during genuine first-time onboarding.
CREATE OR REPLACE FUNCTION public.handle_organization_created()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_org uuid;
BEGIN
  SELECT organization_id INTO v_existing_org
  FROM public.profiles
  WHERE id = NEW.created_by;

  IF v_existing_org IS NULL OR v_existing_org = NEW.id THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.created_by, 'admin')
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2b) A user must not be able to move themselves between organizations
-- ============================================================================
-- get_user_organization_id() reads profiles.organization_id, and the profiles
-- UPDATE policy only checks `id = auth.uid()` — so rewriting that one column
-- granted read access to another tenant's leads, quotes, profiles and schedules.
-- WITH CHECK cannot see OLD, so this is enforced by trigger.
CREATE OR REPLACE FUNCTION public.prevent_profile_org_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- auth.uid() IS NULL means service_role / SQL editor / trigger context, which
  -- legitimately needs to set organization_id during onboarding and admin moves.
  IF auth.uid() IS NOT NULL
     AND NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id cannot be changed from a user session';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_org_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_org_change
  BEFORE UPDATE OF organization_id ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_profile_org_change();

-- ============================================================================
-- 3) Tighten the remaining blanket-permissive policies
-- ============================================================================
-- realtime.messages was TO authenticated USING (true) for both read and write,
-- letting any signed-in user subscribe to and broadcast on another tenant's
-- channels. Supabase Realtime topics here are org-prefixed, so scope by topic.
DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated can write realtime" ON realtime.messages;

DROP POLICY IF EXISTS "Org members read realtime" ON realtime.messages;
CREATE POLICY "Org members read realtime" ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE public.get_user_organization_id(auth.uid())::text || ':%'
  );

DROP POLICY IF EXISTS "Org members write realtime" ON realtime.messages;
CREATE POLICY "Org members write realtime" ON realtime.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    realtime.topic() LIKE public.get_user_organization_id(auth.uid())::text || ':%'
  );

-- analysis_endpoints is a config/lookup table read by edge functions through the
-- service role; authenticated clients have no reason to enumerate it.
DROP POLICY IF EXISTS "Authenticated can read analysis_endpoints" ON public.analysis_endpoints;
DROP POLICY IF EXISTS "Admins read analysis_endpoints" ON public.analysis_endpoints;
CREATE POLICY "Admins read analysis_endpoints" ON public.analysis_endpoints
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
