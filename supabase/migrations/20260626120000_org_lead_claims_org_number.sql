-- Add org_number to the org-wide claims RPC so the register-prospecting search
-- can hide companies already imported by ANYONE in the org — not just the
-- caller. Leads are private (RLS scopes them per owner), so the register search
-- previously deduped against only the caller's own leads: if Alex imported 50
-- companies, Hugo running the same search a week later still saw all 50 and
-- could re-import them as duplicates. Exposing org_number through this
-- SECURITY DEFINER function closes that hole the same way company_name/website
-- already do for the Google Places flow.
CREATE OR REPLACE FUNCTION public.get_org_lead_claims()
RETURNS TABLE (
  id uuid,
  company_name text,
  website text,
  email text,
  org_number text,
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
    l.org_number::text,
    l.enrichment_status::text,
    l.auto_draft_generated,
    COALESCE(l.assigned_to, l.created_by) AS owner_id,
    p.full_name::text AS owner_name
  FROM public.leads l
  LEFT JOIN public.profiles p ON p.id = COALESCE(l.assigned_to, l.created_by)
  WHERE l.organization_id = public.get_user_organization_id(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_org_lead_claims() TO authenticated;
