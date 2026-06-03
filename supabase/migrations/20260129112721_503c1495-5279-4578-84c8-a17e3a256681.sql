-- Create organizations table
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  website TEXT,
  logo_url TEXT,
  -- Email configuration
  sender_email TEXT DEFAULT 'noreply@resend.dev',
  sender_name TEXT,
  resend_api_key_configured BOOLEAN DEFAULT false,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Add onboarding_completed flag to profiles
ALTER TABLE public.profiles ADD COLUMN onboarding_completed BOOLEAN DEFAULT false;

-- Enable RLS
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Policies for organizations
CREATE POLICY "Users can view their own organization"
  ON public.organizations
  FOR SELECT
  USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Admins can update their organization"
  ON public.organizations
  FOR UPDATE
  USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Anyone can insert organizations during registration"
  ON public.organizations
  FOR INSERT
  WITH CHECK (true);

-- Create Kod & Co. organization for existing users
INSERT INTO public.organizations (id, name, slug, website, sender_email, sender_name, resend_api_key_configured)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Kod & Co.',
  'kodco',
  'https://kodco.se',
  'hej@kodco.se',
  'Kod & Co.',
  true
);

-- Migrate existing users to Kod & Co. organization
UPDATE public.profiles 
SET organization_id = 'a0000000-0000-0000-0000-000000000001',
    onboarding_completed = true
WHERE organization_id IS NULL;

-- Link organization_invites to organizations
ALTER TABLE public.organization_invites ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Update existing invites to Kod & Co.
UPDATE public.organization_invites 
SET organization_id = 'a0000000-0000-0000-0000-000000000001'
WHERE organization_id IS NULL;

-- Create trigger for updated_at
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Update handle_new_user function to NOT auto-set organization (will be set during onboarding)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Create profile (organization_id will be set during onboarding or via invite code)
  INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', false);
  
  -- Assign default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  -- Enable all modules by default for new users
  INSERT INTO public.user_modules (user_id, module)
  SELECT NEW.id, m.module
  FROM unnest(ARRAY['customers', 'web_analysis', 'outreach', 'tasks', 'reports', 'leads', 'pipeline']::app_module[]) AS m(module);
  
  RETURN NEW;
END;
$$;