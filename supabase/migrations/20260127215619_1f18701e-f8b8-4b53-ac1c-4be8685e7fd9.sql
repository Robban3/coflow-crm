-- Add lead_id column to tasks table for better lead-task relationship
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS lead_id uuid REFERENCES public.leads(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON public.tasks(lead_id);

-- Update RLS policy to allow users to see tasks related to leads they can access
-- (existing policies already cover this via assigned_to and created_by)