-- Lets any org member discover who the admins are (ids only), so the task
-- assignee picker can be limited to "admins + yourself". Regular users cannot
-- read other users' rows in user_roles (RLS), hence this SECURITY DEFINER
-- helper, scoped to the caller's organization.
CREATE OR REPLACE FUNCTION public.get_org_admin_ids()
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ur.user_id
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  WHERE ur.role = 'admin'::app_role
    AND p.organization_id = public.get_user_organization_id(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_org_admin_ids() TO authenticated;
