
-- Fix 1: email_replies SELECT - scope to organization
DROP POLICY IF EXISTS "Users see own replies or all if admin" ON public.email_replies;
CREATE POLICY "Users see own org replies"
ON public.email_replies FOR SELECT TO authenticated
USING (organization_id = get_user_organization_id(auth.uid()));

-- Fix 2: organization_invites - scope admin policies to their org
DROP POLICY IF EXISTS "Admins can view all invites" ON public.organization_invites;
DROP POLICY IF EXISTS "Admins can manage invites" ON public.organization_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON public.organization_invites;

CREATE POLICY "Admins can view org invites"
ON public.organization_invites FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Keep public invite code verification
-- "Anyone can verify invite codes" already exists

CREATE POLICY "Admins can create org invites"
ON public.organization_invites FOR INSERT TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can update org invites"
ON public.organization_invites FOR UPDATE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Admins can delete org invites"
ON public.organization_invites FOR DELETE TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Fix 3: lead_members INSERT/DELETE - add org scope to admin check
DROP POLICY IF EXISTS "Admins and lead owners can add members" ON public.lead_members;
DROP POLICY IF EXISTS "Admins and lead owners can delete members" ON public.lead_members;

CREATE POLICY "Admins and lead owners can add members"
ON public.lead_members FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
  OR is_lead_member(lead_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_members.lead_id
      AND l.organization_id = get_user_organization_id(auth.uid())
      AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  )
);

CREATE POLICY "Admins and lead owners can delete members"
ON public.lead_members FOR DELETE TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND organization_id = get_user_organization_id(auth.uid()))
  OR is_lead_member(lead_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_members.lead_id
      AND l.organization_id = get_user_organization_id(auth.uid())
      AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  )
);
