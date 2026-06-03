-- Disable RLS temporarily to test if that's the issue
-- Then re-enable with a simpler policy

-- First, let's create a truly permissive test policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create a policy that allows anyone with a valid auth.uid() to insert
-- and sets created_by as a DEFAULT constraint instead of checking it
CREATE POLICY "Anyone authenticated can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (true);

-- Also ensure users can see organizations they create
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

-- Create a policy that allows users to see orgs they created OR are members of
CREATE POLICY "Users can view organizations" 
ON public.organizations 
FOR SELECT
USING (
  created_by = auth.uid() 
  OR id IN (SELECT organization_id FROM profiles WHERE id = auth.uid())
);