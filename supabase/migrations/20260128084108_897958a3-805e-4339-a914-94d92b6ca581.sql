-- Create sent_emails table to track all outgoing emails
CREATE TABLE public.sent_emails (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id),
  customer_id UUID REFERENCES public.customers(id),
  sent_by UUID NOT NULL,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual', -- 'sequence', 'quick_outreach', 'single_email', 'manual'
  sequence_execution_id UUID REFERENCES public.sequence_step_executions(id),
  resend_email_id TEXT, -- ID from Resend API for tracking
  opened_at TIMESTAMP WITH TIME ZONE,
  opened_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sent_emails ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view all sent emails"
  ON public.sent_emails
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert sent emails"
  ON public.sent_emails
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can update sent emails"
  ON public.sent_emails
  FOR UPDATE
  USING (true);

-- Index for quick lookups
CREATE INDEX idx_sent_emails_lead_id ON public.sent_emails(lead_id);
CREATE INDEX idx_sent_emails_sent_by ON public.sent_emails(sent_by);
CREATE INDEX idx_sent_emails_created_at ON public.sent_emails(created_at DESC);
CREATE INDEX idx_sent_emails_resend_email_id ON public.sent_emails(resend_email_id);