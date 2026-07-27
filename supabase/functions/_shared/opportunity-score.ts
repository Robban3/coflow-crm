// Website Opportunity Score — versioned, explainable, deterministic.
//
// Ported from the Lead Factory prototype. The point of versioning is that a
// stored score always says which ruleset produced it, so rescoring after a
// weight change is a deliberate, traceable act. Bump SCORING_VERSION whenever
// any impact value or detection rule changes.
//
// Deliberately NOT included: framework/CMS detection (informational only, never
// scored) and anything an LLM produces. A score an LLM can overwrite is not a
// score — it's a suggestion.

export const SCORING_VERSION = "opportunity@1";

export type IssueCategory = "technical" | "mobile" | "seo" | "conversion";

export type IssueReason = {
  code: string;
  label: string;
  impact: number;
  category: IssueCategory;
};

export const REASONS = {
  site_unreachable:         { code: "site_unreachable",         label: "Webbplatsen går inte att nå",            impact: 45, category: "technical" },
  tls_invalid:              { code: "tls_invalid",              label: "TLS-/certifikatfel",                     impact: 35, category: "technical" },
  no_https:                 { code: "no_https",                 label: "Saknar HTTPS",                           impact: 35, category: "technical" },
  no_https_redirect:        { code: "no_https_redirect",        label: "HTTP omdirigerar inte till HTTPS",       impact: 15, category: "technical" },
  server_error:             { code: "server_error",             label: "Servern svarar med felstatus",           impact: 30, category: "technical" },
  bad_redirect_chain:       { code: "bad_redirect_chain",       label: "Problematisk omdirigeringskedja",        impact: 10, category: "technical" },
  oversized_html:           { code: "oversized_html",           label: "Onödigt stor HTML (>500 kB)",            impact:  8, category: "technical" },
  no_viewport_meta:         { code: "no_viewport_meta",         label: "Saknar viewport-tagg (ej mobilanpassad)", impact: 20, category: "mobile" },
  missing_title:            { code: "missing_title",            label: "Saknar sidtitel",                        impact: 15, category: "seo" },
  missing_h1:               { code: "missing_h1",               label: "Saknar H1-rubrik",                       impact: 10, category: "seo" },
  missing_meta_description: { code: "missing_meta_description", label: "Saknar metabeskrivning",                 impact: 10, category: "seo" },
  no_favicon:               { code: "no_favicon",               label: "Saknar favicon",                         impact:  3, category: "seo" },
  no_open_graph:            { code: "no_open_graph",            label: "Saknar OpenGraph-taggar",                impact:  8, category: "conversion" },
  no_contact_path:          { code: "no_contact_path",          label: "Ingen synlig kontaktväg",                impact: 12, category: "conversion" },
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

/**
 * Score a fetched page. `html` is the response body; the flags describe how the
 * fetch itself went, because transport-level problems (unreachable, TLS, no
 * HTTPS) are the highest-impact findings and cannot be seen in the markup.
 */
export function scoreWebsite(input: {
  html: string | null;
  finalUrl: string | null;
  status: number | null;
  reachable: boolean;
  tlsError?: boolean;
  httpsAvailable?: boolean;
  httpRedirectsToHttps?: boolean;
  redirectHops?: number;
}): ScoreResult {
  const reasons: IssueReason[] = [];
  const add = (c: ReasonCode) => reasons.push(REASONS[c]);

  if (!input.reachable) {
    add("site_unreachable");
    return finalize(reasons);
  }
  if (input.tlsError) add("tls_invalid");
  if (input.httpsAvailable === false) add("no_https");
  else if (input.httpRedirectsToHttps === false) add("no_https_redirect");
  if (typeof input.status === "number" && input.status >= 500) add("server_error");
  if ((input.redirectHops ?? 0) > 3) add("bad_redirect_chain");

  const html = input.html ?? "";
  if (html.length > 500 * 1024) add("oversized_html");

  const lower = html.toLowerCase();

  if (!/<meta[^>]+name=["']?viewport/i.test(html)) add("no_viewport_meta");

  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim();
  if (!title) add("missing_title");

  if (!/<h1[\s>]/i.test(html)) add("missing_h1");

  if (!/<meta[^>]+name=["']?description["']?[^>]+content=/i.test(html)) {
    add("missing_meta_description");
  }

  if (!/<link[^>]+rel=["']?[^"'>]*icon/i.test(html)) add("no_favicon");

  if (!/<meta[^>]+property=["']?og:/i.test(html)) add("no_open_graph");

  // A contact route is the single clearest conversion signal for these leads.
  const hasContact =
    /mailto:/i.test(lower) ||
    /tel:/i.test(lower) ||
    /(kontakt|contact|kontakta-oss|contact-us)/i.test(lower);
  if (!hasContact) add("no_contact_path");

  return finalize(reasons);
}

function finalize(reasons: IssueReason[]): ScoreResult {
  const subScores: Record<IssueCategory, number> = {
    technical: 0, mobile: 0, seo: 0, conversion: 0,
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
