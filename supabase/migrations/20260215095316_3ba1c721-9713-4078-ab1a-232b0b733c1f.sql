
-- Table: geo_quick_scans
CREATE TABLE public.geo_quick_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  company_name text,
  email text NOT NULL,
  website text NOT NULL,
  domain text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  geo_score int,
  summary_short text,
  top_findings jsonb NOT NULL DEFAULT '[]'::jsonb,
  top_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  public_token text NOT NULL UNIQUE,
  expires_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- Indexes
CREATE INDEX idx_geo_quick_scans_email_domain ON public.geo_quick_scans(email, domain, created_at DESC);
CREATE INDEX idx_geo_quick_scans_token ON public.geo_quick_scans(public_token);

-- RLS
ALTER TABLE public.geo_quick_scans ENABLE ROW LEVEL SECURITY;

-- Internal org users can read/write their own org's scans
CREATE POLICY "Org members can view their scans"
  ON public.geo_quick_scans FOR SELECT
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

CREATE POLICY "Org members can insert scans"
  ON public.geo_quick_scans FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = public.get_user_organization_id(auth.uid())
  );

CREATE POLICY "Org members can update their scans"
  ON public.geo_quick_scans FOR UPDATE
  USING (
    organization_id IS NOT NULL
    AND organization_id = public.get_user_organization_id(auth.uid())
  );

-- Service role will handle public API inserts/updates (no public RLS needed)
