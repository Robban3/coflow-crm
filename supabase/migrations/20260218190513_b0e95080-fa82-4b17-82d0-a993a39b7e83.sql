
-- Step 2: Create Power Call tables, RLS, and seed outreach_pro for existing users

-- Power Call Lists
CREATE TABLE IF NOT EXISTS public.power_call_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  name text NOT NULL,
  description text,
  source_type text NOT NULL DEFAULT 'static',
  filter_json jsonb,
  static_lead_ids uuid[],
  shared_to_team boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.power_call_lists ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org users can create power_call_lists"
  ON public.power_call_lists FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Owners and admins can update power_call_lists"
  ON public.power_call_lists FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  );

CREATE POLICY "Owners and admins can delete power_call_lists"
  ON public.power_call_lists FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  );

CREATE POLICY "Users can view power_call_lists"
  ON public.power_call_lists FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Power Call Sessions
CREATE TABLE IF NOT EXISTS public.power_call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  list_id uuid REFERENCES public.power_call_lists(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  current_lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  last_served_lead_id uuid,
  served_lead_ids uuid[] DEFAULT '{}',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.power_call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own sessions"
  ON public.power_call_sessions FOR ALL
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND user_id = auth.uid()
  );

CREATE POLICY "Admins can view all sessions in org"
  ON public.power_call_sessions FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

-- Power Call Locks
CREATE TABLE IF NOT EXISTS public.power_call_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL UNIQUE REFERENCES public.leads(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  locked_by_user_id uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes')
);

ALTER TABLE public.power_call_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage locks in their org"
  ON public.power_call_locks FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Leaderboard Snapshots
CREATE TABLE IF NOT EXISTS public.leaderboard_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  month text NOT NULL,
  top1_user_id uuid,
  top2_user_id uuid,
  top3_user_id uuid,
  top1_meetings int DEFAULT 0,
  top2_meetings int DEFAULT 0,
  top3_meetings int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id, month)
);

ALTER TABLE public.leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can read leaderboard snapshots"
  ON public.leaderboard_snapshots FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage leaderboard snapshots"
  ON public.leaderboard_snapshots FOR ALL
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin')
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_power_call_lists_org ON public.power_call_lists(organization_id);
CREATE INDEX IF NOT EXISTS idx_power_call_sessions_user ON public.power_call_sessions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_power_call_sessions_org ON public.power_call_sessions(organization_id);
CREATE INDEX IF NOT EXISTS idx_power_call_locks_expires ON public.power_call_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_snapshots_org ON public.leaderboard_snapshots(organization_id, month);
CREATE INDEX IF NOT EXISTS idx_call_logs_user ON public.call_logs(created_by, created_at);
CREATE INDEX IF NOT EXISTS idx_call_logs_org_date ON public.call_logs(organization_id, created_at);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_power_call_lists_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS update_power_call_lists_updated_at ON public.power_call_lists;
CREATE TRIGGER update_power_call_lists_updated_at
  BEFORE UPDATE ON public.power_call_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_power_call_lists_updated_at();

-- Enable outreach_pro for existing users who have outreach enabled
INSERT INTO public.user_modules (user_id, module, enabled)
SELECT user_id, 'outreach_pro'::app_module, true
FROM public.user_modules
WHERE module = 'outreach'::app_module
  AND enabled = true
ON CONFLICT (user_id, module) DO NOTHING;
