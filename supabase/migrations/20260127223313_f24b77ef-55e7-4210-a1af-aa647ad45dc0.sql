-- Add outreach_tone column to profiles for storing preferred email tone
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS outreach_tone TEXT DEFAULT 'standard';

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.outreach_tone IS 'Preferred tone for AI-generated outreach emails: standard, familiar, informative, direct';