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
    // The reader's UI language wins (the report is shown to the salesperson),
    // falling back to the prospect's market language, then Swedish.
    const LANG_BY_UI: Record<string, string> = { sv: "svenska", en: "engelska", es: "spanska" };
    const aiLang = LANG_BY_UI[String(body.language || "").toLowerCase()]
      || LANG_BY_MARKET[(body.market || "SE").toUpperCase()]
      || "svenska";
    // Short language code (sv|en|es) for the rule-based findings, which are
    // built from hardcoded text rather than the AI prompt.
    const LANG_CODE: Record<string, string> = { svenska: "sv", engelska: "en", spanska: "es" };
    const geoLang = LANG_CODE[aiLang] || "sv";
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
      // STEP A: Crawl site (up to 8 pages using Firecrawl). Each scraped page
      // costs a Firecrawl credit, so we cap at the homepage + a handful of
      // high-signal pages (services/about/contact/faq) instead of the whole
      // sitemap — enough to judge AI-visibility without burning ~25 credits.
      const MAX_PAGES = 8;
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
            body: JSON.stringify({ url: domain, limit: MAX_PAGES }),
          });

          let urls: string[] = [domain];
          if (mapRes.ok) {
            const mapData = await mapRes.json();
            const allUrls: string[] = mapData.links || mapData.urls || [];
            // Prioritise the pages that matter most for GEO/AI-visibility so
            // the 8-page budget is spent on signal, not random deep links.
            const priorityPaths = [
              /\/(tjanster|tjänster|services|kontakt|contact|om-oss|about|about-us|faq|vanliga-fragor|vanliga-frågor|produkter|products)/i,
            ];
            const priority = allUrls.filter(
              (u) => u !== domain && priorityPaths.some((p) => p.test(u)),
            );
            const rest = allUrls.filter(
              (u) => u !== domain && !priority.includes(u),
            );
            urls = [domain, ...priority, ...rest].slice(0, MAX_PAGES);
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
      const findings = runGeoChecks(parsedPages, domainHost, geoLang);

      // STEP D: Compute geo_score
      const geoScore = computeGeoScore(findings, parsedPages);

      // STEP E: AI-generated summary + actions + site-specific finding text.
      // The deterministic checks above decide WHICH problems exist and the
      // geo_score (consistent, no hallucination); the AI rewrites each detected
      // problem's text tailored to this site, in the reader's language. If the
      // AI is unavailable or omits a finding, we keep the localized template.
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      let summary = "";
      let actions: any[] = [];

      if (GEMINI_API_KEY && findings.length >= 0) {
        const findingsContext = findings
          .map((f) => `- key=${f.key} | [${f.severity.toUpperCase()}] ${f.title} | evidence=${JSON.stringify(f.evidence)}`)
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

IDENTIFIERADE PROBLEM (regelbaserade — använd EXAKT dessa keys, hitta inte på nya problem):
${findingsContext}

GEO-POÄNG: ${geoScore}/100

Ge mig:
1. En kort sammanfattning (max 200 ord) på ${aiLang} om webbplatsens GEO/AI-synlighet.
2. För VARJE identifierat problem ovan: en sajt-specifik titel, beskrivning och rekommendation som refererar till konkreta sidor/observationer i datan (inte generiska fraser). Behåll samma "key".
3. Topp 10 prioriterade åtgärder grupperade i quick_win, medium, long_term.

Skriv ALLA textfält på ${aiLang}. Svara som JSON:
{
  "summary": "...",
  "findings": [
    {"key": "<samma key>", "title": "...", "description": "...", "recommendation": "..."}
  ],
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
              const jsonMatch = content.match(/\{[\s\S]*"summary"[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                summary = parsed.summary || "";
                actions = parsed.actions || [];
                // Merge AI's site-specific text into the deterministic findings
                // by key; anything the AI skipped keeps its localized template.
                if (Array.isArray(parsed.findings)) {
                  const byKey = new Map<string, any>(
                    parsed.findings.filter((x: any) => x && x.key).map((x: any) => [String(x.key), x]),
                  );
                  for (const f of findings) {
                    const ai = byKey.get(f.key);
                    if (ai) {
                      if (typeof ai.title === "string" && ai.title.trim()) f.title = ai.title.trim();
                      if (typeof ai.description === "string" && ai.description.trim()) f.description = ai.description.trim();
                      if (typeof ai.recommendation === "string" && ai.recommendation.trim()) f.recommendation = ai.recommendation.trim();
                    }
                  }
                }
              }
            } catch {
              summary = content.substring(0, 500);
            }
          }
        } catch (e) {
          console.error("AI error:", e);
        }
      }

      // Insert findings (with AI-tailored text merged in, or localized fallback).
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
  key: string;
  category: string;
  severity: string;
  title: string;
  description: string;
  evidence: any;
  recommendation: string;
}

