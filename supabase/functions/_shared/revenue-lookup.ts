// Best-effort revenue (omsättning) lookup for Swedish companies.
//
// Bolagsverket's Värdefulla datamängder API does not expose financial figures,
// so we scrape allabolag.se via Firecrawl (the same approach as the name→orgnr
// helper). Returns a display string like "12 345 tkr", or null. Never throws —
// a failed lookup must not break enrichment. The result is approximate: it
// depends on allabolag's page layout and may need tuning.

import { fetchWithRetry } from "./http.ts";

async function firecrawlSearch(query: string, apiKey: string): Promise<any[]> {
  const res = await fetchWithRetry("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
  }, { timeoutMs: 15_000, attempts: 2, label: "Firecrawl revenue search" });
  if (!res.ok) {
    await res.text().catch(() => "");
    return [];
  }
  const data = await res.json().catch(() => ({}));
  return data.data || data.results || [];
}

// Pull the first plausible "Omsättning" figure out of an allabolag page.
function extractRevenue(text: string): string | null {
  const re = /oms[äa]ttning[^\d\-]{0,60}(-?\d[\d\s .,]*)\s*(tkr|mkr|ksek|msek|kr)?/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const num = m[1].replace(/[ \s]+/g, " ").trim();
    const digits = num.replace(/\D/g, "");
    if (digits.length < 3) continue; // too small to be a turnover figure
    if (/^(19|20)\d{2}$/.test(digits) && !m[2]) continue; // a bare year, not a value
    const unit = m[2] ? m[2].toLowerCase() : "tkr"; // allabolag reports in tkr
    return `${num} ${unit}`;
  }
  return null;
}

/**
 * Best-effort company turnover (omsättning) by name. Returns a display string
 * (e.g. "12 345 tkr") or null. Swedish companies only (allabolag).
 */
export async function findRevenueByName(companyName: string): Promise<string | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey || !companyName.trim()) return null;
  try {
    const results = await firecrawlSearch(
      `site:allabolag.se ${companyName} omsättning nyckeltal`,
      apiKey,
    );
    for (const r of results) {
      const url = r.url || r.sourceUrl || "";
      if (!url.includes("allabolag.se")) continue;
      const found = extractRevenue(r.markdown || r.content || r.description || "");
      if (found) return found;
    }
  } catch (_e) {
    // swallow – caller treats null as "not found"
  }
  return null;
}
