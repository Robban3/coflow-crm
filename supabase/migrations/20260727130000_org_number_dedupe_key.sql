-- ─────────────────────────────────────────────────────────────────────
-- Make organisationsnummer a deterministic dedupe key.
--
-- `leads.org_number` was added as a bare `ALTER TABLE ... ADD COLUMN org_number
-- TEXT` with no index and no constraint. Four separate import paths normalise it
-- differently (some strip non-digits, some don't), so '556018-7493' and
-- '5560187493' coexist and dedupe silently misses. Org number is the join key
-- the Lead Factory merge depends on, so it has to be deterministic first.
--
-- NOTE: this migration deliberately does NOT add a UNIQUE constraint. Existing
-- duplicates would make that fail, and the only way to satisfy it automatically
-- would be deleting leads — which is destructive and is a human decision. It
-- normalises, indexes, and enforces the format going forward, then gives you an
-- RPC to review the duplicates that already exist.
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1) Normalise existing values to digits only
-- ============================================================================
UPDATE public.leads
SET org_number = nullif(regexp_replace(org_number, '\D', '', 'g'), '')
WHERE org_number IS NOT NULL
  AND org_number IS DISTINCT FROM nullif(regexp_replace(org_number, '\D', '', 'g'), '');

UPDATE public.lead_pool
SET org_nr = nullif(regexp_replace(org_nr, '\D', '', 'g'), '')
WHERE org_nr IS NOT NULL
  AND org_nr IS DISTINCT FROM nullif(regexp_replace(org_nr, '\D', '', 'g'), '');

-- ============================================================================
-- 2) Enforce the format on every future write
-- ============================================================================
CREATE OR REPLACE FUNCTION public.normalize_lead_org_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.org_number IS NOT NULL THEN
    NEW.org_number := nullif(regexp_replace(NEW.org_number, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_lead_org_number ON public.leads;
CREATE TRIGGER trg_normalize_lead_org_number
  BEFORE INSERT OR UPDATE OF org_number ON public.leads
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_lead_org_number();

CREATE OR REPLACE FUNCTION public.normalize_pool_org_nr()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.org_nr IS NOT NULL THEN
    NEW.org_nr := nullif(regexp_replace(NEW.org_nr, '\D', '', 'g'), '');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_normalize_pool_org_nr ON public.lead_pool;
CREATE TRIGGER trg_normalize_pool_org_nr
  BEFORE INSERT OR UPDATE OF org_nr ON public.lead_pool
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_pool_org_nr();

-- ============================================================================
-- 3) Index the dedupe lookup
-- ============================================================================
-- Scoped by organisation: the same company legitimately exists as a lead in two
-- different tenants.
CREATE INDEX IF NOT EXISTS idx_leads_org_number
  ON public.leads (organization_id, org_number)
  WHERE org_number IS NOT NULL;

-- ============================================================================
-- 4) Surface existing duplicates for manual merge
-- ============================================================================
CREATE OR REPLACE FUNCTION public.find_duplicate_leads_by_org_number()
RETURNS TABLE(
  org_number text,
  lead_count bigint,
  lead_ids uuid[],
  company_names text[],
  owners uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_org := public.get_user_organization_id(auth.uid());

  RETURN QUERY
  SELECT
    l.org_number,
    count(*)::bigint          AS lead_count,
    array_agg(l.id ORDER BY l.created_at)            AS lead_ids,
    array_agg(l.company_name ORDER BY l.created_at)  AS company_names,
    array_agg(l.assigned_to ORDER BY l.created_at)   AS owners
  FROM public.leads l
  WHERE l.organization_id = v_org
    AND l.org_number IS NOT NULL
  GROUP BY l.org_number
  HAVING count(*) > 1
  ORDER BY count(*) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.find_duplicate_leads_by_org_number() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_duplicate_leads_by_org_number() TO authenticated;
