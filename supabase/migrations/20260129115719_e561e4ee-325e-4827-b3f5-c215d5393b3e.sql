-- Drop and recreate with explicit public role
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create policy for public role (all authenticated users through RLS check)
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
TO public
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);