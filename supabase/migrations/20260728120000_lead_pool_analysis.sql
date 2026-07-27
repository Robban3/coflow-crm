-- ─────────────────────────────────────────────────────────────────────
-- lead_pool blir den färdiganalyserade företagspoolen.
--
-- Tabellen har rätt form sedan tidigare (org-bred läsning, admin-skrivning, och
-- service_role passerar RLS) men har aldrig haft någon skrivare och saknar de
-- kolumner analysfunktionerna behöver. Det åtgärdas här, tillsammans med
-- servering: marknad, bransch och ett claim-fält som ersätter power_call_locks.
--
-- Varför claim på raden i stället för power_call_locks: låstabellens FK pekar på
-- leads, så poolrader går inte att låsa alls. Dessutom skriver dess
-- upsert(onConflict:"lead_id") ÖVER i stället för att kollidera, så låset kan
-- aldrig misslyckas och utesluter därmed ingen. claimed_by/claimed_until med en
-- villkorad UPDATE ger äkta ömsesidig uteslutning.
-- ─────────────────────────────────────────────────────────────────────

-- ============================================================================
-- 1) Analys- och serveringskolumner
-- ============================================================================
ALTER TABLE public.lead_pool
  -- Marknad finns idag bara i localStorage (useMarket.ts) och på
  -- outreach_sequences. Här blir den en egenskap hos företaget.
  ADD COLUMN IF NOT EXISTS market            text NOT NULL DEFAULT 'SE',
  -- industry behålls som rå sni_descriptions för visning; industry_key är den
  -- normaliserade nyckel man faktiskt filtrerar på. Fritext med exakt .in()
  -- överlever inte kontakt med riktig data.
  ADD COLUMN IF NOT EXISTS industry_key      text,

  ADD COLUMN IF NOT EXISTS website_status    text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS website_evidence  jsonb,
  ADD COLUMN IF NOT EXISTS score_reasons     jsonb,
  ADD COLUMN IF NOT EXISTS scored_at         timestamptz,

  ADD COLUMN IF NOT EXISTS psi_performance   integer,
  ADD COLUMN IF NOT EXISTS psi_accessibility integer,
  ADD COLUMN IF NOT EXISTS psi_seo           integer,
  ADD COLUMN IF NOT EXISTS psi_checked_at    timestamptz,

  -- Claim ersätter power_call_locks. TTL förnyas av session-state-heartbeaten,
  -- så det kan inte längre löpa ut mitt i ett samtal.
  ADD COLUMN IF NOT EXISTS claimed_by        uuid,
  ADD COLUMN IF NOT EXISTS claimed_until     timestamptz,

  -- Lat befordran: "ej svar" och skip skapar ingen lead, de bumpar bara detta.
  ADD COLUMN IF NOT EXISTS attempt_count     integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_attempt_at   timestamptz,

  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now();

DO $$ BEGIN
  ALTER TABLE public.lead_pool DROP CONSTRAINT IF EXISTS lead_pool_website_status_chk;
  ALTER TABLE public.lead_pool
    ADD CONSTRAINT lead_pool_website_status_chk
    CHECK (website_status IN ('unknown','linked','discovered','none_found','verify_failed'));
END $$;

CREATE OR REPLACE FUNCTION public.touch_lead_pool_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_lead_pool ON public.lead_pool;
CREATE TRIGGER trg_touch_lead_pool
  BEFORE UPDATE ON public.lead_pool
  FOR EACH ROW EXECUTE FUNCTION public.touch_lead_pool_updated_at();

-- ============================================================================
-- 2) Index
-- ============================================================================
-- Dedupe-nyckel för påfyllningen. org_nr normaliseras redan till siffror av
-- trg_normalize_pool_org_nr (20260727130000).
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_pool_org_orgnr_uniq
  ON public.lead_pool (organization_id, org_nr)
  WHERE org_nr IS NOT NULL;

-- Serveringsindexet: exakt den fråga Power Call kommer att köra.
CREATE INDEX IF NOT EXISTS idx_lead_pool_serve
  ON public.lead_pool (organization_id, market, industry_key, opportunity_score DESC)
  WHERE scored_at IS NOT NULL;

-- Köindex för de två analysstegen.
CREATE INDEX IF NOT EXISTS idx_lead_pool_resolve_queue
  ON public.lead_pool (organization_id)
  WHERE website_status = 'unknown';

CREATE INDEX IF NOT EXISTS idx_lead_pool_psi_queue
  ON public.lead_pool (organization_id)
  WHERE psi_checked_at IS NULL AND website_status IN ('linked','discovered');

-- ============================================================================
-- 3) Admins måste kunna städa sin egen pool
-- ============================================================================
-- Tabellen har SELECT (org-bred), INSERT och UPDATE (admin) men ingen
-- DELETE-policy alls sedan 20260218214156.
DROP POLICY IF EXISTS "Admins can delete lead_pool" ON public.lead_pool;
CREATE POLICY "Admins can delete lead_pool"
  ON public.lead_pool FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id(auth.uid())
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ============================================================================
-- 4) En lead per poolrad
-- ============================================================================
-- promotePoolToLead är SELECT-then-INSERT utan unik constraint, och
-- power-call-prepare-next avfyras garanterat två gånger. Det har med stor
-- sannolikhet redan skapat dubbletter.
--
-- Städningen är AVSIKTLIGT icke-destruktiv: inga leads raderas och inga
-- främmande nycklar pekas om. Behåll kopplingen på den rad som faktiskt har
-- bearbetats (senaste samtal, annars äldst) och nolla lead_pool_id på
-- resten. All data står kvar; bara poolkopplingen blir unik.
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY organization_id, lead_pool_id
           ORDER BY last_call_at DESC NULLS LAST, created_at ASC
         ) AS rn
  FROM public.leads
  WHERE lead_pool_id IS NOT NULL
)
UPDATE public.leads l
   SET lead_pool_id = NULL
  FROM ranked r
 WHERE l.id = r.id
   AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_lead_pool_uniq
  ON public.leads (organization_id, lead_pool_id)
  WHERE lead_pool_id IS NOT NULL;
