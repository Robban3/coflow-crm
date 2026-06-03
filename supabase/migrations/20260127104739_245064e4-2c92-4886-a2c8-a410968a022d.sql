-- Add lead_id column to activities table to support logging activities for leads
ALTER TABLE public.activities 
  ALTER COLUMN customer_id DROP NOT NULL,
  ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE;

-- Add constraint to ensure at least one of customer_id or lead_id is set
ALTER TABLE public.activities 
  ADD CONSTRAINT activities_customer_or_lead_check 
  CHECK (customer_id IS NOT NULL OR lead_id IS NOT NULL);

-- Create index for lead_id lookups
CREATE INDEX idx_activities_lead_id ON public.activities(lead_id);

-- Update RLS policies to allow viewing activities for leads
DROP POLICY IF EXISTS "Authenticated users can view all activities" ON public.activities;
CREATE POLICY "Authenticated users can view all activities"
  ON public.activities FOR SELECT
  TO authenticated
  USING (true);