import { createClient } from "npm:@supabase/supabase-js@2";
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
  type OutreachContext,
} from "../_shared/outreach-prompt.ts";
import { fetchWithRetry } from "../_shared/http.ts";
import { lookupByOrgNumber } from "../_shared/bolagsverket.ts";
import { findOrgNumberByName } from "../_shared/orgnr-lookup.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms: ${label}`)), ms),
    ),
  ]);
}

// ── Email extraction helpers ─────────────────────────────────────────

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PREFERRED_PREFIXES = ["info@", "hej@", "kontakt@", "hello@", "contact@"];

function extractEmails(text: string): string[] {
  const matches = text.match(EMAIL_REGEX) || [];
  const unique = [...new Set(matches)].filter(
    (e) => !e.match(/\.(png|jpg|jpeg|gif|svg|webp|css|js)$/i)
  );
  return unique;
}

function pickBestEmail(emails: string[]): string | null {
  if (emails.length === 0) return null;
  for (const prefix of PREFERRED_PREFIXES) {
    const match = emails.find((e) => e.toLowerCase().startsWith(prefix));
    if (match) return match.toLowerCase();
  }
  return emails[0].toLowerCase();
}

// ── Content analysis helpers ─────────────────────────────────────────

function extractCopyrightYear(text: string): number | null {
  const patterns = [/©\s*(\d{4})/g, /\(c\)\s*(\d{4})/gi, /copyright\s*(\d{4})/gi];
  let latestYear: number | null = null;
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const year = parseInt(m[1]);
      if (year >= 2000 && year <= new Date().getFullYear()) {
        if (!latestYear || year > latestYear) latestYear = year;
      }
    }
  }
  return latestYear;
}

function detectContactForm(text: string): boolean {
  const lower = text.toLowerCase();
  const indicators = [
    "kontaktformulär", "contact form", "skicka meddelande",
    "send message", "formulär", '<form', 'type="submit"',
    "name=\"email\"", "name=\"message\"", "textarea",
  ];
  return indicators.some((i) => lower.includes(i));
}

function detectCTA(text: string): boolean {
  const lower = text.toLowerCase();
  const ctas = [
    "boka demo", "boka möte", "kontakta oss", "få offert",
    "ring oss", "beställ", "kom igång", "prova gratis",
    "book a demo", "get started", "contact us", "free trial",
    "begär offert", "läs mer", "cta",
  ];
  return ctas.some((c) => lower.includes(c));
}

function detectTechnology(text: string, metadata: Record<string, unknown>): string | null {
  const lower = text.toLowerCase();
  const rawGen = metadata?.generator;
  const generator = (typeof rawGen === "string" ? rawGen : "").toLowerCase();
  const all = lower + " " + generator;

  if (all.includes("wordpress") || all.includes("wp-content")) return "WordPress";
  if (all.includes("wix.com") || all.includes("wixsite")) return "Wix";
  if (all.includes("squarespace")) return "Squarespace";
  if (all.includes("shopify")) return "Shopify";
  if (all.includes("webflow")) return "Webflow";
  if (all.includes("weebly")) return "Weebly";
  if (all.includes("joomla")) return "Joomla";
  if (all.includes("drupal")) return "Drupal";
  if (all.includes("next.js") || all.includes("_next/")) return "Next.js";
  if (all.includes("gatsby")) return "Gatsby";
  return null;
}

