
-- 1) Call outcomes configuration table
CREATE TABLE public.call_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  category text NOT NULL DEFAULT 'neutral',
  requires_note boolean NOT NULL DEFAULT false,
  requires_task boolean NOT NULL DEFAULT false,
  lead_status_effect text,
  icon text,
  color text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

ALTER TABLE public.call_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call outcomes in their org"
  ON public.call_outcomes FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can manage call outcomes"
  ON public.call_outcomes FOR ALL
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));

-- 2) Call logs table
CREATE TABLE public.call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  outcome_key text NOT NULL,
  outcome_label text NOT NULL,
  note text,
  callback_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  duration_seconds integer,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view call logs in their org"
  ON public.call_logs FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert call logs in their org"
  ON public.call_logs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update call logs in their org"
  ON public.call_logs FOR UPDATE
  USING (organization_id = get_user_organization_id(auth.uid()));

-- Index for statistics queries
CREATE INDEX idx_call_logs_org_created ON public.call_logs (organization_id, created_at);
CREATE INDEX idx_call_logs_outcome ON public.call_logs (organization_id, outcome_key, created_at);
CREATE INDEX idx_call_logs_user ON public.call_logs (organization_id, created_by, created_at);

-- 3) Add lead_status columns to leads
ALTER TABLE public.leads
  ADD COLUMN lead_status text NOT NULL DEFAULT 'active',
  ADD COLUMN not_interested_at timestamptz,
  ADD COLUMN not_interested_reason text;

CREATE INDEX idx_leads_status ON public.leads (organization_id, lead_status);

-- 4) Trigger: auto-log call to activity_events
CREATE OR REPLACE FUNCTION public.log_activity_event_from_call_logs()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS NOT NULL AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.activity_events (organization_id, actor_user_id, type, occurred_at, entity_type, entity_id, metadata)
    VALUES (
      NEW.organization_id,
      NEW.created_by,
      'call.logged',
      NEW.created_at,
      'call_log',
      NEW.id,
      jsonb_build_object('outcome_key', NEW.outcome_key, 'outcome_label', NEW.outcome_label)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_call_logs_activity_event
  AFTER INSERT ON public.call_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_activity_event_from_call_logs();

-- 5) Seed default outcomes for all existing organizations
INSERT INTO public.call_outcomes (organization_id, key, label, category, requires_note, requires_task, lead_status_effect, icon, color, sort_order)
SELECT o.id, v.key, v.label, v.category, v.requires_note, v.requires_task, v.lead_status_effect, v.icon, v.color, v.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('no_answer',       'Ej svar',          'neutral',  false, false, NULL,              'phone-missed',   'slate',  1),
  ('callback',        'Återkoppling',     'neutral',  false, true,  NULL,              'calendar-clock',  'amber',  2),
  ('answered',        'Svar',             'positive', true,  false, NULL,              'message-square',  'green',  3),
  ('not_interested',  'Ej intresserad',   'negative', true,  false, 'not_interested',  'x-circle',        'red',    4),
  ('booked',          'Bokad',            'positive', true,  false, NULL,              'calendar-check',  'green',  5),
  ('wrong_number',    'Nummer fel',       'negative', true,  false, 'invalid_phone',   'phone-off',       'red',    6)
) AS v(key, label, category, requires_note, requires_task, lead_status_effect, icon, color, sort_order)
ON CONFLICT (organization_id, key) DO NOTHING;