// Localized text for the rule-based GEO findings (title/description/
// recommendation). The salesperson reads the report, so it follows the UI
// language (sv|en|es). Description builders take the computed numbers.
type FT = { title: string; description: string; recommendation: string };
const GEO_TEXT: Record<string, {
  faq: FT;
  orgSchema: FT;
  meta: (missing: number, total: number) => FT;
  thin: (thin: number, total: number) => FT;
  servicePages: FT;
  internalLinks: (avg: string) => FT;
  noindex: (count: number) => FT;
  contact: FT;
}> = {
  sv: {
    faq: {
      title: "Saknar FAQ-sektion",
      description: "Webbplatsen har ingen synlig FAQ-sektion. FAQ-innehåll indexeras ofta av AI-motorer som svar på användarfrågor.",
      recommendation: "Lägg till en FAQ-sida med vanliga frågor om era tjänster. Använd FAQPage-schema markup.",
    },
    orgSchema: {
      title: "Saknar Organization/Service schema",
      description: "Ingen strukturerad data för företaget hittades. AI-motorer använder schema.org för att förstå och referera till verksamheter.",
      recommendation: "Lägg till Organization eller LocalBusiness schema med namn, adress, kontaktinfo och tjänstebeskrivningar.",
    },
    meta: (m, t) => ({
      title: "Många sidor saknar meta-beskrivning",
      description: `${m} av ${t} sidor saknar meta-beskrivning. Detta påverkar hur AI-motorer sammanfattar ert innehåll.`,
      recommendation: "Skriv unika, informativa meta-beskrivningar (120-160 tecken) för varje sida.",
    }),
    thin: (th, t) => ({
      title: "Tunt innehåll på många sidor",
      description: `${th} av ${t} sidor har under 300 ord. AI-motorer föredrar utförligt, informativt innehåll.`,
      recommendation: "Utöka innehållet med mer detaljerad information, definitioner och förklaringar.",
    }),
    servicePages: {
      title: "Saknar tydliga tjänstesidor",
      description: 'Inga dedikerade sidor för "Om oss" eller "Tjänster" hittades. Dessa sidor hjälper AI att förstå vad företaget gör.',
      recommendation: "Skapa tydliga sidor som beskriver era tjänster, processer och erbjudanden i detalj.",
    },
    internalLinks: (avg) => ({
      title: "Svag intern länkning",
      description: `Genomsnittligt ${avg} interna länkar per sida. Bra intern länkning hjälper AI-motorer att förstå er webbplats struktur.`,
      recommendation: "Länka mellan relaterade sidor. Varje sida bör ha minst 3-5 interna länkar.",
    }),
    noindex: (c) => ({
      title: "Sidor blockerade från indexering",
      description: `${c} sida/sidor har noindex-taggar och kan inte hittas av vare sig sökmotorer eller AI-motorer.`,
      recommendation: "Kontrollera att viktiga sidor inte har noindex. Ta bort noindex från sidor som ska vara synliga.",
    }),
    contact: {
      title: "Ingen dedikerad kontaktsida",
      description: "Ingen tydlig kontaktsida hittades. AI-motorer behöver kontaktinfo för att korrekt representera företaget.",
      recommendation: "Skapa en kontaktsida med adress, telefon, e-post och öppettider.",
    },
  },
  en: {
    faq: {
      title: "Missing FAQ section",
      description: "The site has no visible FAQ section. FAQ content is often indexed by AI engines as answers to user questions.",
      recommendation: "Add an FAQ page with common questions about your services. Use FAQPage schema markup.",
    },
    orgSchema: {
      title: "Missing Organization/Service schema",
      description: "No structured data for the company was found. AI engines use schema.org to understand and reference businesses.",
      recommendation: "Add Organization or LocalBusiness schema with name, address, contact info and service descriptions.",
    },
    meta: (m, t) => ({
      title: "Many pages missing meta description",
      description: `${m} of ${t} pages are missing a meta description. This affects how AI engines summarize your content.`,
      recommendation: "Write unique, informative meta descriptions (120-160 characters) for every page.",
    }),
    thin: (th, t) => ({
      title: "Thin content on many pages",
      description: `${th} of ${t} pages have under 300 words. AI engines prefer thorough, informative content.`,
      recommendation: "Expand the content with more detailed information, definitions and explanations.",
    }),
    servicePages: {
      title: "Missing clear service pages",
      description: 'No dedicated "About" or "Services" pages were found. These pages help AI understand what the company does.',
      recommendation: "Create clear pages describing your services, processes and offerings in detail.",
    },
    internalLinks: (avg) => ({
      title: "Weak internal linking",
      description: `On average ${avg} internal links per page. Good internal linking helps AI engines understand your site structure.`,
      recommendation: "Link between related pages. Each page should have at least 3-5 internal links.",
    }),
    noindex: (c) => ({
      title: "Pages blocked from indexing",
      description: `${c} page(s) have noindex tags and cannot be found by either search engines or AI engines.`,
      recommendation: "Make sure important pages don't have noindex. Remove noindex from pages that should be visible.",
    }),
    contact: {
      title: "No dedicated contact page",
      description: "No clear contact page was found. AI engines need contact info to represent the company correctly.",
      recommendation: "Create a contact page with address, phone, email and opening hours.",
    },
  },
  es: {
    faq: {
      title: "Falta sección de preguntas frecuentes (FAQ)",
      description: "El sitio no tiene una sección de FAQ visible. El contenido de FAQ suele ser indexado por los motores de IA como respuestas a las preguntas de los usuarios.",
      recommendation: "Añade una página de FAQ con preguntas habituales sobre vuestros servicios. Usa el marcado de esquema FAQPage.",
    },
    orgSchema: {
      title: "Falta esquema Organization/Service",
      description: "No se encontraron datos estructurados de la empresa. Los motores de IA usan schema.org para entender y referenciar a los negocios.",
      recommendation: "Añade el esquema Organization o LocalBusiness con nombre, dirección, datos de contacto y descripciones de servicios.",
    },
    meta: (m, t) => ({
      title: "Muchas páginas sin meta descripción",
      description: `${m} de ${t} páginas no tienen meta descripción. Esto afecta a cómo los motores de IA resumen vuestro contenido.`,
      recommendation: "Escribe meta descripciones únicas e informativas (120-160 caracteres) para cada página.",
    }),
    thin: (th, t) => ({
      title: "Contenido escaso en muchas páginas",
      description: `${th} de ${t} páginas tienen menos de 300 palabras. Los motores de IA prefieren contenido extenso e informativo.`,
      recommendation: "Amplía el contenido con información más detallada, definiciones y explicaciones.",
    }),
    servicePages: {
      title: "Faltan páginas de servicios claras",
      description: 'No se encontraron páginas dedicadas de "Quiénes somos" o "Servicios". Estas páginas ayudan a la IA a entender qué hace la empresa.',
      recommendation: "Crea páginas claras que describan vuestros servicios, procesos y ofertas en detalle.",
    },
    internalLinks: (avg) => ({
      title: "Enlazado interno débil",
      description: `Una media de ${avg} enlaces internos por página. Un buen enlazado interno ayuda a los motores de IA a entender la estructura de vuestro sitio.`,
      recommendation: "Enlaza entre páginas relacionadas. Cada página debería tener al menos 3-5 enlaces internos.",
    }),
    noindex: (c) => ({
      title: "Páginas bloqueadas para la indexación",
      description: `${c} página(s) tienen etiquetas noindex y no pueden ser encontradas ni por los buscadores ni por los motores de IA.`,
      recommendation: "Comprueba que las páginas importantes no tengan noindex. Quita noindex de las páginas que deban ser visibles.",
    }),
    contact: {
      title: "Sin página de contacto dedicada",
      description: "No se encontró una página de contacto clara. Los motores de IA necesitan datos de contacto para representar a la empresa correctamente.",
      recommendation: "Crea una página de contacto con dirección, teléfono, correo y horario.",
    },
  },
};

