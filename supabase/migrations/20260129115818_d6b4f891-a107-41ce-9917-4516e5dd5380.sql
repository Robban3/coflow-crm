-- Drop and recreate the policy with correct role targets
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create policy targeting both anon and authenticated roles explicitly
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
TO anon, authenticated
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);