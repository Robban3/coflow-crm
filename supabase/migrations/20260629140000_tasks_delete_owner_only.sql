-- Only the task's owner (created_by or assigned_to) may delete it — NOT admins.
-- Tightens the previous policy that also let admins delete any task.

DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can delete own tasks"
ON public.tasks FOR DELETE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
  )
);
