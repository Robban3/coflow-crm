-- Admins must be able to act on any lead in their org (log calls/callbacks,
-- activities, tasks), matching the fact that they can already *see* every lead.
-- can_access_lead() previously only granted creator/assignee/lead-member, so
-- admins hit RLS 403s inserting tasks/call_logs/activities on leads they don't
-- personally own. Add an admin branch.
CREATE OR REPLACE FUNCTION public.can_access_lead(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.leads l
    WHERE l.id = _lead_id
      AND l.organization_id = public.get_user_organization_id(_user_id)
      AND (
        l.created_by = _user_id
        OR l.assigned_to = _user_id
        OR public.is_lead_member(l.id, _user_id)
        OR public.has_role(_user_id, 'admin'::app_role)
      )
  );
$$;
