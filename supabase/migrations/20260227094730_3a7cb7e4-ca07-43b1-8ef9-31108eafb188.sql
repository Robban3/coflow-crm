-- Add error tracking columns to sent_emails
ALTER TABLE public.sent_emails ADD COLUMN IF NOT EXISTS send_error TEXT;
ALTER TABLE public.sent_emails ADD COLUMN IF NOT EXISTS send_attempted_at TIMESTAMPTZ;