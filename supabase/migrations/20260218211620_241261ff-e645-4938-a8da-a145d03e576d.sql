
-- ================================================================
-- Power Call v2 Migration
-- ================================================================

-- 1) lead_pool: source-agnostic company pool
CREATE TABLE IF NOT EXISTS public.lead_pool (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  company_name text NOT NULL,
  org_nr text,
  sni_codes text[],
  industry text,
  city text,
  registered_at date,
  website text,
  phone text,
  email text,
  data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for lead_pool filtering
CREATE INDEX IF NOT EXISTS idx_lead_pool_org_id ON public.lead_pool(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_pool_org_nr ON public.lead_pool(org_nr) WHERE org_nr IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_pool_website ON public.lead_pool(website) WHERE website IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_pool_city ON public.lead_pool(city) WHERE city IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_pool_industry ON public.lead_pool(industry) WHERE industry IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_pool_registered_at ON public.lead_pool(registered_at) WHERE registered_at IS NOT NULL;

ALTER TABLE public.lead_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lead_pool in their org"
  ON public.lead_pool FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can insert lead_pool"
  ON public.lead_pool FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update lead_pool"
  ON public.lead_pool FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2) Extend power_call_sessions with cursor + preload fields
ALTER TABLE public.power_call_sessions
  ADD COLUMN IF NOT EXISTS cursor jsonb,
  ADD COLUMN IF NOT EXISTS next_lead_id uuid,
  ADD COLUMN IF NOT EXISTS next_ready boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS next_required_modules jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Indexes for sessions
CREATE INDEX IF NOT EXISTS idx_power_call_sessions_list_user_status 
  ON public.power_call_sessions(list_id, user_id, status) WHERE status = 'active';

-- 3) Extend power_call_lists with dynamic filter fields
ALTER TABLE public.power_call_lists
  ADD COLUMN IF NOT EXISTS dynamic_filter jsonb,
  ADD COLUMN IF NOT EXISTS dynamic_sort text NOT NULL DEFAULT 'priority_desc',
  ADD COLUMN IF NOT EXISTS dynamic_version int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_team_list boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS owner_user_id uuid;

-- 4) power_call_queue for background prepare-next jobs
CREATE TABLE IF NOT EXISTS public.power_call_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  session_id uuid NOT NULL,
  lead_id uuid,
  required_modules jsonb NOT NULL DEFAULT '{"web": true, "geo": true}',
  status text NOT NULL DEFAULT 'queued',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_power_call_queue_session_status 
  ON public.power_call_queue(session_id, status);

ALTER TABLE public.power_call_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own queue in org"
  ON public.power_call_queue FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()));

-- 5) Extend leads with lead_pool link + not_interested columns (if not already there)
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS lead_pool_id uuid REFERENCES public.lead_pool(id),
  ADD COLUMN IF NOT EXISTS not_interested_reason text;

-- is_not_interested may already exist (added in previous migration), guard with IF NOT EXISTS
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='leads' AND column_name='is_not_interested') THEN
    ALTER TABLE public.leads ADD COLUMN is_not_interested boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='leads' AND column_name='not_interested_at') THEN
    ALTER TABLE public.leads ADD COLUMN not_interested_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='leads' AND column_name='last_call_at') THEN
    ALTER TABLE public.leads ADD COLUMN last_call_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='leads' AND column_name='last_call_outcome_key') THEN
    ALTER TABLE public.leads ADD COLUMN last_call_outcome_key text;
  END IF;
END $$;
