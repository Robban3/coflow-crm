-- Belt-and-suspenders: auto-fill organization_id on these org-scoped tables too.
-- They already set it in the app; the trigger only fills it when NULL, guarding
-- against future inserts that forget it (same pattern as leads/tasks/invites).
DROP TRIGGER IF EXISTS set_quotes_org_id ON public.quotes;
CREATE TRIGGER set_quotes_org_id
  BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

DROP TRIGGER IF EXISTS set_meetings_org_id ON public.meetings;
CREATE TRIGGER set_meetings_org_id
  BEFORE INSERT ON public.meetings
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();

DROP TRIGGER IF EXISTS set_organization_pricing_org_id ON public.organization_pricing;
CREATE TRIGGER set_organization_pricing_org_id
  BEFORE INSERT ON public.organization_pricing
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();
