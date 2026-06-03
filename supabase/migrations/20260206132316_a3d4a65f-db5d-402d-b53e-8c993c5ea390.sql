-- Fas 1: Ny tabell för email_replies
CREATE TABLE public.email_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  original_email_id UUID REFERENCES public.sent_emails(id) ON DELETE CASCADE,
  sent_by UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  from_email TEXT NOT NULL,
  from_name TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  received_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  forwarded_at TIMESTAMP WITH TIME ZONE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index för snabb sökning
CREATE INDEX idx_email_replies_original_email ON public.email_replies(original_email_id);
CREATE INDEX idx_email_replies_lead ON public.email_replies(lead_id);
CREATE INDEX idx_email_replies_sent_by ON public.email_replies(sent_by);
CREATE INDEX idx_email_replies_organization ON public.email_replies(organization_id);

-- Aktivera RLS
ALTER TABLE public.email_replies ENABLE ROW LEVEL SECURITY;

-- RLS: Användare ser endast sina egna svar (eller alla om admin)
CREATE POLICY "Users see own replies or all if admin"
ON public.email_replies FOR SELECT
USING (
  sent_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);

-- RLS: Insert för service role (webhook)
CREATE POLICY "Service role can insert replies"
ON public.email_replies FOR INSERT
WITH CHECK (true);

-- RLS: Update för organisation
CREATE POLICY "Users can update own replies"
ON public.email_replies FOR UPDATE
USING (sent_by = auth.uid());

-- Fas 2: Lägg till reply_token på sent_emails
ALTER TABLE public.sent_emails 
ADD COLUMN reply_token TEXT UNIQUE;

-- Index för snabb token-sökning
CREATE INDEX idx_sent_emails_reply_token ON public.sent_emails(reply_token);

-- Fas 3: Uppdatera RLS för sent_emails - privat synlighet
-- Ta bort befintlig policy först
DROP POLICY IF EXISTS "Users can view sent emails in their organization" ON public.sent_emails;

-- Ny policy: Användare ser endast sina egna mail (eller alla om admin)
CREATE POLICY "Users see own emails or all if admin"
ON public.sent_emails FOR SELECT
USING (
  sent_by = auth.uid() 
  OR public.has_role(auth.uid(), 'admin')
);