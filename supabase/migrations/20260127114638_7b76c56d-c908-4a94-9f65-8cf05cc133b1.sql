-- Add approval workflow columns to sequence_step_executions
ALTER TABLE public.sequence_step_executions
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS approved_by UUID;

-- Update status check to include 'needs_approval'
ALTER TABLE public.sequence_step_executions
DROP CONSTRAINT IF EXISTS sequence_step_executions_status_check;

ALTER TABLE public.sequence_step_executions
ADD CONSTRAINT sequence_step_executions_status_check 
CHECK (status IN ('pending', 'needs_approval', 'approved', 'sent', 'completed', 'failed', 'skipped'));

-- Add require_approval column to outreach_sequences
ALTER TABLE public.outreach_sequences
ADD COLUMN IF NOT EXISTS require_approval BOOLEAN NOT NULL DEFAULT true;