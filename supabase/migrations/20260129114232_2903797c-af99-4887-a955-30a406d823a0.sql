-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Anyone can insert organizations during registration" ON public.organizations;

-- Create a proper PERMISSIVE insert policy that allows authenticated users to create organizations
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);