function runGeoChecks(pages: ParsedPage[], domain: string, lang: string): Finding[] {
  const findings: Finding[] = [];
  const TX = GEO_TEXT[lang] || GEO_TEXT.sv;

  // Check for FAQ content
  const hasFaq = pages.some(
    (p) =>
      p.schemaTypes.includes("FAQPage") ||
      p.schemaTypes.includes("FAQPage_candidate") ||
      (p.url.toLowerCase().includes("faq") || p.url.toLowerCase().includes("vanliga-fragor"))
  );
  if (!hasFaq) {
    findings.push({
      key: "faq",
      category: "geo",
      severity: "high",
      ...TX.faq,
      evidence: { pagesChecked: pages.length },
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
      key: "orgSchema",
      category: "entity",
      severity: "high",
      ...TX.orgSchema,
      evidence: {
        schemasFound: [
          ...new Set(pages.flatMap((p) => p.schemaTypes)),
        ],
      },
    });
  }

  // Check meta descriptions
  const missingMeta = pages.filter((p) => !p.metaDescription);
  if (missingMeta.length > pages.length * 0.3) {
    findings.push({
      key: "meta",
      category: "seo",
      severity: "medium",
      ...TX.meta(missingMeta.length, pages.length),
      evidence: { missingCount: missingMeta.length, total: pages.length },
    });
  }

  // Check content depth (word count)
  const thinPages = pages.filter((p) => p.wordCount < 300);
  if (thinPages.length > pages.length * 0.5) {
    findings.push({
      key: "thin",
      category: "content",
      severity: "medium",
      ...TX.thin(thinPages.length, pages.length),
      evidence: {
        thinPages: thinPages.map((p) => ({ url: p.url, words: p.wordCount })).slice(0, 5),
      },
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
      key: "servicePages",
      category: "geo",
      severity: "medium",
      ...TX.servicePages,
      evidence: { urls: pages.map((p) => p.url).slice(0, 10) },
    });
  }

  // Check internal linking
  const avgInternalLinks =
    pages.reduce((sum, p) => sum + p.internalLinks, 0) / (pages.length || 1);
  if (avgInternalLinks < 3) {
    findings.push({
      key: "internalLinks",
      category: "indexing",
      severity: "low",
      ...TX.internalLinks(avgInternalLinks.toFixed(1)),
      evidence: { avgLinks: avgInternalLinks.toFixed(1) },
    });
  }

  // Check indexability
  const nonIndexable = pages.filter((p) => !p.indexable);
  if (nonIndexable.length > 0) {
    findings.push({
      key: "noindex",
      category: "indexing",
      severity: "high",
      ...TX.noindex(nonIndexable.length),
      evidence: { blockedUrls: nonIndexable.map((p) => p.url) },
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
      key: "contact",
      category: "entity",
      severity: "low",
      ...TX.contact,
      evidence: {},
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
