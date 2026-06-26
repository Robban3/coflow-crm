-- When a lead is returned to the pool, the reason was only stored in the hidden
-- leads.released_reason column (shown in the pool list) — it never appeared in
-- the lead's notes/timeline, so the next owner couldn't read WHY it was let go.
-- Writing a reason was meant to be a requirement for releasing; make it visible.
--
-- Record the release reason as a readable note (activities, type 'note') on both
-- release paths: the explicit "Tillbaka till poolen" action and the auto-release
-- when a lead is marked lost / not_interested. History follows the lead, so the
-- note is visible to whoever claims it next.

-- 1) Explicit release ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.release_lead_to_pool(_lead_id uuid, _reason text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_releaser uuid;
BEGIN
  IF NOT public.can_access_lead(_lead_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed to release this lead';
  END IF;

  UPDATE public.leads l
  SET assigned_to = NULL,
      released_by = COALESCE(l.assigned_to, l.created_by),
      released_at = now(),
      released_reason = NULLIF(_reason, '')
  WHERE l.id = _lead_id
  RETURNING organization_id, released_by INTO v_org, v_releaser;

  IF NULLIF(_reason, '') IS NOT NULL THEN
    INSERT INTO public.activities (lead_id, organization_id, user_id, type, title, description, completed_at)
    VALUES (_lead_id, v_org, COALESCE(v_releaser, auth.uid()), 'note',
            'Lead släppt till poolen', _reason, now());
  END IF;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_lead_to_pool(uuid, text) TO authenticated;

-- 2) Auto-release on a "no deal" status --------------------------------------
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

    INSERT INTO public.activities (lead_id, organization_id, user_id, type, title, description, completed_at)
    VALUES (NEW.id, NEW.organization_id, NEW.released_by, 'note',
            'Lead återförd till poolen', NEW.released_reason, now());
  END IF;
  RETURN NEW;
END;
$$;
