
-- GEO Analyses main table
CREATE TABLE public.geo_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id),
  domain TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  geo_score INT,
  summary TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID
);

ALTER TABLE public.geo_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org geo_analyses"
  ON public.geo_analyses FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert geo_analyses"
  ON public.geo_analyses FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update own org geo_analyses"
  ON public.geo_analyses FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Auto-set organization_id
CREATE TRIGGER set_geo_analyses_org_id
  BEFORE INSERT ON public.geo_analyses
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_user();

-- GEO Pages
CREATE TABLE public.geo_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_analysis_id UUID NOT NULL REFERENCES public.geo_analyses(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  status_code INT,
  title TEXT,
  meta_description TEXT,
  h1 TEXT,
  word_count INT,
  indexable BOOLEAN DEFAULT true,
  canonical TEXT,
  schema_types TEXT[],
  internal_links INT DEFAULT 0
);

ALTER TABLE public.geo_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage geo_pages via analysis"
  ON public.geo_pages FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
    AND ga.organization_id = public.get_user_organization_id(auth.uid())
  ));

-- GEO Findings
CREATE TABLE public.geo_findings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_analysis_id UUID NOT NULL REFERENCES public.geo_analyses(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('seo','geo','indexing','entity','content')),
  severity TEXT NOT NULL CHECK (severity IN ('high','medium','low')),
  title TEXT NOT NULL,
  description TEXT,
  evidence JSONB,
  recommendation TEXT
);

ALTER TABLE public.geo_findings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage geo_findings via analysis"
  ON public.geo_findings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
    AND ga.organization_id = public.get_user_organization_id(auth.uid())
  ));

-- GEO Actions
CREATE TABLE public.geo_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_analysis_id UUID NOT NULL REFERENCES public.geo_analyses(id) ON DELETE CASCADE,
  priority TEXT NOT NULL CHECK (priority IN ('quick_win','medium','long_term')),
  title TEXT NOT NULL,
  steps TEXT,
  estimated_impact TEXT,
  estimated_effort TEXT
);

ALTER TABLE public.geo_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage geo_actions via analysis"
  ON public.geo_actions FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.geo_analyses ga
    WHERE ga.id = geo_analysis_id
    AND ga.organization_id = public.get_user_organization_id(auth.uid())
  ));

-- SEO Cache table
CREATE TABLE public.seo_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ttl_days INT NOT NULL DEFAULT 30,
  UNIQUE(domain, organization_id)
);

ALTER TABLE public.seo_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org seo_cache"
  ON public.seo_cache FOR SELECT
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert seo_cache"
  ON public.seo_cache FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update seo_cache"
  ON public.seo_cache FOR UPDATE
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE TRIGGER set_seo_cache_org_id
  BEFORE INSERT ON public.seo_cache
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_user();
