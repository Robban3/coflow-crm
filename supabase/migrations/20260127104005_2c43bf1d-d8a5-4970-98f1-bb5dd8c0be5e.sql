-- Add lead_id to web_analyses to link analyses to leads
ALTER TABLE public.web_analyses 
ADD COLUMN lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_web_analyses_lead_id ON public.web_analyses(lead_id);