-- Admins (and lead owners/members) must be able to update any lead they can
-- access — including dragging cards between pipeline stages. The previous
-- WITH CHECK only allowed creator/assignee/lead-member, so admins hit RLS 403s
-- moving leads they don't personally own. Use can_access_lead (which now
-- includes admins) for both USING and WITH CHECK.
DROP POLICY IF EXISTS "Users can update own leads" ON public.leads;
CREATE POLICY "Users can update own leads"
ON public.leads FOR UPDATE TO authenticated
USING (public.can_access_lead(id, auth.uid()))
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.can_access_lead(id, auth.uid())
);
