
-- Drop the overly permissive SELECT policy
DROP POLICY "Users can view tasks in their organization" ON public.tasks;

-- Create new policy: users see only tasks they created or are assigned to; admins see all in org
CREATE POLICY "Users can view own or assigned tasks"
ON public.tasks FOR SELECT
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid()))
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Also fix UPDATE policy so users can only update their own/assigned tasks (admins all)
DROP POLICY "Users can update tasks in their organization" ON public.tasks;

CREATE POLICY "Users can update own or assigned tasks"
ON public.tasks FOR UPDATE
TO authenticated
USING (
  (organization_id = get_user_organization_id(auth.uid()))
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  organization_id = get_user_organization_id(auth.uid())
);
