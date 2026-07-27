-- ─────────────────────────────────────────────────────────────────────
-- Prospect lists — salespeople build a targeted list, triage it, then import
-- the keepers as leads.
--
-- Why new tables rather than reusing power_call_lists: that table drives a
-- calling session over leads that ALREADY exist (static_lead_ids uuid[] → leads).
-- List building happens *before* anything is a lead. Forcing it through
-- power_call_lists would mean creating leads first, which collides with the
-- per-user open-lead cap and pollutes the private-by-default lead space with
-- unqualified rows.
--
-- Flow:  build → score/resolve websites → triage (keep/discard) → import
--        prospect_lists ─┬─ prospect_list_items ──→ leads
--                        └─ (optionally backed by lead_pool rows)
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1) Opportunity score — give it a single home
-- ============================================================================
-- There was nowhere to put a lead-level score: business_fit_score is an
-- uncalibrated LLM number and detected_problems is a jsonb blob. Note that
-- power_call_lists.dynamic_sort already defaults to 'priority_desc' against a
-- priority column that never existed — this is that column.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS opportunity_score          integer,
  ADD COLUMN IF NOT EXISTS opportunity_score_version  text,
  ADD COLUMN IF NOT EXISTS main_issue_code            text,
  ADD COLUMN IF NOT EXISTS scored_at                  timestamptz,
  ADD COLUMN IF NOT EXISTS website_source             text,
  ADD COLUMN IF NOT EXISTS website_confidence         numeric;

CREATE INDEX IF NOT EXISTS idx_leads_opportunity_score
  ON public.leads (organization_id, opportunity_score DESC NULLS LAST);

ALTER TABLE public.lead_pool
  ADD COLUMN IF NOT EXISTS opportunity_score          integer,
  ADD COLUMN IF NOT EXISTS opportunity_score_version  text,
  ADD COLUMN IF NOT EXISTS main_issue_code            text,
  ADD COLUMN IF NOT EXISTS website_source             text,
  ADD COLUMN IF NOT EXISTS website_confidence         numeric;

