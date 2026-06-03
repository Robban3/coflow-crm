
-- ======================================================
-- Power Call v1.1: call_outcomes, call_tasks, leads state
-- ======================================================

-- 1. call_outcomes (configurable per org)
CREATE TABLE IF NOT EXISTS public.call_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT 'neutral',
  requires_note boolean NOT NULL DEFAULT false,
  requires_followup_task boolean NOT NULL DEFAULT false,
  default_followup_minutes int NULL,
  is_terminal boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;

-- Helper to check if user is admin or moderator (by text, since moderator isn't in app_role enum yet)
CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND organization_id IS NOT NULL
    -- also treat any explicit moderator text role stored in user_roles as text
  ) AND (
    SELECT role::text = 'admin'
    FROM public.user_roles
    WHERE user_id = _user_id
    LIMIT 1
  )
$$;

-- Simpler: reuse has_role for admin; moderator is handled by app logic
-- Sellers: SELECT only
CREATE POLICY "Users can view call_outcomes in their org"
  ON public.call_outcomes FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Admins: INSERT/UPDATE
CREATE POLICY "Admins can insert call_outcomes"
  ON public.call_outcomes FOR INSERT
  WITH CHECK (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can update call_outcomes"
  ON public.call_outcomes FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Admins can delete call_outcomes"
  ON public.call_outcomes FOR DELETE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- 2. call_tasks (callback tasks)
CREATE TABLE IF NOT EXISTS public.call_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  assigned_to_user_id uuid NOT NULL,
  type text NOT NULL DEFAULT 'callback',
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'open',
  note text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz NULL
);

ALTER TABLE public.call_tasks ENABLE ROW LEVEL SECURITY;

-- All org users can view; sellers see own, admins see all (filtered in app layer too)
CREATE POLICY "Users can view call_tasks in their org"
  ON public.call_tasks FOR SELECT
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      assigned_to_user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

CREATE POLICY "Users can insert call_tasks in their org"
  ON public.call_tasks FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update own call_tasks or admin"
  ON public.call_tasks FOR UPDATE
  USING (
    organization_id = get_user_organization_id(auth.uid())
    AND (
      assigned_to_user_id = auth.uid()
      OR has_role(auth.uid(), 'admin'::app_role)
    )
  );

-- 3. Extend leads with call state columns
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS last_call_outcome_key text NULL,
  ADD COLUMN IF NOT EXISTS last_call_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS is_not_interested boolean NOT NULL DEFAULT false;

-- 4. Add followup_task_id column to call_logs if missing
ALTER TABLE public.call_logs
  ADD COLUMN IF NOT EXISTS followup_task_id uuid REFERENCES public.call_tasks(id) ON DELETE SET NULL;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_call_outcomes_org ON public.call_outcomes(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_tasks_org ON public.call_tasks(organization_id);
CREATE INDEX IF NOT EXISTS idx_call_tasks_assigned ON public.call_tasks(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_call_tasks_due ON public.call_tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_leads_is_not_interested ON public.leads(is_not_interested);
CREATE INDEX IF NOT EXISTS idx_leads_last_call_at ON public.leads(last_call_at);
