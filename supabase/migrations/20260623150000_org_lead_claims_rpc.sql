-- Prospecting grey-out support.
--
-- Leads are private (a user only sees their own), but the prospecting search
-- must still grey out companies already claimed by ANYONE in the org so two
-- users don't work the same company. This SECURITY DEFINER function exposes
-- only the minimal identifying fields + owner name needed for that dedup —
-- never the private lead details — scoped to the caller's organization.
CREATE OR REPLACE FUNCTION public.get_org_lead_claims()
RETURNS TABLE (
  id uuid,
  company_name text,
  website text,
  email text,
  enrichment_status text,
  auto_draft_generated boolean,
  owner_id uuid,
  owner_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    l.id,
    l.company_name::text,
    l.website::text,
    l.email::text,
    l.enrichment_status::text,
    l.auto_draft_generated,
    COALESCE(l.assigned_to, l.created_by) AS owner_id,
    p.full_name::text AS owner_name
  FROM public.leads l
  LEFT JOIN public.profiles p ON p.id = COALESCE(l.assigned_to, l.created_by)
  WHERE l.organization_id = public.get_user_organization_id(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_org_lead_claims() TO authenticated;
