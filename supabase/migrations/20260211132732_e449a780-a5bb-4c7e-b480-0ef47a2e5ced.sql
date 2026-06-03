-- Auto-assign creator as lead member when lead is created
CREATE OR REPLACE FUNCTION public.auto_assign_lead_creator()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.lead_members (lead_id, user_id, role, added_by, organization_id)
    VALUES (NEW.id, NEW.created_by, 'owner', NEW.created_by, NEW.organization_id)
    ON CONFLICT (lead_id, user_id) DO NOTHING;
  END IF;
  
  -- Also set assigned_to for backward compatibility
  IF NEW.assigned_to IS NULL AND NEW.created_by IS NOT NULL THEN
    NEW.assigned_to := NEW.created_by;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER auto_assign_lead_creator_trigger
AFTER INSERT ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_lead_creator();
