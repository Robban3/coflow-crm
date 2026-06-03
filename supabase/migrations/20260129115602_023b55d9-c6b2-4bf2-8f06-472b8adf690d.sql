-- Drop the current insert policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create a new policy that checks auth.uid() is not null (meaning user is authenticated)
-- and that they are setting themselves as the creator
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = created_by);