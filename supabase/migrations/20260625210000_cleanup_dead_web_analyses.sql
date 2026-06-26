-- Remove dead web analyses: rows where a failed PageSpeed run was persisted with
-- all four scores at 0 (the old delete-then-insert + `score || 0` bug). These
-- show up red. Deleting them lets the (now fixed) enrichment re-run cleanly.
-- Firecrawl-fallback summary rows have NULL scores, not 0, so they are untouched.
DELETE FROM public.web_analyses
WHERE performance_score = 0
  AND seo_score = 0
  AND accessibility_score = 0
  AND best_practices_score = 0;
