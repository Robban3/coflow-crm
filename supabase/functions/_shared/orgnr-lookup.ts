// Resolve a Swedish company name to its organisationsnummer.
//
// The Värdefulla datamängder API has no free-text name search, so we fall back
// to a web search (Firecrawl) over allabolag.se / merinfo.se and parse the org
// number out of the result. This is the same approach as the standalone
// lookup-org-number function, extracted so the enrichment pipeline can reuse it.

import { fetchWithRetry } from "./http.ts";

// Swedish org-number patterns: "org.nr 556036-0793", a bare 556036-0793, or 10 digits.
const ORG_PATTERNS = [
  /(?:org\.?(?:anisations)?(?:nummer|nr)?\.?|organisationsnummer)[\s:]*(\d{6}[-\s]?\d{4})/gi,
  /\b(\d{6}[-]\d{4})\b/g,
  /(?:org\.?\s*nr\.?)[\s:]+(\d{10})/gi,
];

function extractOrgNumber(content: string): string | null {
  for (const pattern of ORG_PATTERNS) {
    pattern.lastIndex = 0;
    const match = pattern.exec(content);
    if (match) {
      let orgNum = match[1].replace(/\s/g, "");
      if (orgNum.length === 10 && !orgNum.includes("-")) {
        orgNum = orgNum.substring(0, 6) + "-" + orgNum.substring(6);
      }
      if (/^\d{6}-\d{4}$/.test(orgNum)) return orgNum;
    }
  }
  return null;
}

async function firecrawlSearch(query: string, apiKey: string): Promise<any[]> {
  const res = await fetchWithRetry("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, limit: 3, scrapeOptions: { formats: ["markdown"] } }),
  }, { timeoutMs: 15_000, attempts: 2, label: "Firecrawl org search" });
  if (!res.ok) {
    await res.text().catch(() => "");
    return [];
  }
  const data = await res.json().catch(() => ({}));
  return data.data || data.results || [];
}

/**
 * Best-effort name → org number. Returns the number in XXXXXX-XXXX format, or
 * null. Never throws — a failed lookup must not break enrichment.
 */
export async function findOrgNumberByName(companyName: string): Promise<string | null> {
  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey || !companyName.trim()) return null;

  try {
    // allabolag.se is the most reliable source for Swedish companies.
    const primary = await firecrawlSearch(
      `site:allabolag.se ${companyName} organisationsnummer`,
      apiKey,
    );
    for (const r of primary) {
      const url = r.url || r.sourceUrl || "";
      if (!url.includes("allabolag.se") && !url.includes("merinfo.se")) continue;
      const found = extractOrgNumber(r.markdown || r.content || r.description || "");
      if (found) return found;
    }

    // Fall back to merinfo.se.
    const secondary = await firecrawlSearch(`site:merinfo.se ${companyName}`, apiKey);
    for (const r of secondary) {
      const found = extractOrgNumber(r.markdown || r.content || r.description || "");
      if (found) return found;
    }
  } catch (_e) {
    // swallow – caller treats null as "not found"
  }
  return null;
}
