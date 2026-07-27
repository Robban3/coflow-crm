-- ─────────────────────────────────────────────────────────────────────
-- Lägesmedveten import + symmetrisk dubblettkontroll.
--
-- Bakgrund: importen anmälde varje lead till e-postutskicks-pipelinen genom att
-- sätta imported_via_prospecting=true + enrichment_status='pending'. Det gav tre
-- fel på en gång:
--   1. Inget hände — RPC:n anropar aldrig process-enrichment-queue, så leadsen
--      låg som "Väntar" tills någon råkade öppna Kö-fliken.
--   2. När den väl kördes skrev auto-enrich-lead över analysen med sin egen,
--      och kunde slänga leaden helt via sin tysta business_fit_score < 3-grind.
--   3. Leads utan webbplats fick 'needs_enrichment' och hamnade i ett läge som
--      varken kö-jobbet eller filterchipsen kände till.
--
-- Listans analys (webbplats → poäng → prestanda) och auto-enrich-lead (crawl →
-- AI-utkast) är två olika jobb för två olika säljmotioner. De ska inte köras på
-- samma lead som default. Läget väljs nu på listan i stället.
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1) import_prospect_list_to_leads — nu med _mode
-- ============================================================================
-- DROP först: CREATE OR REPLACE med ett nytt defaultat argument skapar en ANDRA
-- överlagring, och det befintliga 2-argumentsanropet failar då med
-- "function ... is not unique".
DROP FUNCTION IF EXISTS public.import_prospect_list_to_leads(uuid, boolean);

CREATE OR REPLACE FUNCTION public.import_prospect_list_to_leads(
  _list_id      uuid,
  _only_keepers boolean DEFAULT true,
  _mode         text DEFAULT 'call'
)
RETURNS TABLE(imported integer, skipped_duplicates integer, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org        uuid;
  v_uid        uuid := auth.uid();
  v_cap        integer;
  v_open       integer;
  v_headroom   integer;
  v_imported   integer := 0;
  v_dupes      integer := 0;
  v_candidates integer;
  v_outreach   boolean;
  r            record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF _mode NOT IN ('call', 'outreach') THEN
    RAISE EXCEPTION 'unknown mode: %', _mode;
  END IF;
  v_outreach := (_mode = 'outreach');

  SELECT organization_id INTO v_org FROM public.prospect_lists WHERE id = _list_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_organization_id(v_uid) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  -- Refresh duplicate flags so the count reported back is accurate.
  PERFORM public.mark_prospect_list_duplicates(_list_id);

  SELECT COALESCE(o.max_open_leads_per_user, 50) INTO v_cap
    FROM public.organizations o WHERE o.id = v_org;

  SELECT count(*) INTO v_open
    FROM public.leads l
   WHERE l.assigned_to = v_uid
     AND public.lead_is_open(l.lead_status);

  v_headroom := GREATEST(v_cap - v_open, 0);

  SELECT count(*) INTO v_candidates
    FROM public.prospect_list_items i
   WHERE i.list_id = _list_id
     AND i.imported_lead_id IS NULL
     AND i.duplicate_of_lead_id IS NULL
     AND (NOT _only_keepers OR i.review_status = 'keep');

  FOR r IN
    SELECT * FROM public.prospect_list_items i
     WHERE i.list_id = _list_id
       AND i.imported_lead_id IS NULL
       AND i.duplicate_of_lead_id IS NULL
       AND (NOT _only_keepers OR i.review_status = 'keep')
     ORDER BY i.opportunity_score DESC NULLS LAST, i.created_at
     LIMIT v_headroom
  LOOP
    INSERT INTO public.leads (
      organization_id, company_name, org_number, phone, email, website,
      created_by, assigned_to, source, source_data, lead_status,
      enrichment_status, imported_via_prospecting,
      opportunity_score, opportunity_score_version, main_issue_code, scored_at,
      website_source, website_confidence,
      created_at
    ) VALUES (
      v_org, r.company_name, r.org_number, r.phone, r.email, r.website,
      v_uid, v_uid, 'prospect_list',
      jsonb_build_object(
        'prospect_list_id', _list_id,
        'prospect_item_id', r.id,
        'org_number', r.org_number,
        'city', r.city,
        'address', r.address,
        'postal_code', r.postal_code,
        'industry', r.industry,
        'sni_codes', r.sni_codes,
        'website_evidence', r.website_evidence,
        'score_reasons', r.score_reasons,
        'origin', r.source
      ),
      'active',
      -- 'call'     → redan analyserad, ska INTE röras av e-postpipelinen.
      -- 'outreach' → dagens beteende; kön plockar upp den och skriver utkast.
      CASE
        WHEN NOT v_outreach THEN 'needs_enrichment'
        WHEN r.website IS NOT NULL THEN 'pending'
        ELSE 'needs_enrichment'
      END,
      v_outreach,
      r.opportunity_score, r.opportunity_score_version, r.main_issue_code, r.scored_at,
      r.website_source, r.website_confidence,
      -- now() är transaktionskonstant, så hela importen fick identisk tidsstämpel
      -- och listans poängordning kollapsade i lead-vyn (som sorterar på
      -- created_at DESC). clock_timestamp() går framåt inom transaktionen.
      clock_timestamp()
    )
    RETURNING id INTO r.imported_lead_id;

    UPDATE public.prospect_list_items
       SET imported_lead_id = r.imported_lead_id
     WHERE id = r.id;

    v_imported := v_imported + 1;
  END LOOP;

  SELECT count(*) INTO v_dupes
    FROM public.prospect_list_items i
   WHERE i.list_id = _list_id AND i.duplicate_of_lead_id IS NOT NULL;

  UPDATE public.prospect_lists
     SET imported_at = now(),
         imported_lead_count = imported_lead_count + v_imported,
         status = CASE WHEN v_imported >= v_candidates THEN 'imported' ELSE status END,
         updated_at = now()
   WHERE id = _list_id;

  RETURN QUERY SELECT v_imported, v_dupes, GREATEST(v_candidates - v_imported, 0);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean, text) TO authenticated;

