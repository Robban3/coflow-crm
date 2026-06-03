
-- Enums
CREATE TYPE public.ticket_type AS ENUM ('sales', 'support', 'onboarding', 'other');
CREATE TYPE public.ticket_status AS ENUM ('new', 'open', 'in_progress', 'waiting', 'resolved', 'closed');
CREATE TYPE public.ticket_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Add tickets to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'tickets';

-- Tickets table
CREATE TABLE public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id),
  title text NOT NULL,
  description text,
  type ticket_type NOT NULL DEFAULT 'support',
  status ticket_status NOT NULL DEFAULT 'new',
  priority ticket_priority NOT NULL DEFAULT 'medium',
  created_by uuid,
  assigned_to uuid,
  customer_id uuid REFERENCES public.customers(id),
  lead_id uuid REFERENCES public.leads(id),
  document_id uuid REFERENCES public.documents(id),
  due_date timestamptz,
  resolved_at timestamptz,
  tags text[] DEFAULT '{}',
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ticket comments table
CREATE TABLE public.ticket_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  user_id uuid,
  content text NOT NULL,
  is_internal boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_tickets_org ON public.tickets(organization_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_assigned ON public.tickets(assigned_to);
CREATE INDEX idx_ticket_comments_ticket ON public.ticket_comments(ticket_id);

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for tickets
CREATE POLICY "Users can view org tickets" ON public.tickets
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert org tickets" ON public.tickets
  FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update org tickets" ON public.tickets
  FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can delete org tickets" ON public.tickets
  FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id(auth.uid()));

-- RLS policies for ticket_comments
CREATE POLICY "Users can view ticket comments" ON public.ticket_comments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
    AND t.organization_id = public.get_user_organization_id(auth.uid())
  ));

CREATE POLICY "Users can insert ticket comments" ON public.ticket_comments
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id
    AND t.organization_id = public.get_user_organization_id(auth.uid())
  ));

-- Auto-set organization_id trigger
CREATE TRIGGER set_tickets_org_id
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.set_organization_id_from_user();

-- Updated_at trigger
CREATE TRIGGER set_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create sales ticket when document is accepted
CREATE OR REPLACE FUNCTION public.auto_create_ticket_on_document_accept()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    INSERT INTO public.tickets (
      organization_id, title, description, type, status, priority,
      created_by, customer_id, lead_id, document_id
    ) VALUES (
      NEW.organization_id,
      'Nytt avtal signerat: ' || NEW.title,
      'Automatiskt skapat ärende för signerat avtal.',
      'sales', 'new', 'high',
      NEW.created_by, NEW.customer_id, NEW.lead_id, NEW.id
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_ticket_on_doc_accept
  AFTER UPDATE ON public.documents
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_ticket_on_document_accept();

-- Update handle_new_user to include tickets module
CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, onboarding_completed)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', false);
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  INSERT INTO public.user_modules (user_id, module)
  SELECT NEW.id, m.module
  FROM unnest(ARRAY['customers', 'web_analysis', 'outreach', 'tasks', 'reports', 'leads', 'pipeline', 'tickets']::app_module[]) AS m(module);
  
  RETURN NEW;
END;
$$;
