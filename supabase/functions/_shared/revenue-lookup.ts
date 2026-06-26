// Best-effort revenue (omsättning) lookup for Swedish companies via allabolag.se.
//
// Bolagsverket's API exposes no financial figures, so we use Firecrawl to read
// allabolag. Strategy: search for the company's allabolag page, then SCRAPE that
// page (the full nyckeltal table is far more reliable than a search snippet) and
// parse "Omsättning"/"Nettoomsättning". Returns a display string like
// "12 345 tkr", or null. Never throws — a failed lookup must not break enrichment.

import { fetchWithRetry } from "./http.ts";

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

// Pull the first plausible "Omsättning"/"Nettoomsättning" figure out of text.
function extractRevenue(text: string): string | null {
  if (!text) return null;
  const re = /(?:Nett)?[Oo]ms[äa]ttning[^\d\-]{0,80}?(-?\d[\d\s .,]*)\s*(tkr|mkr|ksek|msek|kr)?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = m[1].replace(/[ ]/g, " ").replace(/\s+/g, " ").trim();
    const digits = num.replace(/\D/g, "");
    if (digits.length < 3) continue; // too small to be a turnover figure
    if (/^(19|20)\d{2}$/.test(digits) && !m[2]) continue; // a bare year, not a value
    const unit = m[2] ? m[2].toLowerCase() : "tkr"; // allabolag reports in tkr
    return `${num} ${unit}`;
  }
  return null;
}

/**
 * Best-effort company turnover (omsättning) by name (+ city for disambiguation).
 * Returns a display string (e.g. "12 345 tkr") or null. Swedish companies only.
 */
export async function findRevenueByName(companyName: string, city?: string | null): Promise<string | null> {
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
