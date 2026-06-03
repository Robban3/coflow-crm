
-- Create a security definer function to check lead membership without triggering RLS recursion
CREATE OR REPLACE FUNCTION public.is_lead_member(_lead_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.lead_members
    WHERE lead_id = _lead_id AND user_id = _user_id
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and lead owners can manage members" ON public.lead_members;
DROP POLICY IF EXISTS "Admins and lead owners can delete members" ON public.lead_members;
DROP POLICY IF EXISTS "Users can view lead members in their org" ON public.lead_members;

-- Recreate SELECT policy
CREATE POLICY "Users can view lead members in their org"
ON public.lead_members FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_members.lead_id
    AND l.organization_id = get_user_organization_id(auth.uid())
  )
);

-- Recreate INSERT policy using security definer function
CREATE POLICY "Admins and lead owners can add members"
ON public.lead_members FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_lead_member(lead_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_members.lead_id
    AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  )
);

-- Recreate DELETE policy using security definer function
CREATE POLICY "Admins and lead owners can delete members"
ON public.lead_members FOR DELETE TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR is_lead_member(lead_id, auth.uid())
  OR EXISTS (
    SELECT 1 FROM leads l
    WHERE l.id = lead_members.lead_id
    AND (l.assigned_to = auth.uid() OR l.created_by = auth.uid())
  )
);
