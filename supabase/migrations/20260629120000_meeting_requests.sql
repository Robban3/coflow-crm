-- Internal "request a meeting with us" feature: a salesperson asks Robert and/or
-- Oliver for a meeting, picks a category, writes a short description; they get an
-- email + an in-CRM notification and can confirm/decline (optionally setting a
-- time and a meeting link). Separate from customer `meetings` (calendar).

CREATE TABLE IF NOT EXISTS public.meeting_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_emails text[] NOT NULL DEFAULT '{}',   -- chosen of robert@/oliver@applabbet.com
  category text NOT NULL,                          -- teknisk | salj | offert | kund | ovrigt
  description text NOT NULL,
  preferred_time timestamptz,                      -- optional: when the seller would like it
  urgency text NOT NULL DEFAULT 'normal',          -- normal | bradskande
  lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL,  -- optional context
  status text NOT NULL DEFAULT 'pending',          -- pending | confirmed | declined | done
  scheduled_time timestamptz,                      -- set on confirm
  meeting_link text,                               -- set on confirm
  response_note text,                              -- Robert/Oliver's reply
  responded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_meeting_requests_org_status
  ON public.meeting_requests (organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_meeting_requests_requested_by
  ON public.meeting_requests (requested_by);

ALTER TABLE public.meeting_requests ENABLE ROW LEVEL SECURITY;

-- Visible to: the requester, org admins, and the addressed recipients (by email).
CREATE POLICY "View meeting requests" ON public.meeting_requests FOR SELECT TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    requested_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = ANY(recipient_emails))
  )
);

-- A seller may create their own request.
CREATE POLICY "Insert own meeting requests" ON public.meeting_requests FOR INSERT TO authenticated
WITH CHECK (
  organization_id = public.get_user_organization_id(auth.uid())
  AND requested_by = auth.uid()
);

-- Admins and addressed recipients may respond (confirm/decline).
CREATE POLICY "Respond to meeting requests" ON public.meeting_requests FOR UPDATE TO authenticated
USING (
  organization_id = public.get_user_organization_id(auth.uid())
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.email = ANY(recipient_emails))
  )
);
