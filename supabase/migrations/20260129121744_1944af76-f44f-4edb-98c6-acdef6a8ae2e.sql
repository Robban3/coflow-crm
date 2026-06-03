-- CRITICAL SECURITY FIX: Add organization isolation to all data tables

-- 1. Create a security definer function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_organization_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = _user_id
$$;

-- 2. Add organization_id to leads table
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 3. Add organization_id to tasks table  
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 4. Add organization_id to customers table
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 5. Add organization_id to sent_emails table
ALTER TABLE public.sent_emails ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 6. Add organization_id to web_analyses table
ALTER TABLE public.web_analyses ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 7. Add organization_id to activities table
ALTER TABLE public.activities ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 8. Add organization_id to outreach_sequences table
ALTER TABLE public.outreach_sequences ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 9. Add organization_id to email_templates table
ALTER TABLE public.email_templates ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 10. Add organization_id to email_campaigns table
ALTER TABLE public.email_campaigns ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 11. Add organization_id to lead_fleet_data (via lead, but add for direct access)
ALTER TABLE public.lead_fleet_data ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 12. Add organization_id to lead_sequences
ALTER TABLE public.lead_sequences ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 13. Add organization_id to sequence_steps (inherited from sequence)
ALTER TABLE public.sequence_steps ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- 14. Add organization_id to sequence_step_executions
ALTER TABLE public.sequence_step_executions ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES public.organizations(id);

-- DROP ALL EXISTING PERMISSIVE SELECT POLICIES AND REPLACE WITH ORG-SCOPED ONES

-- LEADS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated users can insert leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update leads" ON public.leads;

CREATE POLICY "Users can view leads in their organization"
ON public.leads FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert leads in their organization"
ON public.leads FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update leads in their organization"
ON public.leads FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete leads in their organization"
ON public.leads FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- TASKS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Users can view relevant tasks" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users can insert tasks" ON public.tasks;
DROP POLICY IF EXISTS "Assigned users can update tasks" ON public.tasks;
DROP POLICY IF EXISTS "Admins can delete tasks" ON public.tasks;

CREATE POLICY "Users can view tasks in their organization"
ON public.tasks FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert tasks in their organization"
ON public.tasks FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update tasks in their organization"
ON public.tasks FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete tasks in their organization"
ON public.tasks FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- CUSTOMERS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Team members can update customers" ON public.customers;
DROP POLICY IF EXISTS "Admins can delete customers" ON public.customers;

CREATE POLICY "Users can view customers in their organization"
ON public.customers FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert customers in their organization"
ON public.customers FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update customers in their organization"
ON public.customers FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()))
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete customers in their organization"
ON public.customers FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- SENT_EMAILS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can view own sent emails or admins all" ON public.sent_emails;
DROP POLICY IF EXISTS "Authenticated users can insert sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can insert own sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "System can update sent emails" ON public.sent_emails;
DROP POLICY IF EXISTS "Users can update own sent emails" ON public.sent_emails;

CREATE POLICY "Users can view sent emails in their organization"
ON public.sent_emails FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert sent emails in their organization"
ON public.sent_emails FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update sent emails in their organization"
ON public.sent_emails FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- WEB_ANALYSES: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all analyses" ON public.web_analyses;
DROP POLICY IF EXISTS "Authenticated users can insert analyses" ON public.web_analyses;

CREATE POLICY "Users can view analyses in their organization"
ON public.web_analyses FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert analyses in their organization"
ON public.web_analyses FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

-- ACTIVITIES: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all activities" ON public.activities;
DROP POLICY IF EXISTS "Authenticated users can insert activities" ON public.activities;
DROP POLICY IF EXISTS "Users can update own activities" ON public.activities;

CREATE POLICY "Users can view activities in their organization"
ON public.activities FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert activities in their organization"
ON public.activities FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update activities in their organization"
ON public.activities FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- OUTREACH_SEQUENCES: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "Authenticated users can insert sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "Users can update own sequences" ON public.outreach_sequences;
DROP POLICY IF EXISTS "Admins can delete sequences" ON public.outreach_sequences;

CREATE POLICY "Users can view sequences in their organization"
ON public.outreach_sequences FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert sequences in their organization"
ON public.outreach_sequences FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update sequences in their organization"
ON public.outreach_sequences FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Admins can delete sequences in their organization"
ON public.outreach_sequences FOR DELETE
USING (organization_id = public.get_user_organization_id(auth.uid()) AND has_role(auth.uid(), 'admin'));

-- EMAIL_TEMPLATES: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all templates" ON public.email_templates;
DROP POLICY IF EXISTS "Authenticated users can insert templates" ON public.email_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON public.email_templates;

CREATE POLICY "Users can view templates in their organization"
ON public.email_templates FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert templates in their organization"
ON public.email_templates FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update templates in their organization"
ON public.email_templates FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- EMAIL_CAMPAIGNS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Authenticated users can insert campaigns" ON public.email_campaigns;
DROP POLICY IF EXISTS "Users can update own campaigns" ON public.email_campaigns;

CREATE POLICY "Users can view campaigns in their organization"
ON public.email_campaigns FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert campaigns in their organization"
ON public.email_campaigns FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update campaigns in their organization"
ON public.email_campaigns FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- LEAD_FLEET_DATA: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view fleet data" ON public.lead_fleet_data;
DROP POLICY IF EXISTS "Authenticated users can insert fleet data" ON public.lead_fleet_data;
DROP POLICY IF EXISTS "Authenticated users can update fleet data" ON public.lead_fleet_data;

CREATE POLICY "Users can view fleet data in their organization"
ON public.lead_fleet_data FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert fleet data in their organization"
ON public.lead_fleet_data FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update fleet data in their organization"
ON public.lead_fleet_data FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- LEAD_SEQUENCES: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all lead sequences" ON public.lead_sequences;
DROP POLICY IF EXISTS "Authenticated users can insert lead sequences" ON public.lead_sequences;
DROP POLICY IF EXISTS "Authenticated users can update lead sequences" ON public.lead_sequences;

CREATE POLICY "Users can view lead sequences in their organization"
ON public.lead_sequences FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can insert lead sequences in their organization"
ON public.lead_sequences FOR INSERT
WITH CHECK (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can update lead sequences in their organization"
ON public.lead_sequences FOR UPDATE
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- SEQUENCE_STEPS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all steps" ON public.sequence_steps;
DROP POLICY IF EXISTS "Authenticated users can manage steps" ON public.sequence_steps;

CREATE POLICY "Users can view steps in their organization"
ON public.sequence_steps FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage steps in their organization"
ON public.sequence_steps FOR ALL
USING (organization_id = public.get_user_organization_id(auth.uid()));

-- SEQUENCE_STEP_EXECUTIONS: Drop old policies and create org-scoped ones
DROP POLICY IF EXISTS "Authenticated users can view all executions" ON public.sequence_step_executions;
DROP POLICY IF EXISTS "Authenticated users can manage executions" ON public.sequence_step_executions;

CREATE POLICY "Users can view executions in their organization"
ON public.sequence_step_executions FOR SELECT
USING (organization_id = public.get_user_organization_id(auth.uid()));

CREATE POLICY "Users can manage executions in their organization"
ON public.sequence_step_executions FOR ALL
USING (organization_id = public.get_user_organization_id(auth.uid()));