
-- ============================================================
-- Power Call v2: Cursor + lead_analysis_status + pool indexes
-- ============================================================

-- 1) Add next_preparing column to power_call_sessions (avoid reset)
ALTER TABLE public.power_call_sessions
  ADD COLUMN IF NOT EXISTS next_preparing BOOLEAN NOT NULL DEFAULT false;

-- Make cursor default to empty object
ALTER TABLE public.power_call_sessions
  ALTER COLUMN cursor SET DEFAULT '{}'::jsonb;

-- 2) Create lead_analysis_status table for tracking web/geo analysis state per lead
CREATE TABLE IF NOT EXISTS public.lead_analysis_status (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  lead_id       uuid NOT NULL,
  web_status    text NOT NULL DEFAULT 'missing',
  geo_status    text NOT NULL DEFAULT 'missing',
  web_updated_at timestamptz,
  geo_updated_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(lead_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_lead_analysis_status_org_lead
  ON public.lead_analysis_status (organization_id, lead_id);

-- RLS for lead_analysis_status
ALTER TABLE public.lead_analysis_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analysis status in their org"
  ON public.lead_analysis_status FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert analysis status in their org"
  ON public.lead_analysis_status FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update analysis status in their org"
  ON public.lead_analysis_status FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

-- 3) Ensure lead_pool has all needed indexes (table already exists from prior migration)
CREATE INDEX IF NOT EXISTS idx_lead_pool_org_city
  ON public.lead_pool (organization_id, city);

CREATE INDEX IF NOT EXISTS idx_lead_pool_org_industry
  ON public.lead_pool (organization_id, industry);

CREATE INDEX IF NOT EXISTS idx_lead_pool_org_registered_at
  ON public.lead_pool (organization_id, registered_at);

CREATE INDEX IF NOT EXISTS idx_lead_pool_org_nr
  ON public.lead_pool (organization_id, org_nr);

-- 4) Index for leads.lead_pool_id
CREATE INDEX IF NOT EXISTS idx_leads_lead_pool_id
  ON public.leads (organization_id, lead_pool_id);

-- 5) Power call sessions index
CREATE INDEX IF NOT EXISTS idx_power_call_sessions_list_user_status
  ON public.power_call_sessions (list_id, user_id, status);

-- 6) Power call queue index
CREATE INDEX IF NOT EXISTS idx_power_call_queue_session_status
  ON public.power_call_queue (session_id, status);

-- 7) RLS for lead_pool — ensure sellers can read, only admins can write
DO $$
BEGIN
  -- Drop existing if any to recreate clean
  DROP POLICY IF EXISTS "Users can view lead_pool in their org" ON public.lead_pool;
  DROP POLICY IF EXISTS "Admins can insert lead_pool" ON public.lead_pool;
  DROP POLICY IF EXISTS "Admins can update lead_pool" ON public.lead_pool;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view lead_pool in their org"
  ON public.lead_pool FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert lead_pool"
  ON public.lead_pool FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update lead_pool"
  ON public.lead_pool FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );
