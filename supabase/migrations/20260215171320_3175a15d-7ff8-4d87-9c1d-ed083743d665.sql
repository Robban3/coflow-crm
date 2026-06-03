
-- Organization pricing configuration for growth reports
CREATE TABLE public.organization_pricing (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES public.organizations(id) UNIQUE,
  geo_start_monthly NUMERIC DEFAULT 4990,
  geo_growth_monthly NUMERIC DEFAULT 9990,
  geo_dominate_monthly NUMERIC DEFAULT 19990,
  web_performance_fix_from NUMERIC DEFAULT 14990,
  seo_start_monthly NUMERIC DEFAULT 4990,
  seo_growth_monthly NUMERIC DEFAULT 9990,
  seo_dominate_monthly NUMERIC DEFAULT 19990,
  booking_url TEXT,
  contact_email TEXT DEFAULT 'hej@kodco.se',
  contact_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.organization_pricing ENABLE ROW LEVEL SECURITY;

-- Anyone can read pricing (needed for public report views)
CREATE POLICY "Anyone can read pricing"
  ON public.organization_pricing FOR SELECT
  USING (true);

-- Admins can manage their org pricing
CREATE POLICY "Admins can insert pricing"
  ON public.organization_pricing FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update pricing"
  ON public.organization_pricing FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin')
  );

-- Trigger for updated_at
CREATE TRIGGER update_organization_pricing_updated_at
  BEFORE UPDATE ON public.organization_pricing
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
