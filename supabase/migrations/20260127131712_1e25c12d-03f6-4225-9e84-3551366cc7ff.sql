-- Add assigned_to column to leads table for tracking lead ownership
ALTER TABLE public.leads 
ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON public.leads(assigned_to);

-- Update RLS policy for leads to allow assigned users to update
DROP POLICY IF EXISTS "Users can update leads they created" ON public.leads;

CREATE POLICY "Users can update leads" 
ON public.leads 
FOR UPDATE 
USING (
  (created_by = auth.uid()) 
  OR (assigned_to = auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  (created_by = auth.uid()) 
  OR (assigned_to = auth.uid()) 
  OR has_role(auth.uid(), 'admin'::app_role)
);

-- Create organization_invites table for invite codes
CREATE TABLE IF NOT EXISTS public.organization_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone,
  max_uses integer DEFAULT 1,
  uses integer DEFAULT 0,
  is_active boolean DEFAULT true
);

-- Enable RLS on organization_invites
ALTER TABLE public.organization_invites ENABLE ROW LEVEL SECURITY;

-- Only admins can view invites
CREATE POLICY "Admins can view all invites" 
ON public.organization_invites 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can create invites
CREATE POLICY "Admins can create invites" 
ON public.organization_invites 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update/delete invites
CREATE POLICY "Admins can manage invites" 
ON public.organization_invites 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow anyone to read invites by code (for signup verification)
CREATE POLICY "Anyone can verify invite codes" 
ON public.organization_invites 
FOR SELECT 
USING (true);

-- Create storage bucket for profile assets (avatars, logos)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-assets', 
  'profile-assets', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for profile assets
CREATE POLICY "Anyone can view profile assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-assets');

CREATE POLICY "Authenticated users can upload own profile assets"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own profile assets"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own profile assets"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-assets' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);