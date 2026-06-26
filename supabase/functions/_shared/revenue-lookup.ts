// Best-effort revenue (omsättning) lookup for Swedish companies via allabolag.se.
//
// Bolagsverket's API exposes no financial figures, so we use Firecrawl to read
// allabolag. Strategy: search for the company's allabolag page, then SCRAPE that
// page (the full nyckeltal table is far more reliable than a search snippet) and
// parse "Omsättning"/"Nettoomsättning". Returns a clean display string like
// "34,6 mkr", or null. Never throws — a failed lookup must not break enrichment.

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

// Render a tkr amount as a clean, easy-to-read string (e.g. "34,6 mkr").
function formatRevenue(tkr: number): string {
  if (tkr >= 1000) {
    const s = (tkr / 1000).toFixed(1).replace(".", ",").replace(/,0$/, "");
    return `${s} mkr`;
  }
  return `${tkr} tkr`;
}

// Pull the latest "Omsättning"/"Nettoomsättning" figure (in tkr) out of text.
// allabolag prints amounts space-grouped ("34 621"); a bare 4-digit year like
// 2024 is NOT space-grouped, so matching a grouped number skips the year next
// to it (which previously produced "202434 621").
function extractRevenue(text: string): string | null {
  if (!text) return null;
  const re = /(?:Nett)?[Oo]ms[äa]ttning/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const after = text.slice(m.index, m.index + 160);
    let tkr: number | null = null;
    // Prefer a space-grouped number ("34 621", "1 234 567") — excludes years.
    const grouped = after.match(/\d{1,3}(?:[\s ]\d{3})+/);
    if (grouped) {
      tkr = parseInt(grouped[0].replace(/\D/g, ""), 10);
    } else {
      // Fallback: first 3+ digit number that isn't a year.
      const n = (after.match(/\d{3,}/g) || []).find((x) => !/^(19|20)\d{2}$/.test(x));
      if (n) tkr = parseInt(n, 10);
    }
    if (tkr && tkr > 0) return formatRevenue(tkr);
  }
  return null;
}

/**
 * Best-effort company turnover (omsättning) by name (+ city for disambiguation).
 * Returns a clean display string (e.g. "34,6 mkr") or null. Swedish companies only.
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
