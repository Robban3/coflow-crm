
-- Add 'statistics' to the app_module enum
ALTER TYPE app_module ADD VALUE IF NOT EXISTS 'statistics';

-- Create activity_events table for trustworthy statistics
CREATE TABLE public.activity_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  actor_user_id uuid NOT NULL,
  type text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast aggregation
CREATE INDEX idx_activity_events_org_occurred ON public.activity_events (organization_id, occurred_at DESC);
CREATE INDEX idx_activity_events_org_user_occurred ON public.activity_events (organization_id, actor_user_id, occurred_at DESC);
CREATE INDEX idx_activity_events_org_type_occurred ON public.activity_events (organization_id, type, occurred_at DESC);

-- Enable RLS
ALTER TABLE public.activity_events ENABLE ROW LEVEL SECURITY;

-- RLS policies: org-scoped
CREATE POLICY "Users can view activity events in their organization"
  ON public.activity_events FOR SELECT
  USING (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert activity events in their organization"
  ON public.activity_events FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete activity events"
  ON public.activity_events FOR DELETE
  USING (organization_id = get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));
