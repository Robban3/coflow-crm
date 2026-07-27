// Website Opportunity Score — versioned, explainable, deterministic.
//
// v2 rationale: v1 was calibrated to detect BROKEN websites (unreachable, no
// HTTPS, server errors). In practice almost no small business has those in 2026,
// so every real prospect scored 0–10 and the column was useless for ranking.
//
// What a web agency actually sells against is an *old, slow, neglected* site.
// v2 therefore weights design-age and neglect signals — stale copyright, table
// layouts, jQuery, no responsive images, thin content, no structured data — which
// genuinely differ between a 2013 site and a 2024 one. The catastrophic checks
// are kept because they still matter on the rare occasion they fire.
//
// Known limit: the single strongest signal is real-world performance, which
// cannot be derived from markup. Feed `psi` in from pagespeed-analyze when a
// Lighthouse run is available; without it the score is a markup-only estimate.
//
// Bump SCORING_VERSION whenever a weight or rule changes — a stored score must
// always say which ruleset produced it.

export const SCORING_VERSION = "opportunity@2";

export type IssueCategory = "technical" | "mobile" | "seo" | "conversion" | "modernity";

export type IssueReason = {
  code: string;
  label: string;
  impact: number;
  category: IssueCategory;
};

export const REASONS = {
  // ── Catastrophic (rare, but decisive) ────────────────────────────────
  site_unreachable:  { code: "site_unreachable",  label: "Webbplatsen går inte att nå", impact: 60, category: "technical" },
  server_error:      { code: "server_error",      label: "Servern svarar med felstatus", impact: 40, category: "technical" },
  no_https:          { code: "no_https",          label: "Saknar HTTPS",                 impact: 40, category: "technical" },
  tls_invalid:       { code: "tls_invalid",       label: "Certifikatfel",                impact: 35, category: "technical" },
  legacy_plugin:     { code: "legacy_plugin",     label: "Flash/plugin-innehåll",        impact: 30, category: "modernity" },

  // ── Age & neglect — the real differentiators ─────────────────────────
  table_layout:      { code: "table_layout",      label: "Tabellbaserad layout",         impact: 25, category: "modernity" },
  stale_copyright:   { code: "stale_copyright",   label: "Föråldrad sidfot",             impact: 18, category: "modernity" },
  jquery_stack:      { code: "jquery_stack",      label: "Gammal teknikstack (jQuery)",  impact: 12, category: "modernity" },
  legacy_bootstrap:  { code: "legacy_bootstrap",  label: "Gammal Bootstrap-version",     impact: 10, category: "modernity" },
  no_responsive_img: { code: "no_responsive_img", label: "Inga responsiva bilder",       impact: 10, category: "mobile" },
  heavy_inline_css:  { code: "heavy_inline_css",  label: "Spretig inline-CSS",           impact:  6, category: "modernity" },

  // ── Mobile ───────────────────────────────────────────────────────────
  no_viewport_meta:  { code: "no_viewport_meta",  label: "Ej mobilanpassad",             impact: 30, category: "mobile" },
  fixed_width:       { code: "fixed_width",       label: "Fast bredd (bryter i mobil)",  impact: 15, category: "mobile" },

  // ── Findability ──────────────────────────────────────────────────────
  missing_title:     { code: "missing_title",     label: "Saknar sidtitel",              impact: 15, category: "seo" },
  missing_meta_desc: { code: "missing_meta_desc", label: "Saknar metabeskrivning",       impact: 10, category: "seo" },
  missing_h1:        { code: "missing_h1",        label: "Saknar rubrik",                impact:  8, category: "seo" },
  no_schema:         { code: "no_schema",         label: "Saknar strukturerad data",     impact: 10, category: "seo" },
  thin_content:      { code: "thin_content",      label: "Mycket tunt innehåll",         impact: 14, category: "seo" },
  no_favicon:        { code: "no_favicon",        label: "Saknar favicon",               impact:  3, category: "seo" },

  // ── Conversion ───────────────────────────────────────────────────────
  no_contact_path:   { code: "no_contact_path",   label: "Ingen synlig kontaktväg",      impact: 15, category: "conversion" },
  no_open_graph:     { code: "no_open_graph",     label: "Saknar delningstaggar",        impact:  6, category: "conversion" },
  no_analytics:      { code: "no_analytics",      label: "Ingen webbanalys installerad", impact:  5, category: "conversion" },

  // ── Performance (only when a Lighthouse run is supplied) ─────────────
  psi_very_slow:     { code: "psi_very_slow",     label: "Mycket långsam (Lighthouse)",  impact: 35, category: "technical" },
  psi_slow:          { code: "psi_slow",          label: "Långsam (Lighthouse)",         impact: 20, category: "technical" },

  // ── No site at all ───────────────────────────────────────────────────
  no_website:        { code: "no_website",        label: "Saknar webbplats",             impact: 100, category: "technical" },
} as const satisfies Record<string, IssueReason>;

export type ReasonCode = keyof typeof REASONS;

