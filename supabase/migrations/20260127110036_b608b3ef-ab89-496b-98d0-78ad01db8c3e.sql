-- Add email signature settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS email_signature TEXT,
ADD COLUMN IF NOT EXISTS company_name TEXT,
ADD COLUMN IF NOT EXISTS company_website TEXT,
ADD COLUMN IF NOT EXISTS company_logo_url TEXT,
ADD COLUMN IF NOT EXISTS email_footer TEXT;

-- Add AI-generated content fields to sequence steps
ALTER TABLE public.sequence_steps
ADD COLUMN IF NOT EXISTS email_subject TEXT,
ADD COLUMN IF NOT EXISTS email_prompt TEXT,
ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;

-- Add generated email content to step executions
ALTER TABLE public.sequence_step_executions
ADD COLUMN IF NOT EXISTS generated_subject TEXT,
ADD COLUMN IF NOT EXISTS generated_body TEXT;