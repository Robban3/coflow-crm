-- Uppdatera INSERT-policy för email_replies till att kräva organization_id matchning
-- Detta är säkrare och webhook använder service_role key som kringgår RLS
DROP POLICY IF EXISTS "Service role can insert replies" ON public.email_replies;

-- Ny policy: Endast authenticated users kan infoga för sin organisation
CREATE POLICY "Users can insert replies in their organization"
ON public.email_replies FOR INSERT
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
);