export type ScoreResult = {
  scoringVersion: string;
  opportunityScore: number;
  mainIssueCode: string | null;
  reasons: IssueReason[];
  subScores: Record<IssueCategory, number>;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function scoreWebsite(input: {
  html: string | null;
  finalUrl: string | null;
  status: number | null;
  reachable: boolean;
  tlsError?: boolean;
  httpsAvailable?: boolean;
  /** Lighthouse performance score 0–100, when a PSI run is available. */
  psiPerformance?: number | null;
  /** Current year, passed in so the function stays deterministic/testable. */
  currentYear?: number;
}): ScoreResult {
  const reasons: IssueReason[] = [];
  const add = (c: ReasonCode) => reasons.push(REASONS[c]);

  if (!input.reachable) {
    add("site_unreachable");
    return finalize(reasons);
  }
  if (input.tlsError) add("tls_invalid");
  if (input.httpsAvailable === false) add("no_https");
  if (typeof input.status === "number" && input.status >= 500) add("server_error");

  const html = input.html ?? "";
  const lower = html.toLowerCase();
  const text = stripTags(html);
  const year = input.currentYear ?? new Date().getUTCFullYear();

  // ── Age & neglect ──────────────────────────────────────────────────
  const semantic = /<(main|section|article|nav|header|footer)[\s>]/i.test(html);
  const tableCount = (lower.match(/<table[\s>]/g) ?? []).length;
  if (tableCount >= 2 && !semantic) add("table_layout");

  const years = [...lower.matchAll(/(?:©|&copy;|copyright)[^0-9]{0,24}((?:19|20)\d{2})/g)]
    .map((m) => Number(m[1]))
    .filter((y) => y >= 1995 && y <= year + 1);
  if (years.length > 0 && Math.max(...years) <= year - 3) add("stale_copyright");

  if (/jquery[.\-_]?\d|jquery(\.min)?\.js/i.test(lower)) add("jquery_stack");
  if (/bootstrap[/\-.](?:2|3)\.\d/i.test(lower)) add("legacy_bootstrap");
  if (/<(object|embed)[\s>]|\.swf\b/i.test(lower)) add("legacy_plugin");
  if (!/srcset=|<picture[\s>]/i.test(lower)) add("no_responsive_img");

  const inlineStyles = (lower.match(/\sstyle="/g) ?? []).length;
  if (inlineStyles > 25) add("heavy_inline_css");

  // ── Mobile ─────────────────────────────────────────────────────────
  const hasViewport = /<meta[^>]+name=["']?viewport/i.test(html);
  if (!hasViewport) add("no_viewport_meta");
  else if (/width\s*=\s*["']?\d{3,}/i.test(lower) && !/max-width/i.test(lower)) add("fixed_width");

  // ── Findability ────────────────────────────────────────────────────
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (!title) add("missing_title");
  if (!/<meta[^>]+name=["']?description["']?[^>]+content=/i.test(html)) add("missing_meta_desc");
  if (!/<h1[\s>]/i.test(html)) add("missing_h1");
  if (!/application\/ld\+json/i.test(lower)) add("no_schema");
  if (text.split(" ").filter(Boolean).length < 120) add("thin_content");
  if (!/<link[^>]+rel=["']?[^"'>]*icon/i.test(html)) add("no_favicon");

  // ── Conversion ─────────────────────────────────────────────────────
  const hasContact =
    /mailto:/i.test(lower) ||
    /tel:/i.test(lower) ||
    /(kontakt|contact|boka|book)/i.test(lower);
  if (!hasContact) add("no_contact_path");
  if (!/<meta[^>]+property=["']?og:/i.test(html)) add("no_open_graph");
  if (!/(googletagmanager|gtag\(|google-analytics|plausible|matomo|umami)/i.test(lower)) {
    add("no_analytics");
  }

  // ── Performance ────────────────────────────────────────────────────
  if (typeof input.psiPerformance === "number") {
    if (input.psiPerformance < 30) add("psi_very_slow");
    else if (input.psiPerformance < 55) add("psi_slow");
  }

  return finalize(reasons);
}

/** A company with no website at all is the strongest possible opportunity. */
export function scoreNoWebsite(): ScoreResult {
  return finalize([REASONS.no_website]);
}

/**
 * Fold a Lighthouse performance score into an already-computed markup result,
 * without re-fetching the page. Any previous PSI reason is replaced, so this is
 * safe to run repeatedly as measurements are refreshed.
 */
export function applyPsi(
  existingReasons: IssueReason[],
  psiPerformance: number,
): ScoreResult {
  const reasons = existingReasons.filter(
    (r) => r.code !== "psi_slow" && r.code !== "psi_very_slow",
  );
  if (psiPerformance < 30) reasons.push(REASONS.psi_very_slow);
  else if (psiPerformance < 55) reasons.push(REASONS.psi_slow);
  return finalize(reasons);
}

function finalize(reasons: IssueReason[]): ScoreResult {
  const subScores: Record<IssueCategory, number> = {
    technical: 0, mobile: 0, seo: 0, conversion: 0, modernity: 0,
  };
  for (const r of reasons) subScores[r.category] += r.impact;
  for (const k of Object.keys(subScores) as IssueCategory[]) {
    subScores[k] = clampScore(subScores[k]);
  }

  const main = reasons.slice().sort((a, b) => b.impact - a.impact)[0] ?? null;

  return {
    scoringVersion: SCORING_VERSION,
    opportunityScore: clampScore(reasons.reduce((s, r) => s + r.impact, 0)),
    mainIssueCode: main?.code ?? null,
    reasons,
    subScores,
  };
}

export function reasonLabel(code: string | null | undefined): string {
  if (!code) return "—";
  return (REASONS as Record<string, IssueReason>)[code]?.label ?? code;
}
