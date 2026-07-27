-- Återställer 2-argumentsvarianten av import_prospect_list_to_leads.
--
-- Tier 0 (migration 20260728100000) DROPpade den och ersatte den med en
-- 3-argumentsversion med ett _mode-argument. Den koden är nu revertad, så
-- frontend anropar återigen 2-argumentsformen — men databasen har bara
-- 3-argumentsversionen kvar, och anropet skulle failas med
-- "function ... does not exist".
--
-- Lösning: lägg tillbaka 2-argumentsvarianten som en tunn wrapper. Den
-- vidarebefordrar till 'outreach', vilket är exakt det beteende som gällde före
-- Tier 0 (imported_via_prospecting = true, enrichment_status = 'pending').
--
-- 3-argumentsversionen lämnas kvar. Den är oanropad men gör ingen skada, och
-- finns kvar om lägesuppdelningen tas upp igen.

CREATE OR REPLACE FUNCTION public.import_prospect_list_to_leads(
  _list_id      uuid,
  _only_keepers boolean DEFAULT true
)
RETURNS TABLE(imported integer, skipped_duplicates integer, remaining integer)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT * FROM public.import_prospect_list_to_leads(_list_id, _only_keepers, 'outreach');
$$;

REVOKE EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean) TO authenticated;
