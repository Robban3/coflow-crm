// Best-effort revenue (omsättning) lookup for Swedish companies via allabolag.se.
//
// Bolagsverket's API exposes no financial figures, so we use Firecrawl to read
// allabolag. Strategy: search for the company's allabolag page, then SCRAPE that
// page (the full nyckeltal table is far more reliable than a search snippet) and
// parse "Omsättning"/"Nettoomsättning". Returns the figure in tkr plus the
// fiscal year, e.g. { revenue: "34 621 tkr", year: "2024" }, or null. Never
// throws — a failed lookup must not break enrichment.

import { fetchWithRetry } from "./http.ts";

export interface RevenueResult {
  revenue: string;       // e.g. "34 621 tkr"
  year: string | null;   // e.g. "2024"
}

async function firecrawl(
  endpoint: "search" | "scrape",
  body: Record<string, unknown>,
  apiKey: string,
  label: string,
): Promise<any | null> {
  try {
    const res = await fetchWithRetry(`https://api.firecrawl.dev/v1/${endpoint}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, { timeoutMs: 20_000, attempts: 2, label });
    if (!res.ok) { await res.text().catch(() => ""); return null; }
    return await res.json().catch(() => null);
  } catch {
    return null;
  }
}

// "34 621 tkr" — Swedish space-grouped thousands.
function formatTkr(tkr: number): string {
  return `${tkr.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ")} tkr`;
}

// The latest fiscal year reported on an allabolag page. The nyckeltal table
// lists figures newest-first, with the period as a COLUMN HEADER ("2024-12",
// "2024/12") — NOT next to the "Omsättning" label — so the year of the figure we
// extract (the newest) is the most recent fiscal period on the page. Prefer
// period patterns (they only occur in financial tables); fall back to the latest
// plausible bare year. Bounded to <= current year so news/future dates are
// ignored.
function latestFiscalYear(text: string): string | null {
  const now = new Date().getFullYear();
  const years: number[] = [];
  // "2024-12", "2024/12", "2024-08-31" → fiscal period headers.
  for (const m of text.matchAll(/\b(20\d{2})[-/](0[1-9]|1[0-2])\b/g)) {
    const y = parseInt(m[1], 10);
    if (y <= now) years.push(y);
  }
  if (!years.length) {
    // Fallback: any plausible recent year (registry data is rarely older than
    // ~6 years, so don't reach back further than that and never beyond today).
    for (const m of text.matchAll(/\b(20\d{2})\b/g)) {
      const y = parseInt(m[1], 10);
      if (y <= now && y >= now - 6) years.push(y);
    }
  }
  return years.length ? String(Math.max(...years)) : null;
}

// Pull the latest "Omsättning"/"Nettoomsättning" figure (in tkr) + its year.
// allabolag prints amounts space-grouped ("34 621"); a bare 4-digit year like
// 2024 is NOT space-grouped, so matching a grouped number skips the year next
// to it (which previously produced "202434 621").
function extractRevenue(text: string): RevenueResult | null {
  if (!text) return null;
  const pageYear = latestFiscalYear(text);
  const re = /(?:Nett)?[Oo]ms[äa]ttning/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = text.slice(m.index, m.index + 160);
    // A fiscal period right by the label wins; otherwise use the page's latest.
    const local = (after.match(/\b(20\d{2})[-/](?:0[1-9]|1[0-2])\b/) || [])[1];
    const year = local ?? pageYear;
    let tkr: number | null = null;
    const grouped = after.match(/\d{1,3}(?:[\s ]\d{3})+/);
    if (grouped) {
      tkr = parseInt(grouped[0].replace(/\D/g, ""), 10);
    } else {
      const n = (after.match(/\d{3,}/g) || []).find((x) => !/^(19|20)\d{2}$/.test(x));
      if (n) tkr = parseInt(n, 10);
    }
    if (tkr && tkr > 0) return { revenue: formatTkr(tkr), year };
  }
  return null;
}

/**
 * Best-effort company turnover (omsättning) by name (+ city for disambiguation).
 * Returns { revenue, year } or null. Swedish companies only.
 */
export async function findRevenueByName(companyName: string, city?: string | null): Promise<RevenueResult | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey || !companyName.trim()) return null;

  const query = `site:allabolag.se ${companyName.trim()}${city ? ` ${city}` : ""}`;
  const search = await firecrawl("search", { query, limit: 3, scrapeOptions: { formats: ["markdown"] } }, apiKey, "Firecrawl rev search");
  const results: any[] = search?.data || search?.results || [];

  // 1) Scrape the actual allabolag company page (full nyckeltal table).
  const pageUrl: string | undefined = results
    .map((r) => r.url || r.sourceUrl || "")
    .find((u: string) => u.includes("allabolag.se"));
  if (pageUrl) {
    const scraped = await firecrawl("scrape", { url: pageUrl, formats: ["markdown"] }, apiKey, "Firecrawl rev scrape");
    const md: string = scraped?.data?.markdown || scraped?.markdown || "";
    const found = extractRevenue(md);
    if (found) return found;
  }

  // 2) Fallback: parse the search-result snippets directly.
  for (const r of results) {
    const found = extractRevenue(r.markdown || r.content || r.description || "");
    if (found) return found;
  }
  return null;
}
