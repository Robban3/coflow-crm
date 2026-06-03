
-- Fix CRITICAL: sent_emails SELECT policy leaks data across organizations
DROP POLICY IF EXISTS "Users see own emails or all if admin" ON public.sent_emails;

CREATE POLICY "Users see own org emails"
ON public.sent_emails FOR SELECT TO authenticated
USING (
  organization_id = get_user_organization_id(auth.uid())
);
