-- Fix function search_path issue for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Drop overly permissive policies and create more secure ones

-- Fix customers UPDATE policy (currently uses USING (true))
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
CREATE POLICY "Team members can update customers"
  ON public.customers FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Fix tasks UPDATE policy (currently uses USING (true))
DROP POLICY IF EXISTS "Authenticated users can update tasks" ON public.tasks;
CREATE POLICY "Assigned users can update tasks"
  ON public.tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    assigned_to = auth.uid() 
    OR created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );

-- Fix leads UPDATE policy (currently uses USING (true))
DROP POLICY IF EXISTS "Authenticated users can update leads" ON public.leads;
CREATE POLICY "Users can update leads they created"
  ON public.leads FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin')
  );