-- ============================================================================
-- 2) mark_prospect_list_duplicates — matcha även Google Places-rader
-- ============================================================================
-- Matchade bara på org_number. Google Places-träffar har inget org.nr, så
-- dubblettkontrollen var en ren no-op för exakt den källa där den gamla
-- importvägen dedupade bäst (normaliserad webbplats + företagsnamn).
CREATE OR REPLACE FUNCTION public.mark_prospect_list_duplicates(_list_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org    uuid;
  v_marked integer;
BEGIN
  SELECT organization_id INTO v_org FROM public.prospect_lists WHERE id = _list_id;
  IF v_org IS NULL OR v_org IS DISTINCT FROM public.get_user_organization_id(auth.uid()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.prospect_list_items i
     SET duplicate_of_lead_id = l.id
    FROM public.leads l
   WHERE i.list_id = _list_id
     AND i.duplicate_of_lead_id IS NULL
     AND l.organization_id = v_org
     AND (
       -- 1. Org.nr — starkast, men saknas för Places-träffar.
       (i.org_number IS NOT NULL AND l.org_number = i.org_number)
       -- 2. Samma webbplatsvärd, normaliserad (protokoll, www och avslutande /).
       OR (
         i.website IS NOT NULL AND l.website IS NOT NULL
         AND rtrim(lower(regexp_replace(i.website, '^https?://(www\.)?', '')), '/')
           = rtrim(lower(regexp_replace(l.website, '^https?://(www\.)?', '')), '/')
       )
       -- 3. Namn OCH ort. Namn ensamt över en hel organisations leads är för
       --    löst — "Salong Domingo" finns i flera städer.
       OR (
         i.city IS NOT NULL
         AND lower(btrim(i.company_name)) = lower(btrim(l.company_name))
         AND lower(btrim(i.city)) = lower(btrim(COALESCE(l.source_data->>'city', '')))
       )
     );

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_prospect_list_duplicates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_prospect_list_duplicates(uuid) TO authenticated;

-- Stödindex för namnmatchningen ovan.
CREATE INDEX IF NOT EXISTS idx_leads_company_name_lower
  ON public.leads (organization_id, lower(btrim(company_name)));
