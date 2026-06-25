import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const { leadId, domain: directDomain } = body;
    const LANG_BY_MARKET: Record<string, string> = { SE: "svenska", US: "engelska", DE: "tyska", ES: "spanska" };
    const aiLang = LANG_BY_MARKET[(body.market || "SE").toUpperCase()] || "svenska";
    if (!leadId && !directDomain) throw new Error("leadId or domain required");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer "))
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, serviceKey);

    const resolvedLeadId: string | null = leadId || null;
    let organizationId: string | null = null;
    let domainHost: string;
    let domain: string;

    if (leadId) {
      // Existing lead-based flow
      const { data: lead, error: leadError } = await supabase
        .from("leads")
        .select("id, website, company_name, organization_id")
        .eq("id", leadId)
        .single();

      if (leadError || !lead) throw new Error("Lead not found");
      if (!lead.website) throw new Error("Lead has no website");

      domain = lead.website.trim();
      if (!domain.startsWith("http")) domain = `https://${domain}`;
      domainHost = new URL(domain).hostname;
      organizationId = lead.organization_id;
    } else {
      // Direct domain flow (no lead required)
      domain = directDomain.trim();
      if (!domain.startsWith("http")) domain = `https://${domain}`;
      domainHost = new URL(domain).hostname;

      // Get user's organization
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", userId)
        .single();
      organizationId = profile?.organization_id || null;
    }

    // Create analysis record
    const { data: analysis, error: insertErr } = await supabase
      .from("geo_analyses")
      .insert({
        lead_id: resolvedLeadId,
        organization_id: organizationId,
        domain: domainHost,
        status: "running",
        created_by: userId,
      })
      .select("id")
      .single();

    if (insertErr || !analysis) throw new Error("Failed to create analysis");
    const analysisId = analysis.id;

    try {
      // STEP A: Crawl site (up to 25 pages using Firecrawl)
      const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
      const pages: any[] = [];

      if (firecrawlKey) {
        try {
          // Use Firecrawl map to get URLs first
          const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${firecrawlKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url: domain, limit: 25 }),
          });

          let urls: string[] = [domain];
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            urls = (mapData.links || mapData.urls || [domain]).slice(0, 25);
            if (urls.length === 0) urls = [domain];
          }

          // Scrape each page (batch of 5 at a time)
          for (let i = 0; i < urls.length; i += 5) {
            const batch = urls.slice(i, i + 5);
            const results = await Promise.allSettled(
              batch.map(async (pageUrl: string) => {
                try {
                  const scrapeRes = await fetch(
                    "https://api.firecrawl.dev/v1/scrape",
                    {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${firecrawlKey}`,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        url: pageUrl,
                        formats: ["markdown"],
                        onlyMainContent: false,
                      }),
                    }
                  );
                  if (!scrapeRes.ok) return null;
                  const d = await scrapeRes.json();
                  const md = d.data?.markdown || "";
                  const meta = d.data?.metadata || {};
                  return { url: pageUrl, markdown: md, metadata: meta };
                } catch {
                  return null;
                }
              })
            );
            for (const r of results) {
              if (r.status === "fulfilled" && r.value) pages.push(r.value);
            }
          }
        } catch (e) {
          console.error("Firecrawl crawl error:", e);
        }
      }

      // If Firecrawl not available, do a simple fetch of homepage
      if (pages.length === 0) {
        try {
          const res = await fetch(domain, {
            headers: { "User-Agent": "GEO-Bot/1.0" },
          });
          const html = await res.text();
          pages.push({ url: domain, markdown: html.substring(0, 5000), metadata: {}, html });
        } catch {
          pages.push({ url: domain, markdown: "", metadata: {} });
        }
      }

      // STEP B: Parse pages and save
      const parsedPages = pages.map((p) => parsePage(p, domainHost));
      
      // Insert pages
      if (parsedPages.length > 0) {
        await supabase.from("geo_pages").insert(
          parsedPages.map((pg) => ({
            geo_analysis_id: analysisId,
            url: pg.url,
            status_code: pg.statusCode,
            title: pg.title,
            meta_description: pg.metaDescription,
            h1: pg.h1,
            word_count: pg.wordCount,
            indexable: pg.indexable,
            canonical: pg.canonical,
            schema_types: pg.schemaTypes,
            internal_links: pg.internalLinks,
          }))
        );
      }

      // STEP C: GEO heuristic checks
      const findings = runGeoChecks(parsedPages, domainHost);

      // STEP D: Compute geo_score
      const geoScore = computeGeoScore(findings, parsedPages);

      // Insert findings
      if (findings.length > 0) {
        await supabase.from("geo_findings").insert(
          findings.map((f) => ({
            geo_analysis_id: analysisId,
            category: f.category,
            severity: f.severity,
            title: f.title,
            description: f.description,
            evidence: f.evidence,
            recommendation: f.recommendation,
          }))
        );
      }

      // STEP E: AI-generated summary + actions
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      let summary = "";
      let actions: any[] = [];

      if (GEMINI_API_KEY) {
        const findingsSummary = findings
          .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
          .join("\n");

        const pagesContext = parsedPages
          .slice(0, 10)
          .map(
            (p) =>
              `URL: ${p.url} | Title: ${p.title || "N/A"} | H1: ${p.h1 || "N/A"} | Words: ${p.wordCount} | Schema: ${(p.schemaTypes || []).join(",") || "none"} | Indexable: ${p.indexable}`
          )
          .join("\n");

        const prompt = `Analysera denna webbplats (${domainHost}) för GEO/AI-synlighet.

CRAWLADE SIDOR (${parsedPages.length} st):
${pagesContext}

IDENTIFIERADE PROBLEM:
${findingsSummary}

GEO-POÄNG: ${geoScore}/100

Ge mig:
1. En kort sammanfattning (max 200 ord) på ${aiLang} om webbplatsens GEO/AI-synlighet
2. Topp 10 prioriterade åtgärder grupperade i quick_win, medium, long_term

Svara som JSON:
{
  "summary": "...",
  "actions": [
    {"priority": "quick_win|medium|long_term", "title": "...", "steps": "...", "estimated_impact": "hög|medium|låg", "estimated_effort": "liten|medium|stor"}
  ]
}`;

        try {
          const aiRes = await fetch(
            "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${GEMINI_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "gemini-2.5-flash",
                messages: [
                  {
                    role: "system",
                    content:
                      `Du är en expert på GEO (Generative Engine Optimization) och AI-synlighet. Du analyserar webbplatser och ger konkreta, prioriterade rekommendationer. Skriv ALLA textfält på ${aiLang}.`,
                  },
                  { role: "user", content: prompt },
                ],
              }),
            }
          );

          if (aiRes.ok) {
            const aiData = await aiRes.json();
            const content = aiData.choices?.[0]?.message?.content || "";
            try {
              const jsonMatch = content.match(/\{[\s\S]*"summary"[\s\S]*"actions"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                summary = parsed.summary || "";
                actions = parsed.actions || [];
              }
            } catch {
              summary = content.substring(0, 500);
            }
          }
        } catch (e) {
          console.error("AI error:", e);
        }
      }

      // Insert actions
      if (actions.length > 0) {
        await supabase.from("geo_actions").insert(
          actions.map((a: any) => ({
            geo_analysis_id: analysisId,
            priority: ["quick_win", "medium", "long_term"].includes(a.priority)
              ? a.priority
              : "medium",
            title: a.title || "Åtgärd",
            steps: a.steps || null,
            estimated_impact: a.estimated_impact || null,
            estimated_effort: a.estimated_effort || null,
          }))
        );
      }

      // Mark completed
      await supabase
        .from("geo_analyses")
        .update({
          status: "completed",
          geo_score: geoScore,
          summary,
          completed_at: new Date().toISOString(),
        })
        .eq("id", analysisId);

      return new Response(
        JSON.stringify({ id: analysisId, status: "completed", geo_score: geoScore }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (pipelineError) {
      console.error("Pipeline error:", pipelineError);
      await supabase
        .from("geo_analyses")
        .update({
          status: "failed",
          error_message:
            pipelineError instanceof Error
              ? pipelineError.message
              : "Unknown error",
        })
        .eq("id", analysisId);

      throw pipelineError;
    }
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ──── Helpers ────

interface ParsedPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  indexable: boolean;
  canonical: string | null;
  schemaTypes: string[];
  internalLinks: number;
}

function parsePage(page: any, domainHost: string): ParsedPage {
  const md: string = page.markdown || "";
  const meta = page.metadata || {};

  // Extract title
  const title = meta.title || meta.ogTitle || extractFirst(md, /^#\s+(.+)/m) || null;

  // Extract H1
  const h1 = extractFirst(md, /^#\s+(.+)/m) || null;

  // Word count
  const wordCount = md
    .replace(/[#*[\]()!]/g, "")
    .split(/\s+/)
    .filter((w: string) => w.length > 0).length;

  // Schema types from markdown
  const schemaTypes: string[] = [];
  const schemaMatches = md.match(/"@type"\s*:\s*"([^"]+)"/g);
  if (schemaMatches) {
    for (const m of schemaMatches) {
      const t = m.match(/"@type"\s*:\s*"([^"]+)"/);
      if (t) schemaTypes.push(t[1]);
    }
  }
  // Common schema indicators in content
  if (md.toLowerCase().includes("faq") || md.includes("Vanliga frågor"))
    schemaTypes.push("FAQPage_candidate");
  if (md.toLowerCase().includes("schema.org")) schemaTypes.push("Schema.org_detected");

  // Internal links count
  const linkMatches = md.match(/\[.*?\]\(.*?\)/g) || [];
  const internalLinks = linkMatches.filter((l: string) => {
    const href = l.match(/\((.*?)\)/)?.[1] || "";
    return (
      href.startsWith("/") ||
      href.includes(domainHost) ||
      (!href.startsWith("http") && !href.startsWith("mailto"))
    );
  }).length;

  // Indexability
  const indexable =
    !md.toLowerCase().includes("noindex") &&
    !meta.robots?.includes("noindex");

  return {
    url: page.url,
    statusCode: 200,
    title,
    metaDescription: meta.description || null,
    h1,
    wordCount,
    indexable,
    canonical: meta.canonical || null,
    schemaTypes: [...new Set(schemaTypes)],
    internalLinks,
  };
}

function extractFirst(text: string, regex: RegExp): string | null {
  const m = text.match(regex);
  return m ? m[1].trim() : null;
}

interface Finding {
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: any;
  recommendation: string;
}

function runGeoChecks(pages: ParsedPage[], domain: string): Finding[] {
  const findings: Finding[] = [];

  // Check for FAQ content
  const hasFaq = pages.some(
    (p) =>
      p.schemaTypes.includes("FAQPage") ||
      p.schemaTypes.includes("FAQPage_candidate") ||
      (p.url.toLowerCase().includes("faq") || p.url.toLowerCase().includes("vanliga-fragor"))
  );
  if (!hasFaq) {
    findings.push({
      category: "geo",
      severity: "high",
      title: "Saknar FAQ-sektion",
      description:
        "Webbplatsen har ingen synlig FAQ-sektion. FAQ-innehåll indexeras ofta av AI-motorer som svar på användarfrågor.",
      evidence: { pagesChecked: pages.length },
      recommendation:
        "Lägg till en FAQ-sida med vanliga frågor om era tjänster. Använd FAQPage-schema markup.",
    });
  }

  // Check for Organization/Service schema
  const hasOrgSchema = pages.some(
    (p) =>
      p.schemaTypes.includes("Organization") ||
      p.schemaTypes.includes("LocalBusiness") ||
      p.schemaTypes.includes("Service")
  );
  if (!hasOrgSchema) {
    findings.push({
      category: "entity",
      severity: "high",
      title: "Saknar Organization/Service schema",
      description:
        "Ingen strukturerad data för företaget hittades. AI-motorer använder schema.org för att förstå och referera till verksamheter.",
      evidence: {
        schemasFound: [
          ...new Set(pages.flatMap((p) => p.schemaTypes)),
        ],
      },
      recommendation:
        "Lägg till Organization eller LocalBusiness schema med namn, adress, kontaktinfo och tjänstebeskrivningar.",
    });
  }

  // Check meta descriptions
  const missingMeta = pages.filter((p) => !p.metaDescription);
  if (missingMeta.length > pages.length * 0.3) {
    findings.push({
      category: "seo",
      severity: "medium",
      title: "Många sidor saknar meta-beskrivning",
      description: `${missingMeta.length} av ${pages.length} sidor saknar meta-beskrivning. Detta påverkar hur AI-motorer sammanfattar ert innehåll.`,
      evidence: { missingCount: missingMeta.length, total: pages.length },
      recommendation: "Skriv unika, informativa meta-beskrivningar (120-160 tecken) för varje sida.",
    });
  }

  // Check content depth (word count)
  const thinPages = pages.filter((p) => p.wordCount < 300);
  if (thinPages.length > pages.length * 0.5) {
    findings.push({
      category: "content",
      severity: "medium",
      title: "Tunt innehåll på många sidor",
      description: `${thinPages.length} av ${pages.length} sidor har under 300 ord. AI-motorer föredrar utförligt, informativt innehåll.`,
      evidence: {
        thinPages: thinPages.map((p) => ({ url: p.url, words: p.wordCount })).slice(0, 5),
      },
      recommendation: "Utöka innehållet med mer detaljerad information, definitioner och förklaringar.",
    });
  }

  // Check for definition/answer blocks
  const hasDefinitions = pages.some(
    (p) =>
      (p.url.toLowerCase().includes("om-oss") ||
        p.url.toLowerCase().includes("about") ||
        p.url.toLowerCase().includes("tjanster") ||
        p.url.toLowerCase().includes("services"))
  );
  if (!hasDefinitions) {
    findings.push({
      category: "geo",
      severity: "medium",
      title: "Saknar tydliga tjänstesidor",
      description:
        'Inga dedikerade sidor för "Om oss" eller "Tjänster" hittades. Dessa sidor hjälper AI att förstå vad företaget gör.',
      evidence: { urls: pages.map((p) => p.url).slice(0, 10) },
      recommendation:
        "Skapa tydliga sidor som beskriver era tjänster, processer och erbjudanden i detalj.",
    });
  }

  // Check internal linking
  const avgInternalLinks =
    pages.reduce((sum, p) => sum + p.internalLinks, 0) / (pages.length || 1);
  if (avgInternalLinks < 3) {
    findings.push({
      category: "indexing",
      severity: "low",
      title: "Svag intern länkning",
      description: `Genomsnittligt ${avgInternalLinks.toFixed(1)} interna länkar per sida. Bra intern länkning hjälper AI-motorer att förstå er webbplats struktur.`,
      evidence: { avgLinks: avgInternalLinks.toFixed(1) },
      recommendation:
        "Länka mellan relaterade sidor. Varje sida bör ha minst 3-5 interna länkar.",
    });
  }

  // Check indexability
  const nonIndexable = pages.filter((p) => !p.indexable);
  if (nonIndexable.length > 0) {
    findings.push({
      category: "indexing",
      severity: "high",
      title: "Sidor blockerade från indexering",
      description: `${nonIndexable.length} sida/sidor har noindex-taggar och kan inte hittas av vare sig sökmotorer eller AI-motorer.`,
      evidence: { blockedUrls: nonIndexable.map((p) => p.url) },
      recommendation: "Kontrollera att viktiga sidor inte har noindex. Ta bort noindex från sidor som ska vara synliga.",
    });
  }

  // Check for contact visibility
  const hasContactPage = pages.some(
    (p) =>
      p.url.toLowerCase().includes("kontakt") ||
      p.url.toLowerCase().includes("contact")
  );
  if (!hasContactPage) {
    findings.push({
      category: "entity",
      severity: "low",
      title: "Ingen dedikerad kontaktsida",
      description:
        "Ingen tydlig kontaktsida hittades. AI-motorer behöver kontaktinfo för att korrekt representera företaget.",
      evidence: {},
      recommendation:
        "Skapa en kontaktsida med adress, telefon, e-post och öppettider.",
    });
  }

  return findings;
}

function computeGeoScore(findings: Finding[], pages: ParsedPage[]): number {
  let score = 100;

  // Deduct points based on findings
  for (const f of findings) {
    switch (f.severity) {
      case "high":
        score -= 15;
        break;
      case "medium":
        score -= 8;
        break;
      case "low":
        score -= 3;
        break;
    }
  }

  // Bonus for schema usage
  const schemaCount = new Set(pages.flatMap((p) => p.schemaTypes.filter((s) => !s.includes("candidate")))).size;
  if (schemaCount >= 3) score += 5;

  // Bonus for good content depth
  const avgWords = pages.reduce((s, p) => s + p.wordCount, 0) / (pages.length || 1);
  if (avgWords > 500) score += 5;

  return Math.max(0, Math.min(100, score));
}
