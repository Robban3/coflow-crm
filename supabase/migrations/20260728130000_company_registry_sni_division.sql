-- ─────────────────────────────────────────────────────────────────────
-- SNI-division på company_registry, så poolen kan fyllas per bransch.
--
-- company_registry.sni_codes är `text` (rå CSV-sträng, komma/semikolon-separerad)
-- och helt oindexerat. Den enda indexerade branschvägen idag är trigram-OR:et mot
-- sni_descriptions/business_description — utmärkt för en sidad UI-sökning, men
-- oanvändbart för att skanna miljontals rader vid poolpåfyllning.
--
-- SNI-divisionen (de två första siffrorna) är den grovhet en bransch faktiskt
-- motsvarar: 43 = bygg, 56 = restaurang, 96 = frisör/skönhet, osv.
--
-- OBS: vanlig kolumn + batchad backfill, INTE en genererad kolumn. En STORED
-- generated column skriver om hela tabellen under ACCESS EXCLUSIVE, vilket
-- skulle frysa den live prospekteringssökningen under hela omskrivningen.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_registry
  ADD COLUMN IF NOT EXISTS sni_division text;

-- Håll kolumnen aktuell för allt som skrivs framåt (CSV-import, backfill-jobb).
CREATE OR REPLACE FUNCTION public.set_company_registry_sni_division()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.sni_division := nullif(
    substring(regexp_replace(coalesce(NEW.sni_codes, ''), '\D', '', 'g') from 1 for 2),
    ''
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_company_registry_sni_division ON public.company_registry;
CREATE TRIGGER trg_company_registry_sni_division
  BEFORE INSERT OR UPDATE OF sni_codes ON public.company_registry
  FOR EACH ROW EXECUTE FUNCTION public.set_company_registry_sni_division();

-- Backfill av befintliga rader.
--
-- En rak UPDATE, inte en batchad loop med COMMIT: supabase db push kör varje
-- migrationsfil i en transaktion, och COMMIT inuti ett DO-block är då ett fel
-- ("invalid transaction termination").
--
-- Det är heller inte ett problem här. UPDATE tar ROW EXCLUSIVE, som inte
-- konfliktar med SELECT — tack vare MVCC läser prospekteringssökningen den
-- gamla radversionen under tiden och blockeras aldrig. Det var den genererade
-- kolumnen som hade tagit ACCESS EXCLUSIVE och frusit tabellen.
--
-- Kostnaden är en lång transaktion och en del tabellbloat. Kör utanför
-- kontorstid och överväg VACUUM (ANALYZE) public.company_registry efteråt.
UPDATE public.company_registry
   SET sni_division = nullif(
         substring(regexp_replace(sni_codes, '\D', '', 'g') from 1 for 2), ''
       )
 WHERE sni_division IS NULL
   AND sni_codes IS NOT NULL;

-- Poolpåfyllningen filtrerar på division och avgränsar geografiskt på
-- postnummerprefix (samma mönster som COUNTIES i src/lib/swedishProspecting.ts).
CREATE INDEX IF NOT EXISTS idx_company_registry_sni_division
  ON public.company_registry (sni_division, postal_code)
  WHERE sni_division IS NOT NULL;
