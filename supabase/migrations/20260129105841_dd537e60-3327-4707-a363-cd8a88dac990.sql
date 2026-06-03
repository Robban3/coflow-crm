-- Add service profile fields to profiles table for custom outreach
ALTER TABLE public.profiles
ADD COLUMN service_industry TEXT,
ADD COLUMN service_description TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.service_industry IS 'Industry template selection for outreach customization (e.g., telephony, fleet_leasing, it_services)';
COMMENT ON COLUMN public.profiles.service_description IS 'Detailed description of what the organization sells and its unique selling points for AI-powered outreach';