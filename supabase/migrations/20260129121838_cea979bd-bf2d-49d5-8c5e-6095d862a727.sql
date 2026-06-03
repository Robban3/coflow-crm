-- AUTO-POPULATE organization_id FROM USER PROFILE ON INSERT
-- This is the SAFEST approach - the database automatically sets organization_id
-- from the inserting user's profile, so frontend code doesn't need changes

-- Create a function that auto-sets organization_id from the user's profile
CREATE OR REPLACE FUNCTION public.set_organization_id_from_user()
RETURNS TRIGGER AS $$
DECLARE
  user_org_id uuid;
BEGIN
  -- Get the organization_id from the user's profile
  SELECT organization_id INTO user_org_id
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Set it on the new record if not already set
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := user_org_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create triggers for all data tables

-- leads
DROP TRIGGER IF EXISTS set_leads_org_id ON public.leads;
CREATE TRIGGER set_leads_org_id
  BEFORE INSERT ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- tasks
DROP TRIGGER IF EXISTS set_tasks_org_id ON public.tasks;
CREATE TRIGGER set_tasks_org_id
  BEFORE INSERT ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- customers
DROP TRIGGER IF EXISTS set_customers_org_id ON public.customers;
CREATE TRIGGER set_customers_org_id
  BEFORE INSERT ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- sent_emails
DROP TRIGGER IF EXISTS set_sent_emails_org_id ON public.sent_emails;
CREATE TRIGGER set_sent_emails_org_id
  BEFORE INSERT ON public.sent_emails
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- web_analyses
DROP TRIGGER IF EXISTS set_web_analyses_org_id ON public.web_analyses;
CREATE TRIGGER set_web_analyses_org_id
  BEFORE INSERT ON public.web_analyses
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- activities
DROP TRIGGER IF EXISTS set_activities_org_id ON public.activities;
CREATE TRIGGER set_activities_org_id
  BEFORE INSERT ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- outreach_sequences
DROP TRIGGER IF EXISTS set_outreach_sequences_org_id ON public.outreach_sequences;
CREATE TRIGGER set_outreach_sequences_org_id
  BEFORE INSERT ON public.outreach_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- email_templates
DROP TRIGGER IF EXISTS set_email_templates_org_id ON public.email_templates;
CREATE TRIGGER set_email_templates_org_id
  BEFORE INSERT ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- email_campaigns
DROP TRIGGER IF EXISTS set_email_campaigns_org_id ON public.email_campaigns;
CREATE TRIGGER set_email_campaigns_org_id
  BEFORE INSERT ON public.email_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- lead_fleet_data
DROP TRIGGER IF EXISTS set_lead_fleet_data_org_id ON public.lead_fleet_data;
CREATE TRIGGER set_lead_fleet_data_org_id
  BEFORE INSERT ON public.lead_fleet_data
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- lead_sequences
DROP TRIGGER IF EXISTS set_lead_sequences_org_id ON public.lead_sequences;
CREATE TRIGGER set_lead_sequences_org_id
  BEFORE INSERT ON public.lead_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- sequence_steps
DROP TRIGGER IF EXISTS set_sequence_steps_org_id ON public.sequence_steps;
CREATE TRIGGER set_sequence_steps_org_id
  BEFORE INSERT ON public.sequence_steps
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

-- sequence_step_executions
DROP TRIGGER IF EXISTS set_sequence_step_executions_org_id ON public.sequence_step_executions;
CREATE TRIGGER set_sequence_step_executions_org_id
  BEFORE INSERT ON public.sequence_step_executions
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();