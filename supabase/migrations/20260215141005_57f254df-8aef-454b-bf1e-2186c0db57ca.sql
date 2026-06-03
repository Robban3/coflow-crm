
-- Drop the recursive public SELECT policy on reports
DROP POLICY IF EXISTS "Public can read reports via enabled share" ON public.reports;

-- Create a security definer function to check if a report has an enabled share
CREATE OR REPLACE FUNCTION public.report_has_enabled_share(_report_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.report_shares
    WHERE report_id = _report_id
      AND enabled = true
  )
$$;

-- Re-create the policy using the function (no cross-table recursion)
CREATE POLICY "Public can read reports via enabled share"
  ON public.reports
  FOR SELECT
  USING (
    public.report_has_enabled_share(id)
    OR organization_id = public.get_user_organization_id(auth.uid())
  );

-- Also drop the original org-only SELECT policy to avoid duplicate/conflicting policies
DROP POLICY IF EXISTS "Users can view reports in their organization" ON public.reports;
