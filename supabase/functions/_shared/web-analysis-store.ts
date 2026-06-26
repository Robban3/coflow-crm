// Safe persistence for web_analyses (PageSpeed/Lighthouse) results.
//
// Background: a failed PageSpeed run (slow site, bot-block, quota, redirect)
// returns HTTP 200 with a Lighthouse runtimeError and NO category scores. Older
// code did `score || 0` + delete-then-insert, which turned a perfectly good
// analysis into a dead 0-score (red) row. These helpers make that impossible:
//   - extractScores() returns null for an empty/failed result (never 0-scores)
//   - replaceWebAnalysis() inserts the new row FIRST, then prunes older rows, so
//     a good analysis is never lost — not even if the insert fails.
//   - getFreshWebAnalysis() lets callers skip re-analysing a site that was
//     analysed recently (a website rarely changes within months).

export interface LighthouseScores {
  performance: number;
  seo: number;
  accessibility: number;
  best_practices: number;
}

/** Scores from a Lighthouse result, or null if the run failed / has no scores. */
export function extractScores(lighthouseResult: any): LighthouseScores | null {
  if (!lighthouseResult || lighthouseResult.runtimeError) return null;
  const cats = lighthouseResult.categories;
  // A real run always has a numeric performance score. Missing => failed run.
  if (!cats || cats.performance?.score == null) return null;
  const pct = (s: number | null | undefined) => Math.round((s ?? 0) * 100);
  return {
    performance: pct(cats.performance?.score),
    seo: pct(cats.seo?.score),
    accessibility: pct(cats.accessibility?.score),
    best_practices: pct(cats["best-practices"]?.score),
  };
}

/** True if any score is a real positive number (i.e. not a dead 0/null row). */
export function hasRealScores(row: {
  performance_score?: number | null;
  seo_score?: number | null;
  accessibility_score?: number | null;
  best_practices_score?: number | null;
}): boolean {
  return [row.performance_score, row.seo_score, row.accessibility_score, row.best_practices_score]
    .map((s) => Number(s))
    .some((s) => Number.isFinite(s) && s > 0);
}

/**
 * Return the lead's existing web analysis if it still has real scores and is
 * newer than maxAgeDays — so callers can skip a needless (and risky) re-run.
 */
export async function getFreshWebAnalysis(
  supabase: any,
  leadId: string,
  maxAgeDays = 180,
): Promise<any | null> {
  const { data } = await supabase
    .from("web_analyses")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  if (!hasRealScores(data)) return null;
  const ageMs = Date.now() - new Date(data.created_at).getTime();
  if (ageMs > maxAgeDays * 24 * 60 * 60 * 1000) return null;
  return data;
}

/**
 * Persist a fresh, VALID analysis for a lead without ever destroying a good one:
 * insert the new row first, then delete the lead's older rows. A no-op-safe call
 * that swallows errors (enrichment must never fail because of this).
 */
export async function replaceWebAnalysis(
  supabase: any,
  row: Record<string, unknown> & { lead_id: string },
): Promise<void> {
  try {
    const { data: inserted, error } = await supabase
      .from("web_analyses")
      .insert(row)
      .select("id")
      .single();
    if (error || !inserted) {
      console.warn("[web-analysis-store] insert failed, keeping existing:", error?.message);
      return;
    }
    // Prune older rows for this lead, keeping the one we just inserted.
    await supabase
      .from("web_analyses")
      .delete()
      .eq("lead_id", row.lead_id)
      .neq("id", inserted.id);
  } catch (e) {
    console.warn("[web-analysis-store] replaceWebAnalysis error:", (e as Error).message);
  }
}
