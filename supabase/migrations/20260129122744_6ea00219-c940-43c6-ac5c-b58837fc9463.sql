-- Update profiles RLS to allow users within same organization to see each other
-- This is needed for team features (user avatars, assignment dropdowns, etc.)

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create organization-scoped profile viewing
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
USING (
  -- Can always view own profile
  id = auth.uid() 
  OR 
  -- Can view profiles in same organization
  organization_id = public.get_user_organization_id(auth.uid())
);

-- Keep insert/update policies for own profile
-- (already exists but confirming)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (id = auth.uid())
WITH CHECK (id = auth.uid());