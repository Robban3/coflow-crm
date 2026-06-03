
-- ─────────────────────────────────────────────────────────────────────
-- Analysis Endpoint Registry + Trigger Logs
-- Allows changing web/geo function names via DB without redeploy.
-- ─────────────────────────────────────────────────────────────────────

-- 1) analysis_endpoints — per-org or global candidates
CREATE TABLE IF NOT EXISTS public.analysis_endpoints (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text NOT NULL CHECK (kind IN ('web', 'geo', 'seo')),
  name          text NOT NULL,          -- edge function name, e.g. 'pagespeed-analyze'
  payload_type  text NOT NULL DEFAULT 'auto' CHECK (payload_type IN ('url','leadId','domain','auto')),
  enabled       boolean NOT NULL DEFAULT true,
  priority      integer NOT NULL DEFAULT 10,   -- lower = tried first
  organization_id uuid NULL,            -- NULL = global default; org-specific overrides global
  created_at    timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_endpoints ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read enabled endpoints (needed by edge functions via service role, no RLS needed there)
CREATE POLICY "Authenticated can read analysis_endpoints"
  ON public.analysis_endpoints FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage analysis_endpoints"
  ON public.analysis_endpoints FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
  );

-- 2) analysis_trigger_logs — audit trail of every trigger attempt
CREATE TABLE IF NOT EXISTS public.analysis_trigger_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NULL,
  lead_id       uuid NULL,
  kind          text NOT NULL,          -- 'web' | 'geo'
  function_name text NOT NULL,          -- which candidate was tried
  payload_type  text NOT NULL,
  status_code   integer NULL,           -- HTTP response code (null = network error)
  ok            boolean NOT NULL DEFAULT false,
  error_message text NULL,
  created_at    timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.analysis_trigger_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view trigger logs in their org"
  ON public.analysis_trigger_logs FOR SELECT
  TO authenticated
  USING (
    organization_id = get_user_organization_id(auth.uid())
    OR organization_id IS NULL
  );

-- Admins can manage
CREATE POLICY "Admins can manage trigger logs"
  ON public.analysis_trigger_logs FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_analysis_endpoints_kind_priority
  ON public.analysis_endpoints (kind, priority, enabled);

CREATE INDEX IF NOT EXISTS idx_analysis_trigger_logs_lead
  ON public.analysis_trigger_logs (lead_id, kind, created_at DESC);

-- 3) Seed default candidates based on evidence from codebase:
--
-- EVIDENCE A: supabase/functions/pagespeed-analyze/index.ts line 139
--   const { url, strategy = 'mobile' } = await req.json()
--   → payload_type = 'url'
--
-- EVIDENCE B: supabase/functions/run-geo-analysis/index.ts line 16
--   const { leadId, domain: directDomain } = body
--   → payload_type = 'leadId' (primary), 'domain' (fallback)
--
INSERT INTO public.analysis_endpoints (kind, name, payload_type, enabled, priority)
VALUES
  ('web', 'pagespeed-analyze',   'url',    true,  1),
  ('geo', 'run-geo-analysis',    'leadId', true,  1),
  ('geo', 'run-geo-analysis',    'domain', true,  5)   -- fallback payload variant
ON CONFLICT DO NOTHING;
