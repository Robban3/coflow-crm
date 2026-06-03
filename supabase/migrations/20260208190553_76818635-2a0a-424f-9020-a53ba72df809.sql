-- Tabell för konkurrenter (för konkurrentanalys)
CREATE TABLE public.lead_competitors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  competitor_name text NOT NULL,
  competitor_url text NOT NULL,
  web_analysis_id uuid REFERENCES public.web_analyses(id) ON DELETE SET NULL,
  source text DEFAULT 'manual', -- 'manual' eller 'auto'
  added_by uuid,
  added_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lead_competitors ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view competitors in their organization"
  ON public.lead_competitors FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert competitors in their organization"
  ON public.lead_competitors FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update competitors in their organization"
  ON public.lead_competitors FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete competitors in their organization"
  ON public.lead_competitors FOR DELETE
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Tabell för genererade rapporter
CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  web_analysis_id uuid REFERENCES public.web_analyses(id) ON DELETE SET NULL,
  seo_analysis_id uuid REFERENCES public.seo_analyses(id) ON DELETE SET NULL,
  report_type text NOT NULL, -- 'web_analysis', 'seo', 'competitor'
  title text NOT NULL,
  content_html text,
  pdf_url text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view reports in their organization"
  ON public.reports FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert reports in their organization"
  ON public.reports FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update reports in their organization"
  ON public.reports FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete reports in their organization"
  ON public.reports FOR DELETE
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- Tabell för användartillgänglighet (mötesbokning)
CREATE TABLE public.user_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization_id uuid REFERENCES public.organizations(id),
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0=Sunday, 6=Saturday
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_availability ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view availability in their organization"
  ON public.user_availability FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()) OR organization_id IS NULL);

CREATE POLICY "Users can manage their own availability"
  ON public.user_availability FOR ALL
  USING (user_id = auth.uid());

-- Tabell för möten
CREATE TABLE public.meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  host_user_id uuid NOT NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  guest_name text,
  guest_email text,
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  meeting_link text,
  status text DEFAULT 'scheduled', -- 'scheduled', 'completed', 'cancelled'
  booking_token text UNIQUE DEFAULT gen_random_uuid()::text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view meetings in their organization"
  ON public.meetings FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert meetings in their organization"
  ON public.meetings FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update their own meetings"
  ON public.meetings FOR UPDATE
  USING (host_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can delete their own meetings"
  ON public.meetings FOR DELETE
  USING (host_user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Public access for booking (via booking_token)
CREATE POLICY "Anyone can view public booking info"
  ON public.meetings FOR SELECT
  USING (booking_token IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_meetings_updated_at
  BEFORE UPDATE ON public.meetings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();