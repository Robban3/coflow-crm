
-- Allow admin users to INSERT into company_registry
CREATE POLICY "Admins can insert company_registry"
ON public.company_registry
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow admin users to UPDATE company_registry
CREATE POLICY "Admins can update company_registry"
ON public.company_registry
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);
