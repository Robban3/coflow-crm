
-- Enable pg_trgm extension for fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create company_registry table
CREATE TABLE public.company_registry (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name text NOT NULL,
  org_number text NOT NULL,
  company_form text,
  registration_date text,
  legal_form text,
  address text,
  co_address text,
  postal_code text,
  city text,
  country text,
  phone text,
  sni_codes text,
  sni_descriptions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT company_registry_org_number_key UNIQUE (org_number)
);

-- Indexes
CREATE INDEX idx_company_registry_name_trgm ON public.company_registry USING GIN (company_name gin_trgm_ops);
CREATE INDEX idx_company_registry_city ON public.company_registry (city);
CREATE INDEX idx_company_registry_postal_code ON public.company_registry (postal_code);
CREATE INDEX idx_company_registry_sni ON public.company_registry USING GIN (sni_descriptions gin_trgm_ops);
CREATE INDEX idx_company_registry_company_form ON public.company_registry (company_form);

-- Enable RLS
ALTER TABLE public.company_registry ENABLE ROW LEVEL SECURITY;

-- SELECT policy: all authenticated users can read
CREATE POLICY "Authenticated users can view company registry"
  ON public.company_registry
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- No INSERT/UPDATE/DELETE policies needed - edge function uses service_role

-- Updated_at trigger
CREATE TRIGGER update_company_registry_updated_at
  BEFORE UPDATE ON public.company_registry
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