function extractContactName(text: string): string | null {
  const sections = text.split(/\n/);
  let inContactSection = false;
  for (const line of sections) {
    const lower = line.toLowerCase().trim();
    if (lower.match(/^#{1,3}\s*(kontakt|om oss|team|vårt team|contact|about)/)) {
      inContactSection = true;
      continue;
    }
    if (inContactSection && line.trim().length > 0) {
      const nameMatch = line.match(/([A-ZÅÄÖ][a-zåäö]+(?:\s+[A-ZÅÄÖ][a-zåäö]+){1,2})/);
      if (nameMatch) return nameMatch[1];
    }
    if (inContactSection && lower.startsWith("#")) inContactSection = false;
  }
  return null;
}

// Sweden-only: Bolagsverket covers Swedish companies, so the official-data step
// must not touch US/DE/ES leads. A present org number is itself a Swedish
// signal; otherwise we treat an empty/Swedish country as SE (the default market).
function isSwedishMarket(lead: Record<string, unknown>): boolean {
  const country = (lead.country as string | null)?.trim().toLowerCase();
  return !country || ["se", "sverige", "sweden"].includes(country);
}

// Resolve the lead's org number for the Swedish market: use what's stored, else
// look it up for free in our own company_registry by name, else fall back to a
// Firecrawl web search. Returns null if it can't be resolved.
async function resolveSwedishOrgNumber(
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof supabaseAdmin>,
): Promise<string | null> {
  const existing = (lead.org_number as string | null)?.trim();
  if (existing) return existing;

  // Name-based resolution only makes sense for the Swedish market.
  if (!isSwedishMarket(lead)) return null;
  const name = (lead.company_name as string | null)?.trim();
  if (!name) return null;

  // 1) Free: exact name hit in our own registry (CSV / earlier enrichment).
  const { data: reg } = await supabase
    .from("company_registry")
    .select("org_number")
    .ilike("company_name", name)
    .limit(1)
    .maybeSingle();
  if (reg?.org_number) {
    console.log("[auto-enrich] STEP 0 – org number from registry:", reg.org_number);
    return reg.org_number;
  }

  // 2) Last resort: Firecrawl web search (costs credits).
  const found = await findOrgNumberByName(name);
  if (found) console.log("[auto-enrich] STEP 0 – org number from Firecrawl:", found);
  return found;
}

// ── STEP 0: Official company data from Bolagsverket ──────────────────
// Authoritative, free registry data keyed on org number. Complements the
// website crawl: it fills legal form / industry (SNI) / address / status into
// company_registry (the same table the bulk CSV import uses) so the lead view
// can show it. Best-effort and non-fatal — a missing or unknown org number must
// never block the rest of the enrichment.
async function stepBolagsverket(
  lead: Record<string, unknown>,
  supabase: ReturnType<typeof supabaseAdmin>,
  errors: string[],
): Promise<void> {
  // Swedish leads that already have an org number always qualify; others only if
  // we can resolve one (which is itself gated to the Swedish market).
  if ((lead.org_number as string | null)?.trim() ? false : !isSwedishMarket(lead)) return;

  const orgNumber = await resolveSwedishOrgNumber(lead, supabase);
  if (!orgNumber) return;

  // Persist a newly-resolved org number back onto the lead.
  if (!(lead.org_number as string | null)?.trim()) {
    await supabase.from("leads").update({ org_number: orgNumber }).eq("id", lead.id);
  }

  console.log("[auto-enrich] STEP 0 – Bolagsverket lookup START", orgNumber);
  try {
    const result = await lookupByOrgNumber(orgNumber);
    if (!result.ok || !result.normalized) {
      console.log("[auto-enrich] STEP 0 – no data:", result.error);
      return;
    }
    const c = result.normalized;
    // sni_* columns are TEXT in company_registry (the CSV import joins them too).
    const row = {
      org_number: c.org_number || orgNumber.replace(/\D/g, ""),
      company_name: c.company_name || (lead.company_name as string) || "",
      legal_form: c.legal_form,
      company_form: c.legal_form,
      registration_date: c.registration_date,
      address: c.address,
      postal_code: c.postal_code,
      city: c.city,
      sni_codes: c.sni_codes.length ? c.sni_codes.join(", ") : null,
      sni_descriptions: c.sni_descriptions.length ? c.sni_descriptions.join("; ") : null,
    };
    const { error } = await supabase
      .from("company_registry")
      .upsert(row, { onConflict: "org_number" });
    if (error) {
      errors.push(`bolagsverket: ${error.message}`);
      console.error("[auto-enrich] STEP 0 – upsert error:", error.message);
      return;
    }
    // Backfill the lead's company name if it was empty.
    if (c.company_name && !(lead.company_name as string)?.trim()) {
      await supabase.from("leads").update({ company_name: c.company_name }).eq("id", lead.id);
    }
    console.log("[auto-enrich] STEP 0 DONE –", c.company_name, c.legal_form, c.sni_codes.length, "SNI");
  } catch (e) {
    errors.push(`bolagsverket: ${(e as Error).message}`);
    console.error("[auto-enrich] STEP 0 – failed:", (e as Error).message);
  }
}

// ── STEP 1: Firecrawl deep crawl ─────────────────────────────────────

interface CrawlResult {
  markdown: string;
  emails: string[];
  contactName: string | null;
  copyrightYear: number | null;
  hasContactForm: boolean;
  hasCta: boolean;
  technology: string | null;
}

async function stepFirecrawlDeep(website: string): Promise<CrawlResult> {
  console.log("[auto-enrich] STEP 1 – Firecrawl deep crawl START");

  const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
  if (!apiKey) throw new Error("FIRECRAWL_API_KEY not configured");

  let url = website.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;

  const mainRes = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown", "links"], onlyMainContent: false }),
  }, { timeoutMs: 20_000, attempts: 2, label: "Firecrawl main" });
  const mainData = await mainRes.json().catch(() => ({}));
  if (!mainRes.ok) {
    const detail = String(mainData?.error || mainRes.status);
    // Many prospect sites have bot protection; make that explicit rather than a
    // generic failure, since retrying won't get past a 403.
    if (mainRes.status === 403 || /403|forbidden|blocked|bot|captcha|cloudflare/i.test(detail)) {
      throw new Error(`Sajten blockerar automatiserade verktyg (bot-skydd): ${detail}`);
    }
    throw new Error(`Firecrawl main page error: ${detail}`);
  }

  const mainMarkdown = mainData.data?.markdown || mainData.markdown || "";
  const mainMetadata = mainData.data?.metadata || mainData.metadata || {};
  const links: string[] = mainData.data?.links || mainData.links || [];

  let allMarkdown = mainMarkdown;
  let allEmails = extractEmails(mainMarkdown);

  const contactPaths = ["/kontakt", "/contact", "/om-oss", "/about", "/about-us"];
  const baseUrl = new URL(url);
  const contactLink = links.find((l: string) => {
    try {
      const u = new URL(l, url);
      return contactPaths.some((p) => u.pathname.toLowerCase().includes(p));
    } catch { return false; }
  }) || contactPaths.map((p) => `${baseUrl.origin}${p}`).find(() => true);

  if (contactLink) {
    console.log("[auto-enrich] Crawling contact page:", contactLink);
    try {
      const contactRes = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ url: contactLink, formats: ["markdown"], onlyMainContent: false }),
      }, { timeoutMs: 15_000, attempts: 2, label: "Firecrawl contact" });
      if (contactRes.ok) {
        const contactData = await contactRes.json();
        const contactMd = contactData.data?.markdown || contactData.markdown || "";
        allMarkdown += "\n\n" + contactMd;
        allEmails = [...allEmails, ...extractEmails(contactMd)];
      } else {
        await contactRes.text();
      }
    } catch (e) {
      console.log("[auto-enrich] Contact page crawl failed:", (e as Error).message);
    }
  }

  const mailtoMatches = allMarkdown.match(/mailto:([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi) || [];
  for (const m of mailtoMatches) {
    const email = m.replace("mailto:", "");
    if (!allEmails.includes(email)) allEmails.push(email);
  }

  const result: CrawlResult = {
    markdown: allMarkdown,
    emails: [...new Set(allEmails)],
    contactName: extractContactName(allMarkdown),
    copyrightYear: extractCopyrightYear(allMarkdown),
    hasContactForm: detectContactForm(allMarkdown),
    hasCta: detectCTA(allMarkdown),
    technology: detectTechnology(allMarkdown, mainMetadata),
  };

  console.log("[auto-enrich] STEP 1 DONE – emails found:", result.emails.length,
    "tech:", result.technology, "©:", result.copyrightYear,
    "form:", result.hasContactForm, "cta:", result.hasCta);

  return result;
}

// ── STEP 2: PageSpeed ────────────────────────────────────────────────

interface PageSpeedResult {
  performanceScore: number;
  mobileScore: number;
  loadTimeSeconds: number;
  hasSsl: boolean;
  seoScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
}

async function stepPageSpeed(website: string, leadId: string, orgId: string | null, supabase: ReturnType<typeof supabaseAdmin>): Promise<PageSpeedResult> {
  console.log("[auto-enrich] STEP 2 – PageSpeed START");

  let url = website.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) url = `https://${url}`;
  try { url = new URL(url).href; } catch { /* keep */ }

  const hasSsl = url.startsWith("https://");

  const apiKey = Deno.env.get("GOOGLE_PAGESPEED_API_KEY");
  let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&strategy=mobile&category=performance&category=seo&category=accessibility&category=best-practices`;
  if (apiKey) apiUrl += `&key=${apiKey}`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    const errBody = await res.text();
    console.error("[auto-enrich] PageSpeed error:", res.status, errBody);
    throw new Error(`PageSpeed HTTP ${res.status}`);
  }

  const data = await res.json();
  const cats = data.lighthouseResult?.categories || {};
  const audits = data.lighthouseResult?.audits || {};

  const performanceScore = Math.round((cats.performance?.score || 0) * 100);
  const seoScore = Math.round((cats.seo?.score || 0) * 100);
  const accessibilityScore = Math.round((cats.accessibility?.score || 0) * 100);
  const bestPracticesScore = Math.round((cats["best-practices"]?.score || 0) * 100);
  const mobileScore = performanceScore;

  const speedIndex = audits["speed-index"]?.numericValue || audits["first-contentful-paint"]?.numericValue || 5000;
  const loadTimeSeconds = Math.round((speedIndex / 1000) * 10) / 10;

  await supabase.from("web_analyses").delete().eq("lead_id", leadId);
  await supabase.from("web_analyses").insert({
    lead_id: leadId,
    organization_id: orgId,
    url,
    performance_score: performanceScore,
    seo_score: seoScore,
    accessibility_score: accessibilityScore,
    best_practices_score: bestPracticesScore,
    raw_data: data.lighthouseResult || null,
  });

  const result = { performanceScore, mobileScore, loadTimeSeconds, hasSsl, seoScore, accessibilityScore, bestPracticesScore };
  console.log("[auto-enrich] STEP 2 DONE –", result);
  return result;
}

// ── STEP 3: Problem scoring ──────────────────────────────────────────

interface DetectedProblem {
  key: string;
  label: string;
  value: string | null;
  weight: number;
}

interface ScoringResult {
  problems: DetectedProblem[];
  totalWeight: number;
  aiConfidence: number;
  shouldSkip: boolean;
}

function stepScoring(crawl: CrawlResult, pagespeed: PageSpeedResult | null): ScoringResult {
  console.log("[auto-enrich] STEP 3 – Problem scoring START");

  const problems: DetectedProblem[] = [];

  if (pagespeed && !pagespeed.hasSsl) {
    problems.push({ key: "no_ssl", label: "Saknar SSL", value: null, weight: 3 });
  }
  if (pagespeed && pagespeed.loadTimeSeconds > 3.0) {
    problems.push({ key: "slow_load", label: "Långsam laddningstid", value: `${pagespeed.loadTimeSeconds}s`, weight: 2 });
  }
  if (pagespeed && pagespeed.mobileScore < 60) {
    problems.push({ key: "poor_mobile", label: "Dålig mobilanpassning", value: `${pagespeed.mobileScore}/100`, weight: 2 });
  }
  if (crawl.copyrightYear && crawl.copyrightYear <= 2020) {
    problems.push({ key: "old_design", label: "Gammalmodig design", value: `© ${crawl.copyrightYear}`, weight: 2 });
  }
  problems.push({ key: "no_geo", label: "Saknar Google Maps / GEO-synlighet", value: null, weight: 1 });
  if (pagespeed && pagespeed.seoScore < 50) {
    problems.push({ key: "bad_seo", label: "Dålig SEO", value: `${pagespeed.seoScore}/100`, weight: 2 });
  }
  if (!crawl.hasCta && !crawl.hasContactForm) {
    problems.push({ key: "no_cta", label: "Ingen tydlig CTA / kontaktformulär", value: null, weight: 2 });
  }

  const totalWeight = problems.reduce((s, p) => s + p.weight, 0);
  const aiConfidence = Math.min(100, totalWeight * 12);

  const realProblems = problems.filter((p) => p.key !== "no_geo");
  const shouldSkip = realProblems.length === 0;

  console.log("[auto-enrich] STEP 3 DONE – problems:", problems.length,
    "totalWeight:", totalWeight, "confidence:", aiConfidence, "skip:", shouldSkip);

  return { problems, totalWeight, aiConfidence, shouldSkip };
}

// ── STEP 4: AI business understanding + fit scoring + email draft ────

interface BusinessAnalysis {
  businessSummary: string;
  businessFitScore: number;
  fitReason: string;
}

async function stepBusinessAnalysis(
  crawlMarkdown: string,
  companyName: string,
  serviceProfile: { industry: string; description: string } | null,
): Promise<BusinessAnalysis> {
  console.log("[auto-enrich] STEP 4a – Business analysis START");

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const truncatedContent = crawlMarkdown.substring(0, 2500);

  const serviceDesc = serviceProfile
    ? `\nDIN TJÄNST (bransch: ${serviceProfile.industry}):\n${serviceProfile.description}`
    : "\nDIN TJÄNST: Webbdesign och digital marknadsföring";

  const prompt = `Analysera detta företags hemsideinnehåll och returnera JSON.

FÖRETAG: ${companyName}
${serviceDesc}

HEMSIDEINNEHÅLL (utdrag):
${truncatedContent}

Returnera EXAKT detta JSON-format:
{
  "business_summary": "2-3 meningar som beskriver vad företaget gör, vilka kunder de riktar sig till, och deras bransch",
  "business_fit_score": <1-10 hur väl detta företag matchar som potentiell kund för DIN TJÄNST>,
  "fit_reason": "1 mening som förklarar varför score är hög/låg"
}

Regler:
- business_fit_score 8-10: Perfekt match (t.ex. lokalt tjänsteföretag med gammal hemsida för en webbyrå)
- business_fit_score 5-7: Rimlig match (kan ha nytta av tjänsten)
- business_fit_score 1-4: Dålig match (t.ex. de säljer samma sak som du, eller behöver inte din tjänst)
- Svara BARA med JSON, ingen annan text`;

  const aiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  }, { timeoutMs: 30_000, attempts: 2, label: "Gemini business-analysis" });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("[auto-enrich] Business analysis AI error:", aiRes.status, errText);
    throw new Error(`AI gateway ${aiRes.status}`);
  }

  const aiData = await aiRes.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  try {
    const jsonMatch = content.match(/\{[\s\S]*"business_summary"[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON");
    const parsed = JSON.parse(jsonMatch[0]);
    const result = {
      businessSummary: parsed.business_summary || "",
      businessFitScore: Math.min(10, Math.max(1, parseInt(parsed.business_fit_score) || 5)),
      fitReason: parsed.fit_reason || "",
    };
    console.log("[auto-enrich] STEP 4a DONE – fit:", result.businessFitScore, "reason:", result.fitReason);
    return result;
  } catch {
    console.warn("[auto-enrich] Business analysis parse failed, using defaults");
    return { businessSummary: "", businessFitScore: 5, fitReason: "Kunde inte analysera" };
  }
}

interface DraftResult {
  subject: string;
  body: string;
  aiSummary: string;
}

async function stepGenerateDraft(
  lead: Record<string, unknown>,
  problems: DetectedProblem[],
  crawlData: CrawlResult | null,
  businessSummary: string,
  serviceProfile: { industry: string; description: string } | null,
  senderName?: string,
  senderCompany?: string,
  senderTone?: string,
  pagespeedData?: PageSpeedResult | null,
): Promise<DraftResult> {
  console.log("[auto-enrich] STEP 4b – AI email generation START");

  const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
  if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

  const companyName = (lead.company_name as string) || "Företaget";
  const contactName = crawlData?.contactName || (lead.contact_name as string) || undefined;

  // Build context to mirror regenerate-flow quality as closely as possible
  const ctx: OutreachContext = {
    companyName,
    contactName,
    tone: senderTone || "standard",
    serviceProfile: serviceProfile || undefined,
    businessSummary: businessSummary || undefined,
    detectedProblems: problems,
    senderName: senderName || undefined,
    senderCompany: senderCompany || undefined,
    webAnalysis: pagespeedData
      ? {
          performanceScore: pagespeedData.performanceScore,
          seoScore: pagespeedData.seoScore,
          accessibilityScore: pagespeedData.accessibilityScore,
          bestPracticesScore: pagespeedData.bestPracticesScore,
        }
      : undefined,
    stepNumber: 1,
    totalSteps: 1,
  };

  const systemPrompt = buildOutreachSystemPrompt(ctx);
  const userPrompt = buildOutreachUserPrompt(ctx);

  const aiRes = await fetchWithRetry("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GEMINI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  }, { timeoutMs: 30_000, attempts: 2, label: "Gemini draft" });

  if (!aiRes.ok) {
    const errText = await aiRes.text();
    console.error("[auto-enrich] AI error:", aiRes.status, errText);
    throw new Error(`AI gateway ${aiRes.status}`);
  }

  const aiData = await aiRes.json();
  const content = aiData.choices?.[0]?.message?.content || "";

  const parsed = parseOutreachResponse(content, companyName);

  // NOTE: Do NOT append signature here – send-prospecting-batch adds it at send time
  // This prevents double-signature in the final email

  // Generate AI summary based on business context
  const aiSummary = businessSummary
    ? `${businessSummary.substring(0, 100)}. Mail fokuserar på värde, inte tekniska problem.`
    : `Prospekteringsmail baserat på webbanalys av ${companyName}.`;

  console.log("[auto-enrich] STEP 4b DONE – subject:", parsed.subject?.substring(0, 50));

  return {
    subject: parsed.subject,
    body: parsed.body_without_signature,
    aiSummary,
  };
}

// ── Main handler ─────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const TOTAL_TIMEOUT = 25_000;
  const deadline = Date.now() + TOTAL_TIMEOUT;
  let leadId: string | undefined;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceCall = token === serviceRoleKey;

    const body = await req.json();
    leadId = body.lead_id || body.record?.id;
    let callerUserId = body.user_id || null;
    const isManual = !!body.lead_id && !body.record;

    if (!leadId) {
      return new Response(
        JSON.stringify({ error: "lead_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    console.log(`[auto-enrich] === START lead=${leadId} manual=${isManual} ===`);
    const supabase = supabaseAdmin();

    // Fetch lead
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (leadErr || !lead) throw new Error(`Lead not found: ${leadErr?.message}`);

    const orgId = lead.organization_id as string | null;

    if (!isServiceCall) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user: caller }, error: authError } = await authClient.auth.getUser();
      if (authError || !caller) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: callerProfile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", caller.id)
        .single();
      if (!callerProfile?.organization_id || callerProfile.organization_id !== orgId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      callerUserId = caller.id;
    }

    // ── Guard: org auto_enrich_enabled ──
    if (!isManual && orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("auto_enrich_enabled")
        .eq("id", orgId)
        .single();
      if (org && org.auto_enrich_enabled === false) {
        console.log("[auto-enrich] SKIP – auto_enrich_enabled OFF");
        await supabase.from("leads").update({ enrichment_status: "skipped" }).eq("id", leadId);
        return new Response(
          JSON.stringify({ success: true, leadId, status: "skipped", reason: "auto_enrich_disabled" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── Guard: already processing (unless manual) ──
    const currentStatus = lead.enrichment_status as string | null;
    if (!isManual && (currentStatus === "processing" || currentStatus === "ready")) {
      console.log(`[auto-enrich] SKIP – already '${currentStatus}'`);
      return new Response(
        JSON.stringify({ success: true, leadId, status: currentStatus, reason: "already_done" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Collect non-fatal step errors from here on.
    const errors: string[] = [];

    // ── STEP 0: Official Bolagsverket company data (runs regardless of website) ──
    await stepBolagsverket(lead, supabase, errors);

    // ── Guard: need website ──
    const website = (lead.website as string)?.trim();
    if (!website) {
      console.log("[auto-enrich] SKIP – no website");
      await supabase.from("leads").update({ enrichment_status: "skipped", enrichment_error: "Ingen webbplats angiven" }).eq("id", leadId);
      return new Response(
        JSON.stringify({ success: true, leadId, status: "skipped", reason: "no_website" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Guard: bulk import delay ──
    const source = (lead.source as string) || "";
    if (["bulk_import", "csv_import", "registry_import"].includes(source)) {
      const delayMs = 2000 + Math.random() * 3000;
      console.log(`[auto-enrich] Bulk delay ${Math.round(delayMs)}ms`);
      await new Promise((r) => setTimeout(r, delayMs));
    }

    // ── Set status to processing ──
    await supabase.from("leads").update({
      enrichment_status: "processing",
      enrichment_started_at: new Date().toISOString(),
      enrichment_error: null,
    }).eq("id", leadId);

    // ── Fetch service profile + sender identity + org name ──
    let serviceProfile: { industry: string; description: string } | null = null;
    let senderName: string | undefined;
    let senderCompany: string | undefined;
    let senderTone: string | undefined;

    // Try explicit caller first, then created_by, then assigned_to, then fall back to any user in the org
    let senderUserId = callerUserId || (lead.created_by as string | null) || (lead.assigned_to as string | null);

    if (!senderUserId && orgId) {
      // Fallback: find any user in this org (prefer admin)
      const { data: orgUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("organization_id", orgId)
        .limit(1)
        .single();
      if (orgUser) senderUserId = orgUser.id;
    }

    if (senderUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("service_industry, service_description, full_name, organization_id, outreach_tone")
        .eq("id", senderUserId)
        .single();
      if (profile) {
        senderName = profile.full_name || undefined;
        senderTone = profile.outreach_tone || undefined;
        if (profile.service_industry && profile.service_description) {
          serviceProfile = {
            industry: profile.service_industry,
            description: profile.service_description,
          };
        }
        // Fetch org name for senderCompany
        const profileOrgId = profile.organization_id || orgId;
        if (profileOrgId) {
          const { data: org } = await supabase
            .from("organizations")
            .select("name")
            .eq("id", profileOrgId)
            .single();
          if (org?.name) senderCompany = org.name;
        }
      }
    }

    // Last resort: get org name even without a user
    if (!senderCompany && orgId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name")
        .eq("id", orgId)
        .single();
      if (org?.name) senderCompany = org.name;
    }

    console.log(`[auto-enrich] Sender resolved: name=${senderName || "NONE"} company=${senderCompany || "NONE"} userId=${senderUserId || "NONE"}`);

    const remainingMs = () => Math.max(deadline - Date.now(), 2000);

    // ═══ STEP 1 + 2: Firecrawl + PageSpeed in parallel ═══
    // PageSpeed gets a strict 12s cap so it doesn't eat the AI budget
    const PAGESPEED_TIMEOUT = 12_000;
    const [crawlSettled, pagespeedSettled] = await Promise.allSettled([
      withTimeout(stepFirecrawlDeep(website), remainingMs(), "firecrawl"),
      withTimeout(stepPageSpeed(website, leadId, orgId, supabase), Math.min(PAGESPEED_TIMEOUT, remainingMs()), "pagespeed"),
    ]);

    let crawlResult: CrawlResult | null = null;
    let pagespeedResult: PageSpeedResult | null = null;

    if (crawlSettled.status === "fulfilled") {
      crawlResult = crawlSettled.value;
    } else {
      errors.push(`firecrawl: ${crawlSettled.reason?.message}`);
      console.error("[auto-enrich] Firecrawl failed:", crawlSettled.reason?.message);
    }

    if (pagespeedSettled.status === "fulfilled") {
      pagespeedResult = pagespeedSettled.value;
    } else {
      errors.push(`pagespeed: ${pagespeedSettled.reason?.message}`);
      console.error("[auto-enrich] PageSpeed failed:", pagespeedSettled.reason?.message);
    }

    // ── Update lead with crawl data ──
    if (crawlResult) {
      const bestEmail = pickBestEmail(crawlResult.emails);
      const updateData: Record<string, unknown> = {
        has_contact_form: crawlResult.hasContactForm,
        has_cta: crawlResult.hasCta,
        site_technology: crawlResult.technology,
        site_copyright_year: crawlResult.copyrightYear,
      };
      if (bestEmail && !(lead.email as string)?.trim()) {
        updateData.email = bestEmail;
        console.log("[auto-enrich] Found email:", bestEmail);
      }
      if (crawlResult.contactName && !(lead.contact_name as string)?.trim()) {
        updateData.contact_name = crawlResult.contactName;
        console.log("[auto-enrich] Found contact:", crawlResult.contactName);
      }
      await supabase.from("leads").update(updateData).eq("id", leadId);
    }

    // ═══ STEP 3: Problem scoring ═══
    if (!crawlResult && !pagespeedResult) {
      await supabase.from("leads").update({
        enrichment_status: "failed",
        enrichment_completed_at: new Date().toISOString(),
        enrichment_error: errors.join("; "),
      }).eq("id", leadId);
      console.log("[auto-enrich] === DONE (both steps failed) ===");
      return new Response(
        JSON.stringify({ success: false, leadId, status: "failed", errors }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const scoring = stepScoring(
      crawlResult || { markdown: "", emails: [], contactName: null, copyrightYear: null, hasContactForm: false, hasCta: false, technology: null },
      pagespeedResult,
    );

    // Store detected problems
    await supabase.from("leads").update({ detected_problems: scoring.problems }).eq("id", leadId);

    // ═══ STEP 4a: Business understanding + fit scoring ═══
    let businessAnalysis: BusinessAnalysis | null = null;
    const companyName = (lead.company_name as string) || "Okänt företag";

    if (crawlResult && crawlResult.markdown.length > 100 && deadline - Date.now() > 5000) {
      try {
        businessAnalysis = await withTimeout(
          stepBusinessAnalysis(crawlResult.markdown, companyName, serviceProfile),
          Math.max(deadline - Date.now() - 3000, 3000),
          "business_analysis",
        );

        // Save business summary + fit score
        await supabase.from("leads").update({
          business_summary: businessAnalysis.businessSummary,
          business_fit_score: businessAnalysis.businessFitScore,
        }).eq("id", leadId);

        // Quality gate: skip if fit score too low
        if (businessAnalysis.businessFitScore < 3) {
          console.log(`[auto-enrich] SKIP – low business fit: ${businessAnalysis.businessFitScore}/10 – ${businessAnalysis.fitReason}`);
          await supabase.from("leads").update({
            enrichment_status: "skipped",
            enrichment_completed_at: new Date().toISOString(),
            enrichment_error: `Lågt business fit (${businessAnalysis.businessFitScore}/10): ${businessAnalysis.fitReason}`,
          }).eq("id", leadId);
          return new Response(
            JSON.stringify({
              success: true, leadId, status: "skipped",
              reason: "low_business_fit",
              businessFitScore: businessAnalysis.businessFitScore,
              fitReason: businessAnalysis.fitReason,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      } catch (e) {
        errors.push(`business_analysis: ${(e as Error).message}`);
        console.error("[auto-enrich] Business analysis failed:", (e as Error).message);
      }
    }

    // ── Check if should skip (no real problems AND no business fit advantage) ──
    if (scoring.shouldSkip && (!businessAnalysis || businessAnalysis.businessFitScore < 3)) {
      console.log("[auto-enrich] STEP 3 – No sellable problems found, skipping draft");
      await supabase.from("leads").update({
        enrichment_status: "skipped",
        enrichment_completed_at: new Date().toISOString(),
        enrichment_error: "Inga säljbara problem hittades – bra sida",
      }).eq("id", leadId);
      return new Response(
        JSON.stringify({ success: true, leadId, status: "skipped", reason: "no_problems", problems: scoring.problems }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ═══ STEP 4b: Generate email draft ═══
    let draft: DraftResult | null = null;
    if (deadline - Date.now() > 3000) {
      try {
        draft = await withTimeout(
          stepGenerateDraft(
            lead,
            scoring.problems,
            crawlResult,
            businessAnalysis?.businessSummary || "",
            serviceProfile,
            senderName,
            senderCompany,
            senderTone,
            pagespeedResult,
          ),
          Math.max(deadline - Date.now() - 1000, 3000),
          "ai_draft",
        );
      } catch (e) {
        errors.push(`ai_draft: ${(e as Error).message}`);
        console.error("[auto-enrich] AI draft failed:", (e as Error).message);
      }
    } else {
      errors.push("ai_draft: skipped (timeout approaching)");
    }

    // ═══ STEP 5: Save results (with dedup) ═══
    console.log("[auto-enrich] STEP 5 – Save results");

    if (draft) {
      // Dedup: check if draft already exists for this lead
      const { data: existingDrafts } = await supabase
        .from("prospecting_drafts")
        .select("id")
        .eq("lead_id", leadId)
        .in("status", ["draft", "approved"]);

      // Dedup: check if outreach was already sent to this lead
      const leadEmail = (lead.email as string)?.trim();
      let alreadySent = false;
      if (leadEmail) {
        const { data: sentEmails } = await supabase
          .from("sent_emails")
          .select("id")
          .eq("lead_id", leadId)
          .eq("status", "sent")
          .limit(1);
        alreadySent = (sentEmails?.length ?? 0) > 0;
      }

      let draftSaved = false;
      if ((existingDrafts?.length ?? 0) > 0) {
        console.log("[auto-enrich] SKIP draft – already has pending draft for this lead");
      } else if (alreadySent) {
        console.log("[auto-enrich] SKIP draft – outreach already sent to this lead");
      } else {
        const { error: draftErr } = await supabase.from("prospecting_drafts").insert({
          organization_id: orgId,
          lead_id: leadId,
          subject: draft.subject,
          body: draft.body,
          ai_summary: draft.aiSummary,
          ai_confidence: scoring.aiConfidence,
          status: "draft",
        });

        if (draftErr) {
          console.error("[auto-enrich] Draft insert error:", draftErr.message);
          errors.push(`draft_save: ${draftErr.message}`);
          // If draft insert failed, mark as failed so lead doesn't get stuck in limbo
          await supabase.from("leads").update({
            enrichment_status: "failed",
            enrichment_completed_at: new Date().toISOString(),
            enrichment_error: `Draft kunde inte sparas: ${draftErr.message}`,
          }).eq("id", leadId);
          return new Response(
            JSON.stringify({ success: false, leadId, error: `draft_save: ${draftErr.message}` }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        draftSaved = true;
      }

      const hasPendingDraft = draftSaved || (existingDrafts?.length ?? 0) > 0;
      await supabase.from("leads").update({
        enrichment_status: alreadySent ? "sent" : "ready",
        auto_draft_generated: hasPendingDraft,
        enrichment_completed_at: new Date().toISOString(),
        enrichment_error: errors.length > 0 ? errors.join("; ") : null,
      }).eq("id", leadId);
    } else {
      // If we have crawl data, the lead is still usable even without a draft
      const hasUsableData = !!crawlResult;
      const enrichStatus = hasUsableData ? "ready" : (errors.length > 0 ? "failed" : "ready");
      await supabase.from("leads").update({
        enrichment_status: enrichStatus,
        enrichment_completed_at: new Date().toISOString(),
        enrichment_error: errors.join("; ") || null,
      }).eq("id", leadId);
    }

    const finalStatus = draft ? "ready" : (crawlResult ? "ready" : (errors.length > 0 ? "failed" : "ready"));
    console.log(`[auto-enrich] === DONE lead=${leadId} status=${finalStatus} problems=${scoring.problems.length} fit=${businessAnalysis?.businessFitScore ?? "N/A"} errors=${errors.length} ===`);

    return new Response(
      JSON.stringify({
        success: true,
        leadId,
        status: finalStatus,
        problemCount: scoring.problems.length,
        aiConfidence: scoring.aiConfidence,
        businessFitScore: businessAnalysis?.businessFitScore,
        draftGenerated: !!draft,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[auto-enrich] FATAL:", error);
    if (leadId) {
      try {
        const supabase = supabaseAdmin();
        await supabase.from("leads").update({
          enrichment_status: "failed",
          enrichment_completed_at: new Date().toISOString(),
          enrichment_error: (error as Error).message || "Unknown fatal error",
        }).eq("id", leadId);
      } catch { /* ignore */ }
    }
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