-- ============================================================================
-- 2) prospect_lists
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.prospect_lists (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_by          uuid NOT NULL,
  name                text NOT NULL,
  description         text,
  status              text NOT NULL DEFAULT 'building'
                        CHECK (status IN ('building','enriching','ready','imported','archived')),
  -- How the list was built (registry filters, Places query, bbox …). Kept so a
  -- list can be explained and re-run later.
  filter_json         jsonb,
  shared_to_team      boolean NOT NULL DEFAULT false,
  item_count          integer NOT NULL DEFAULT 0,
  imported_at         timestamptz,
  imported_lead_count integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_lists_org      ON public.prospect_lists (organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_lists_creator  ON public.prospect_lists (created_by);

ALTER TABLE public.prospect_lists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org users create prospect_lists" ON public.prospect_lists;
CREATE POLICY "Org users create prospect_lists" ON public.prospect_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Read own or shared prospect_lists" ON public.prospect_lists;
CREATE POLICY "Read own or shared prospect_lists" ON public.prospect_lists
  FOR SELECT TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (created_by = auth.uid() OR shared_to_team OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Owner or admin update prospect_lists" ON public.prospect_lists;
CREATE POLICY "Owner or admin update prospect_lists" ON public.prospect_lists
  FOR UPDATE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

DROP POLICY IF EXISTS "Owner or admin delete prospect_lists" ON public.prospect_lists;
CREATE POLICY "Owner or admin delete prospect_lists" ON public.prospect_lists
  FOR DELETE TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  );

-- ============================================================================
-- 3) prospect_list_items
-- ============================================================================
-- Company fields are denormalised rather than only pointing at lead_pool, so a
-- list stays stable if the pool row is cleaned up, and so Google Places results
-- (which have no pool row) can live in the same list.
CREATE TABLE IF NOT EXISTS public.prospect_list_items (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id                   uuid NOT NULL REFERENCES public.prospect_lists(id) ON DELETE CASCADE,
  organization_id           uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pool_id                   uuid REFERENCES public.lead_pool(id) ON DELETE SET NULL,

  company_name              text NOT NULL,
  org_number                text,
  city                      text,
  address                   text,
  postal_code               text,
  phone                     text,
  email                     text,
  industry                  text,
  sni_codes                 text[],

  -- Website resolution (the capability the CRM lacks today)
  website                   text,
  website_status            text NOT NULL DEFAULT 'unknown'
                              CHECK (website_status IN
                                ('unknown','linked','discovered','none_found','verify_failed')),
  website_source            text,
  website_confidence        numeric,
  website_evidence          jsonb,

  -- Versioned scoring
  opportunity_score         integer,
  opportunity_score_version text,
  main_issue_code           text,
  score_reasons             jsonb,
  scored_at                 timestamptz,

  -- Triage + import
  review_status             text CHECK (review_status IN ('keep','discard')),
  imported_lead_id          uuid REFERENCES public.leads(id) ON DELETE SET NULL,
  duplicate_of_lead_id      uuid REFERENCES public.leads(id) ON DELETE SET NULL,

  source                    text NOT NULL DEFAULT 'company_registry',
  source_data               jsonb,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prospect_items_list  ON public.prospect_list_items (list_id);
CREATE INDEX IF NOT EXISTS idx_prospect_items_org   ON public.prospect_list_items (organization_id);
CREATE INDEX IF NOT EXISTS idx_prospect_items_score
  ON public.prospect_list_items (list_id, opportunity_score DESC NULLS LAST);
-- Dedupe inside a list. Partial, because org_number is genuinely unknown for
-- some Places results.
CREATE UNIQUE INDEX IF NOT EXISTS idx_prospect_items_list_orgnr
  ON public.prospect_list_items (list_id, org_number)
  WHERE org_number IS NOT NULL;

ALTER TABLE public.prospect_list_items ENABLE ROW LEVEL SECURITY;

-- Item access follows the parent list exactly.
DROP POLICY IF EXISTS "Read prospect_list_items via list" ON public.prospect_list_items;
CREATE POLICY "Read prospect_list_items via list" ON public.prospect_list_items
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospect_lists l
    WHERE l.id = list_id
      AND l.organization_id = public.get_user_organization_id(auth.uid())
      AND (l.created_by = auth.uid() OR l.shared_to_team OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Write prospect_list_items via list" ON public.prospect_list_items;
CREATE POLICY "Write prospect_list_items via list" ON public.prospect_list_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospect_lists l
    WHERE l.id = list_id
      AND l.organization_id = public.get_user_organization_id(auth.uid())
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Update prospect_list_items via list" ON public.prospect_list_items;
CREATE POLICY "Update prospect_list_items via list" ON public.prospect_list_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospect_lists l
    WHERE l.id = list_id
      AND l.organization_id = public.get_user_organization_id(auth.uid())
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.prospect_lists l
    WHERE l.id = list_id
      AND l.organization_id = public.get_user_organization_id(auth.uid())
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

DROP POLICY IF EXISTS "Delete prospect_list_items via list" ON public.prospect_list_items;
CREATE POLICY "Delete prospect_list_items via list" ON public.prospect_list_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.prospect_lists l
    WHERE l.id = list_id
      AND l.organization_id = public.get_user_organization_id(auth.uid())
      AND (l.created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

-- Keep item_count honest without the client having to maintain it.
CREATE OR REPLACE FUNCTION public.sync_prospect_list_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.prospect_lists
     SET item_count = (SELECT count(*) FROM public.prospect_list_items i
                        WHERE i.list_id = COALESCE(NEW.list_id, OLD.list_id)),
         updated_at = now()
   WHERE id = COALESCE(NEW.list_id, OLD.list_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_prospect_list_count ON public.prospect_list_items;
CREATE TRIGGER trg_sync_prospect_list_count
  AFTER INSERT OR DELETE ON public.prospect_list_items
  FOR EACH ROW EXECUTE FUNCTION public.sync_prospect_list_count();

-- ============================================================================
-- 4) Flag items that already exist as leads in the org
-- ============================================================================
-- Runs against the normalised org_number key added in 20260727130000. Marking
-- rather than deleting: the salesperson should see "already worked by X".
CREATE OR REPLACE FUNCTION public.mark_prospect_list_duplicates(_list_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
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
     AND i.org_number IS NOT NULL
     AND l.organization_id = v_org
     AND l.org_number = i.org_number
     AND i.duplicate_of_lead_id IS NULL;

  GET DIAGNOSTICS v_marked = ROW_COUNT;
  RETURN v_marked;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.mark_prospect_list_duplicates(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_prospect_list_duplicates(uuid) TO authenticated;

-- ============================================================================
-- 5) Import the keepers as leads
-- ============================================================================
-- This is the "importera som leads" step. It respects the per-user open-lead cap
-- (organizations.max_open_leads_per_user, enforced by enforce_lead_assignment_rules)
-- by importing up to the remaining headroom and reporting what was left, rather
-- than letting the trigger abort the whole batch.
CREATE OR REPLACE FUNCTION public.import_prospect_list_to_leads(
  _list_id uuid,
  _only_keepers boolean DEFAULT true
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
  r            record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

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
      website_source, website_confidence
    ) VALUES (
      v_org, r.company_name, r.org_number, r.phone, r.email, r.website,
      v_uid, v_uid, 'prospect_list',
      jsonb_build_object(
        'prospect_list_id', _list_id,
        'prospect_item_id', r.id,
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
      CASE WHEN r.website IS NOT NULL THEN 'pending' ELSE 'needs_enrichment' END,
      true,
      r.opportunity_score, r.opportunity_score_version, r.main_issue_code, r.scored_at,
      r.website_source, r.website_confidence
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

REVOKE EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_prospect_list_to_leads(uuid, boolean) TO authenticated;
