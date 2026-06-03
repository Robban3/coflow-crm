-- Create a trigger function that makes organization creators admins
CREATE OR REPLACE FUNCTION public.handle_organization_created()
RETURNS TRIGGER AS $$
BEGIN
  -- Make the creator an admin (only if they're not already)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.created_by, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to run after organization insert
DROP TRIGGER IF EXISTS on_organization_created ON public.organizations;
CREATE TRIGGER on_organization_created
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_organization_created();

-- Now tighten the INSERT policy for organizations
DROP POLICY IF EXISTS "Anyone authenticated can create organizations" ON public.organizations;

-- Create a proper policy that requires auth
CREATE POLICY "Authenticated users can create organizations" 
ON public.organizations 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = created_by);