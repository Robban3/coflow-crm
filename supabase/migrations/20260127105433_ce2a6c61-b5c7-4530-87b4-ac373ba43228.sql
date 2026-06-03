-- Create outreach sequences table for multi-step email sequences
CREATE TABLE public.outreach_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create sequence steps table (email steps and task steps)
CREATE TABLE public.sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id UUID REFERENCES public.outreach_sequences(id) ON DELETE CASCADE NOT NULL,
  step_order INTEGER NOT NULL,
  step_type TEXT NOT NULL CHECK (step_type IN ('email', 'task', 'wait')),
  -- For email steps
  template_id UUID REFERENCES public.email_templates(id) ON DELETE SET NULL,
  -- For task steps
  task_title TEXT,
  task_description TEXT,
  -- Delay in days before this step executes (relative to previous step)
  delay_days INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create lead sequences table to track sequence enrollment per lead
CREATE TABLE public.lead_sequences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  sequence_id UUID REFERENCES public.outreach_sequences(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'cancelled')),
  current_step INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  next_step_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(lead_id, sequence_id)
);

-- Create sequence step executions to track what was sent/done
CREATE TABLE public.sequence_step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_sequence_id UUID REFERENCES public.lead_sequences(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES public.sequence_steps(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'completed', 'failed', 'skipped')),
  scheduled_at TIMESTAMP WITH TIME ZONE,
  executed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outreach_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sequence_step_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for outreach_sequences
CREATE POLICY "Authenticated users can view all sequences"
  ON public.outreach_sequences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert sequences"
  ON public.outreach_sequences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own sequences"
  ON public.outreach_sequences FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete sequences"
  ON public.outreach_sequences FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for sequence_steps
CREATE POLICY "Authenticated users can view all steps"
  ON public.sequence_steps FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage steps"
  ON public.sequence_steps FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies for lead_sequences
CREATE POLICY "Authenticated users can view all lead sequences"
  ON public.lead_sequences FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert lead sequences"
  ON public.lead_sequences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update lead sequences"
  ON public.lead_sequences FOR UPDATE
  TO authenticated
  USING (true);

-- RLS Policies for step executions
CREATE POLICY "Authenticated users can view all executions"
  ON public.sequence_step_executions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage executions"
  ON public.sequence_step_executions FOR ALL
  TO authenticated
  USING (true);

-- Create indexes for performance
CREATE INDEX idx_sequence_steps_sequence_id ON public.sequence_steps(sequence_id);
CREATE INDEX idx_lead_sequences_lead_id ON public.lead_sequences(lead_id);
CREATE INDEX idx_lead_sequences_status ON public.lead_sequences(status);
CREATE INDEX idx_step_executions_lead_sequence_id ON public.sequence_step_executions(lead_sequence_id);