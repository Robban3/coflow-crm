-- Create SEO Intelligence analysis table
CREATE TABLE public.seo_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  url TEXT NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  web_analysis_id UUID REFERENCES public.web_analyses(id) ON DELETE SET NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  analyzed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- On-page SEO metrics
  title_tag TEXT,
  meta_description TEXT,
  h1_count INTEGER DEFAULT 0,
  h2_count INTEGER DEFAULT 0,
  h3_count INTEGER DEFAULT 0,
  word_count INTEGER DEFAULT 0,
  internal_links_count INTEGER DEFAULT 0,
  external_links_count INTEGER DEFAULT 0,
  images_count INTEGER DEFAULT 0,
  images_without_alt INTEGER DEFAULT 0,
  
  -- Technical SEO
  has_robots_txt BOOLEAN,
  has_sitemap BOOLEAN,
  is_https BOOLEAN,
  has_canonical BOOLEAN,
  canonical_url TEXT,
  has_open_graph BOOLEAN,
  has_twitter_cards BOOLEAN,
  mobile_friendly BOOLEAN,
  
  -- Content analysis
  primary_keywords JSONB DEFAULT '[]'::jsonb,
  keyword_density JSONB DEFAULT '{}'::jsonb,
  
  -- Estimated visibility (AI-generated insights)
  estimated_keywords JSONB DEFAULT '[]'::jsonb,
  visibility_score INTEGER DEFAULT 0,
  
  -- AI-generated summaries
  ai_summary TEXT,
  ai_opportunities JSONB DEFAULT '[]'::jsonb,
  
  -- Raw scraped data for future processing
  raw_data JSONB
);

-- Enable RLS
ALTER TABLE public.seo_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY "Users can view SEO analyses in their organization"
ON public.seo_analyses
FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can create SEO analyses in their organization"
ON public.seo_analyses
FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update SEO analyses in their organization"
ON public.seo_analyses
FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete SEO analyses in their organization"
ON public.seo_analyses
FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- Auto-set organization_id trigger
CREATE TRIGGER set_seo_analyses_org_id
BEFORE INSERT ON public.seo_analyses
FOR EACH ROW
EXECUTE FUNCTION public.set_organization_id_from_user();

-- Updated_at trigger
CREATE TRIGGER update_seo_analyses_updated_at
BEFORE UPDATE ON public.seo_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add seo_intelligence to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'seo_intelligence';

-- Create index for faster lookups
CREATE INDEX idx_seo_analyses_url ON public.seo_analyses(url);
CREATE INDEX idx_seo_analyses_web_analysis_id ON public.seo_analyses(web_analysis_id);
CREATE INDEX idx_seo_analyses_lead_id ON public.seo_analyses(lead_id);
CREATE INDEX idx_seo_analyses_organization_id ON public.seo_analyses(organization_id);