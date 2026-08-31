-- Deliverability: delivery/bounce state on sent emails + a suppression list so
-- we never re-email hard bounces, complaints or unsubscribes.

ALTER TABLE public.sent_emails
  ADD COLUMN IF NOT EXISTS delivered_at   timestamptz,
  ADD COLUMN IF NOT EXISTS bounced_at     timestamptz,
  ADD COLUMN IF NOT EXISTS bounce_type    text,          -- 'hard' | 'soft' | 'complaint'
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

CREATE TABLE IF NOT EXISTS public.suppressed_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  email text NOT NULL,
  reason text NOT NULL,                                  -- 'hard_bounce'|'complaint'|'unsubscribe'|'manual'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, email)
);

CREATE INDEX IF NOT EXISTS idx_suppressed_org_email
  ON public.suppressed_emails (organization_id, lower(email));

ALTER TABLE public.suppressed_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view suppressions" ON public.suppressed_emails
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Org members insert suppressions" ON public.suppressed_emails
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins delete suppressions" ON public.suppressed_emails
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid())
         AND public.has_role(auth.uid(), 'admin'));
