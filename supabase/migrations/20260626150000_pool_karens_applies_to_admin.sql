-- Make the pool karens (cooldown) apply to admins too.
--
-- The cooldown is enforced inside claim_pool_lead, but an admin could sidestep
-- it by assigning a pooled lead directly (admins are allowed to assign leads to
-- anyone). claim_pool_lead assigns AND clears released_at in the same statement,
-- so a legitimate claim leaves released_at NULL; a direct assignment leaves it
-- set. Block any assignment that leaves released_at set — that is the bypass —
-- forcing everyone (admins included) through claim_pool_lead, where the 14/30-day
-- cooldown is checked. Service-role/system writes (auth.uid() IS NULL) are
-- exempt, as before, so cron release/claim helpers keep working.

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
    -- Pooled leads can only be taken via claim_pool_lead (which clears
    -- released_at and enforces the cooldown). A direct assignment that leaves
    -- released_at set is the admin bypass — block it so the karens applies to
    -- everyone, admins included.
    IF NEW.released_at IS NOT NULL THEN
      RAISE EXCEPTION 'Lead är i poolen – använd "Plocka upp" för att ta det (karens gäller)';
    END IF;

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
