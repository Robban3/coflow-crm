
-- Add new columns to reports table for schema-driven engine
ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS data jsonb,
  ADD COLUMN IF NOT EXISTS source_refs jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create report_shares table
CREATE TABLE IF NOT EXISTS public.report_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  enabled boolean DEFAULT false,
  expires_at timestamptz,
  view_count int DEFAULT 0,
  last_viewed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS for report_shares
ALTER TABLE public.report_shares ENABLE ROW LEVEL SECURITY;

-- Org members can manage shares for their reports
CREATE POLICY "Org members can manage report shares"
  ON public.report_shares
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_shares.report_id
        AND r.organization_id = public.get_user_organization_id(auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reports r
      WHERE r.id = report_shares.report_id
        AND r.organization_id = public.get_user_organization_id(auth.uid())
    )
  );

-- Public can read shares by token (for the public view page) - only enabled shares
CREATE POLICY "Public can read enabled shares by token"
  ON public.report_shares
  FOR SELECT
  USING (enabled = true);

-- Allow unauthenticated update for view_count increment
CREATE POLICY "Anyone can increment view count"
  ON public.report_shares
  FOR UPDATE
  USING (enabled = true)
  WITH CHECK (enabled = true);

-- Add trigger for updated_at on reports
CREATE TRIGGER update_reports_updated_at
  BEFORE UPDATE ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add trigger for org id on report_shares (not needed, inherits from report)
-- Add trigger for org id on reports
DROP TRIGGER IF EXISTS set_reports_org_id ON public.reports;
CREATE TRIGGER set_reports_org_id
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_user();

-- Also need public to read reports by join through report_shares for public view
CREATE POLICY "Public can read reports via enabled share"
  ON public.reports
  FOR SELECT
  USING (
    auth.uid() IS NOT NULL AND organization_id = public.get_user_organization_id(auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM public.report_shares rs
      WHERE rs.report_id = reports.id
        AND rs.enabled = true
    )
  );
