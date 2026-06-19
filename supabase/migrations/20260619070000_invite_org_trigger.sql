-- organization_invites inserts from the app don't set organization_id, so the
-- RLS WITH CHECK (organization_id = get_user_organization_id(auth.uid())) failed.
-- Auto-set it from the user's profile, like leads/tasks/etc. already do.
DROP TRIGGER IF EXISTS set_organization_invites_org_id ON public.organization_invites;
CREATE TRIGGER set_organization_invites_org_id
  BEFORE INSERT ON public.organization_invites
  FOR EACH ROW EXECUTE FUNCTION public.set_organization_id_from_user();
