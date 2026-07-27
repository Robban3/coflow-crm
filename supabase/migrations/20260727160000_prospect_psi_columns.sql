-- Lighthouse-mätning per prospektrad.
--
-- Markup-analysen bottnar runt 10–25 för varje fungerande sajt, eftersom den ser
-- att sidan HAR en h1 och en viewport-tagg men inte att den tar åtta sekunder att
-- ladda på mobil. Prestanda är den signal som faktiskt skiljer en sliten sajt
-- från en fräsch, och den går bara att mäta med ett riktigt Lighthouse-svep.
--
-- Sparas separat från opportunity_score så att en mätning kan köras (eller köras
-- om) utan att markup-analysen behöver göras om.
ALTER TABLE public.prospect_list_items
  ADD COLUMN IF NOT EXISTS psi_performance   integer,
  ADD COLUMN IF NOT EXISTS psi_accessibility integer,
  ADD COLUMN IF NOT EXISTS psi_seo           integer,
  ADD COLUMN IF NOT EXISTS psi_checked_at    timestamptz;

CREATE INDEX IF NOT EXISTS idx_prospect_items_psi_pending
  ON public.prospect_list_items (list_id)
  WHERE psi_checked_at IS NULL;
