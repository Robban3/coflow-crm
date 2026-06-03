-- Add org_number column to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS org_number TEXT;

-- Add 'fleet_data' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'fleet_data';

-- Create table for storing fleet and telephony data
CREATE TABLE public.lead_fleet_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  org_number TEXT,
  vehicle_count INTEGER,
  phone_subscription_count INTEGER,
  phone_operator TEXT,
  leasing_company TEXT,
  raw_data JSONB,
  source_url TEXT,
  fetched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  fetched_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Enable RLS on lead_fleet_data
ALTER TABLE public.lead_fleet_data ENABLE ROW LEVEL SECURITY;

-- RLS policies for lead_fleet_data
CREATE POLICY "Authenticated users can view fleet data"
  ON public.lead_fleet_data
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert fleet data"
  ON public.lead_fleet_data
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update fleet data"
  ON public.lead_fleet_data
  FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_lead_fleet_data_updated_at
  BEFORE UPDATE ON public.lead_fleet_data
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();