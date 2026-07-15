-- Planned working hours per user per day (the "Schema" tab). One row per user
-- and date; missing row = not planned. Everyone in the org can view the team's
-- schedule; each user edits only their own; admins can edit anyone in the org.
CREATE TABLE IF NOT EXISTS public.work_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid REFERENCES public.organizations(id),
  work_date date NOT NULL,
  start_time time,
  end_time time,
  is_off boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, work_date)
);

ALTER TABLE public.work_schedules ENABLE ROW LEVEL SECURITY;

-- Shared team view: any org member can read the whole team's schedule.
CREATE POLICY "Org members view schedules" ON public.work_schedules
FOR SELECT TO authenticated
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- A user manages their own rows.
CREATE POLICY "Users manage own schedule" ON public.work_schedules
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid() AND organization_id = public.get_user_organization_id(auth.uid()));

-- Admins can manage any user's schedule within their own org.
CREATE POLICY "Admins manage org schedules" ON public.work_schedules
FOR ALL TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE INDEX IF NOT EXISTS idx_work_schedules_org_date
  ON public.work_schedules (organization_id, work_date);

CREATE TRIGGER update_work_schedules_updated_at
BEFORE UPDATE ON public.work_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
