import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let scanId: string | undefined;

  try {
    const body = await req.json();
    scanId = body.scanId;
    if (!scanId) throw new Error("scanId required");

    const { data: scan, error: scanErr } = await supabase
      .from("geo_quick_scans")
      .select("*")
      .eq("id", scanId)
      .single();

    if (scanErr || !scan) throw new Error("Scan not found");

    // Only process queued scans
    if (scan.status !== "queued") {
      console.log("Scan already", scan.status, "- skipping");
      return new Response(JSON.stringify({ status: scan.status }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── STEP 1: Set running ───
    await updateProgress(supabase, scanId, "running", 1, "Tar emot uppgifter");
    console.log("Scan", scanId, "→ running");

    // ─── STEP 2: Crawl pages ───
    await updateProgress(supabase, scanId, "running", 2, "Hämtar innehåll från webbplatsen");

    let pages: any[] = [];
    let errorCode: string | null = null;

    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    if (firecrawlKey) {
      try {
        // Map site
        const mapRes = await fetch("https://api.firecrawl.dev/v1/map", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${firecrawlKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ url: scan.website, limit: 15 }),
        });

        let urls: string[] = [scan.website];
        if (mapRes.ok) {
          const mapData = await mapRes.json();
          const allUrls: string[] = mapData.links || mapData.urls || [];
          const priorityPaths = [
            /\/(tjanster|services|kontakt|contact|om-oss|about|faq|vanliga-fragor)/i,
          ];
          const priority = allUrls.filter((u) =>
            priorityPaths.some((p) => p.test(u))
          );
          const rest = allUrls.filter(
            (u) => !priority.includes(u) && u !== scan.website
          );
          urls = [scan.website, ...priority, ...rest].slice(0, 8);
        }

        const results = await Promise.allSettled(
          urls.map(async (pageUrl: string) => {
            try {
              const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
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
              });
              if (!res.ok) return null;
              const d = await res.json();
              return {
                url: pageUrl,
                markdown: d.data?.markdown || "",
                metadata: d.data?.metadata || {},
              };
            } catch {
              return null;
            }
          })
        );
        for (const r of results) {
          if (r.status === "fulfilled" && r.value) pages.push(r.value);
        }
      } catch (e) {
        console.error("Firecrawl error:", e);
        errorCode = "firecrawl_error";
      }
    }

    // Fallback: simple fetch
    if (pages.length === 0 && !errorCode) {
      try {
        const res = await fetch(scan.website, {
          headers: { "User-Agent": "GEO-QuickScan/1.0" },
          signal: AbortSignal.timeout(15000),
        });
        const html = await res.text();
        pages.push({
          url: scan.website,
          markdown: html.substring(0, 8000),
          metadata: {},
          html,
        });
      } catch (e) {
        console.error("Fetch fallback error:", e);
        errorCode = "fetch_error";
      }
    }

    if (pages.length === 0) {
      throw Object.assign(new Error("Kunde inte hämta webbplatsinnehåll"), {
        errorCode: errorCode || "fetch_error",
      });
    }

    // ─── STEP 3: Parse + score + AI ───
    await updateProgress(supabase, scanId, "running", 3, "Skapar mini-rapport");

    const parsed = pages.map((p) => parsePage(p, scan.domain));
    const findings = runGeoChecks(parsed, scan.domain);
    const geoScore = computeGeoScore(findings, parsed);

    // Top 3 findings
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const sortedFindings = [...findings].sort(
      (a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9)
    );
    const topFindings = sortedFindings.slice(0, 3).map((f) => ({
      severity: f.severity,
      title: f.title,
      why: f.description,
      evidence: typeof f.evidence === "string" ? f.evidence : "",
    }));

    // AI summary + actions
    let summaryShort = "";
    let topActions: any[] = [];

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (LOVABLE_API_KEY) {
      try {
        const findingsSummary = sortedFindings
          .slice(0, 5)
          .map((f) => `[${f.severity.toUpperCase()}] ${f.title}: ${f.description}`)
          .join("\n");

        const pagesCtx = parsed
          .slice(0, 5)
          .map(
            (p) =>
              `${p.url} | Title: ${p.title || "N/A"} | H1: ${p.h1 || "N/A"} | Words: ${p.wordCount} | Schema: ${(p.schemaTypes || []).join(",") || "none"}`
          )
          .join("\n");

        const prompt = `Du är GEO-expert. Analysera ${scan.domain} (${scan.company_name || "okänt företag"}).

SIDOR (${parsed.length}):
${pagesCtx}

PROBLEM:
${findingsSummary}

GEO-POÄNG: ${geoScore}/100

Ge mig:
1. summary_short: svensk, professionell, max 500 tecken. Konkret om företagets AI-synlighet.
2. top_actions: 3 åtgärder med priority (quick_win|medium|long_term), title, steps.

Svara som JSON:
{ "summary_short": "...", "top_actions": [{"priority":"quick_win|medium|long_term","title":"...","steps":"..."}] }`;

        const aiRes = await fetch(
          "https://ai.gateway.lovable.dev/v1/chat/completions",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [
                {
                  role: "system",
                  content:
                    "Du är GEO-expert. Svara alltid med valid JSON. Inga markdown-kodblock.",
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
            const jsonMatch = content.match(
              /\{[\s\S]*"summary_short"[\s\S]*"top_actions"[\s\S]*\}/
            );
            if (jsonMatch) {
              const p = JSON.parse(jsonMatch[0]);
              summaryShort = (p.summary_short || "").substring(0, 600);
              topActions = (p.top_actions || []).slice(0, 3);
            }
          } catch {
            summaryShort = content.substring(0, 600);
          }
        }
      } catch (e) {
        console.error("AI error:", e);
        // Non-fatal: continue with fallback
      }
    }

    // Fallback summary
    if (!summaryShort) {
      const label =
        geoScore >= 80 ? "stark" : geoScore >= 50 ? "medel" : "låg";
      summaryShort = `${scan.domain} har ${label} AI-synlighet (${geoScore}/100). ${sortedFindings.length} problem identifierade under snabbscanningen av ${parsed.length} sidor.`;
    }

    // Fallback actions
    if (topActions.length === 0) {
      topActions = sortedFindings.slice(0, 3).map((f) => ({
        priority: f.severity === "high" ? "quick_win" : "medium",
        title: f.recommendation || f.title,
        steps: f.recommendation || "",
      }));
    }

    // ─── STEP 4: Save completed ───
    await supabase
      .from("geo_quick_scans")
      .update({
        status: "completed",
        geo_score: geoScore,
        summary_short: summaryShort,
        top_findings: topFindings,
        top_actions: topActions,
        completed_at: new Date().toISOString(),
        progress_step: 3,
        progress_label: "Klar",
      })
      .eq("id", scanId);

    console.log("Scan", scanId, "→ completed, score:", geoScore);

    // Send result email (non-blocking)
    sendResultEmail(scan, geoScore, summaryShort, topFindings, topActions).catch((e) =>
      console.error("Email send error:", e)
    );

    return new Response(
      JSON.stringify({ status: "completed", geoScore }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (pipelineError: any) {
    const code = pipelineError.errorCode || "unknown";
    const msg = pipelineError instanceof Error ? pipelineError.message : "Unknown error";
    console.error("Pipeline error:", code, msg);

    if (scanId) {
      await supabase
        .from("geo_quick_scans")
        .update({
          status: "failed",
          error_code: code,
          error_message: msg,
          progress_step: 0,
          progress_label: "",
        })
        .eq("id", scanId);

      // Fetch scan for email
      const { data: failedScan } = await supabase
        .from("geo_quick_scans")
        .select("*")
        .eq("id", scanId)
        .maybeSingle();

      if (failedScan) {
        sendFailureEmail(failedScan).catch((e) =>
          console.error("Failure email error:", e)
        );
      }
    }

    return new Response(
      JSON.stringify({ status: "failed", error_code: code }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── Helpers ───

async function updateProgress(
  supabase: any,
  scanId: string,
  status: string,
  step: number,
  label: string
) {
  await supabase
    .from("geo_quick_scans")
    .update({ status, progress_step: step, progress_label: label })
    .eq("id", scanId);
}

// ──── Email helpers ────

async function sendResultEmail(
  scan: any,
  geoScore: number,
  summary: string,
  findings: any[],
  actions: any[]
) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY missing, skipping email");
    return;
  }

  const resend = new Resend(resendKey);
  const reportUrl = `https://coflow.se/r/geo/${scan.public_token}`;
  const bookingUrl = `https://kodcogeo.se/boka?email=${encodeURIComponent(scan.email)}&domain=${encodeURIComponent(scan.domain)}&score=${geoScore}&token=${scan.public_token}&utm_source=mini_report&utm_medium=email&utm_campaign=geo`;

  const scoreLabel =
    geoScore >= 80 ? "Stark AI-synlighet" : geoScore >= 50 ? "Bra potential" : "Låg AI-synlighet";
  const scoreColorVal =
    geoScore >= 80 ? "#22c55e" : geoScore >= 50 ? "#eab308" : "#ef4444";

  const findingsHtml = findings
    .map(
      (f) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #333;color:#94a3b8;font-size:13px;">${f.severity === "high" ? "🔴" : f.severity === "medium" ? "🟡" : "🔵"} ${f.title}</td></tr>`
    )
    .join("");

  const actionsHtml = actions
    .map(
      (a) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #333;color:#94a3b8;font-size:13px;">✅ ${a.title}</td></tr>`
    )
    .join("");

  const companyLabel = scan.company_name || scan.domain;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;color:#e2e8f0;">
<div style="max-width:560px;margin:0 auto;padding:40px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin:0;">GEO-Rapport</p>
    <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:8px 0 4px;letter-spacing:-0.02em;">${companyLabel}</h1>
    <p style="font-size:13px;color:#475569;margin:0;">${scan.domain}</p>
  </div>

  <!-- Score Card -->
  <div style="background:linear-gradient(135deg,#111827 0%,#1e293b 100%);border-radius:20px;border:1px solid #1e293b;padding:36px 32px;text-align:center;margin-bottom:24px;box-shadow:0 0 60px ${scoreColorVal}11;">
    <div style="display:inline-block;width:88px;height:88px;line-height:88px;border-radius:50%;background:${scoreColorVal}15;border:3px solid ${scoreColorVal};font-size:32px;font-weight:800;color:${scoreColorVal};letter-spacing:-0.03em;">${geoScore}</div>
    <p style="font-size:13px;color:${scoreColorVal};margin:14px 0 0;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">${scoreLabel}</p>
  </div>

  <!-- Summary -->
  <div style="background:#111827;border-radius:16px;border:1px solid #1e293b;padding:24px;margin-bottom:24px;">
    <p style="font-size:14px;color:#cbd5e1;line-height:1.7;margin:0;">${summary}</p>
  </div>

  ${findings.length > 0 ? `<!-- Findings -->
  <div style="background:#111827;border-radius:16px;border:1px solid #1e293b;padding:24px;margin-bottom:24px;">
    <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:600;margin:0 0 16px;">Identifierade problem</p>
    ${findings.map((f) => `<div style="display:flex;align-items:flex-start;padding:10px 0;border-bottom:1px solid #1e293b;">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${f.severity === "high" ? "#ef4444" : f.severity === "medium" ? "#eab308" : "#3b82f6"};margin-top:5px;margin-right:12px;flex-shrink:0;"></span>
      <span style="font-size:13px;color:#94a3b8;line-height:1.5;">${f.title}</span>
    </div>`).join("")}
  </div>` : ""}

  ${actions.length > 0 ? `<!-- Actions -->
  <div style="background:#111827;border-radius:16px;border:1px solid #1e293b;padding:24px;margin-bottom:24px;">
    <p style="font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#64748b;font-weight:600;margin:0 0 16px;">Rekommenderade åtgärder</p>
    ${actions.map((a, i) => `<div style="display:flex;align-items:flex-start;padding:10px 0;${i < actions.length - 1 ? "border-bottom:1px solid #1e293b;" : ""}">
      <span style="display:inline-block;width:22px;height:22px;line-height:22px;border-radius:50%;background:#3b82f615;color:#60a5fa;font-size:11px;font-weight:700;text-align:center;margin-right:12px;flex-shrink:0;border:1px solid #3b82f630;">${i + 1}</span>
      <span style="font-size:13px;color:#94a3b8;line-height:1.5;">${a.title}</span>
    </div>`).join("")}
  </div>` : ""}

  <!-- CTA -->
  <div style="text-align:center;margin-bottom:32px;">
    <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);color:#fff;border-radius:14px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:-0.01em;box-shadow:0 4px 20px #3b82f633;">Öppna din rapport →</a>
    <div style="margin-top:12px;">
      <a href="${bookingUrl}" style="font-size:13px;color:#60a5fa;text-decoration:none;font-weight:500;">Boka 15 min genomgång</a>
    </div>
    <p style="font-size:11px;color:#475569;margin:6px 0 0;">Öppnas i webbläsaren</p>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:24px;border-top:1px solid #1e293b;">
    <p style="font-size:11px;color:#475569;margin:0;">Snabbscan av Kod & Co · <a href="https://kodcogeo.se" style="color:#64748b;text-decoration:none;">kodcogeo.se</a></p>
  </div>

</div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: "GEO Rapport <hej@kodco.se>",
      to: [scan.email],
      subject: `Din AI-synlighet: ${geoScore}/100 – mini-rapport`,
      html,
    });
    console.log("Result email sent to", scan.email);
  } catch (e) {
    console.error("Failed to send result email:", e);
  }
}

async function sendFailureEmail(scan: any) {
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) return;

  const resend = new Resend(resendKey);
  const bookingUrl = `https://kodcogeo.se/boka?email=${encodeURIComponent(scan.email)}&domain=${encodeURIComponent(scan.domain)}&utm_source=mini_report&utm_medium=email&utm_campaign=geo_failed`;

  const failCompanyLabel = scan.company_name || scan.domain;

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/></head>
<body style="margin:0;padding:0;background:#0a0c14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,sans-serif;color:#e2e8f0;">
<div style="max-width:560px;margin:0 auto;padding:40px 16px;">

  <div style="text-align:center;margin-bottom:32px;">
    <p style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin:0;">GEO-Rapport</p>
    <h1 style="font-size:22px;font-weight:700;color:#f1f5f9;margin:8px 0 4px;letter-spacing:-0.02em;">${failCompanyLabel}</h1>
  </div>

  <div style="background:#111827;border-radius:20px;border:1px solid #1e293b;padding:36px 32px;text-align:center;margin-bottom:24px;">
    <div style="display:inline-block;width:56px;height:56px;line-height:56px;border-radius:50%;background:#eab30815;border:2px solid #eab30840;font-size:24px;margin-bottom:16px;">⚠️</div>
    <h2 style="color:#f1f5f9;font-size:18px;margin:0 0 10px;font-weight:600;letter-spacing:-0.02em;">Vi kunde inte analysera webbplatsen</h2>
    <p style="font-size:14px;color:#94a3b8;line-height:1.6;margin:0;">Vi kunde inte automatiskt analysera <strong style="color:#cbd5e1;">${scan.domain}</strong>. Det kan bero på att webbplatsen blockerar automatiska besök.</p>
  </div>

  <div style="text-align:center;margin-bottom:32px;">
    <a href="${bookingUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#3b82f6 0%,#6366f1 100%);color:#fff;border-radius:14px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:-0.01em;box-shadow:0 4px 20px #3b82f633;">Boka genomgång istället</a>
    <p style="font-size:11px;color:#475569;margin:8px 0 0;">Öppnas i webbläsaren</p>
  </div>

  <div style="text-align:center;padding-top:24px;border-top:1px solid #1e293b;">
    <p style="font-size:11px;color:#475569;margin:0;">Kod & Co · <a href="https://kodcogeo.se" style="color:#64748b;text-decoration:none;">kodcogeo.se</a></p>
  </div>

</div>
</body>
</html>`;

  try {
    await resend.emails.send({
      from: "GEO Rapport <hej@kodco.se>",
      to: [scan.email],
      subject: "Vi kunde inte analysera webbplatsen automatiskt",
      html,
    });
  } catch (e) {
    console.error("Failed to send failure email:", e);
  }
}

// ──── Page parsing & scoring ────

interface ParsedPage {
  url: string;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  wordCount: number;
  indexable: boolean;
  schemaTypes: string[];
  internalLinks: number;
}

function parsePage(page: any, domain: string): ParsedPage {
  const md: string = page.markdown || "";
  const meta = page.metadata || {};

  const title = meta.title || meta.ogTitle || extractFirst(md, /^#\s+(.+)/m) || null;
  const h1 = extractFirst(md, /^#\s+(.+)/m) || null;
  const wordCount = md
    .replace(/[#*\[\]()!]/g, "")
    .split(/\s+/)
    .filter((w: string) => w.length > 0).length;

  const schemaTypes: string[] = [];
  const schemaMatches = md.match(/"@type"\s*:\s*"([^"]+)"/g);
  if (schemaMatches) {
    for (const m of schemaMatches) {
      const t = m.match(/"@type"\s*:\s*"([^"]+)"/);
      if (t) schemaTypes.push(t[1]);
    }
  }
  if (md.toLowerCase().includes("faq") || md.includes("Vanliga frågor"))
    schemaTypes.push("FAQPage_candidate");

  const linkMatches = md.match(/\[.*?\]\(.*?\)/g) || [];
  const internalLinks = linkMatches.filter((l: string) => {
    const href = l.match(/\((.*?)\)/)?.[1] || "";
    return (
      href.startsWith("/") ||
      href.includes(domain) ||
      (!href.startsWith("http") && !href.startsWith("mailto"))
    );
  }).length;

  const indexable =
    !md.toLowerCase().includes("noindex") && !meta.robots?.includes("noindex");

  return {
    url: page.url,
    title,
    metaDescription: meta.description || null,
    h1,
    wordCount,
    indexable,
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

  const hasFaq = pages.some(
    (p) =>
      p.schemaTypes.includes("FAQPage") ||
      p.schemaTypes.includes("FAQPage_candidate") ||
      p.url.toLowerCase().includes("faq") ||
      p.url.toLowerCase().includes("vanliga-fragor")
  );
  if (!hasFaq) {
    findings.push({
      category: "geo",
      severity: "high",
      title: "Saknar FAQ-sektion",
      description:
        "Ingen FAQ hittad. FAQ-innehåll är en av de viktigaste signalerna för AI-motorer.",
      evidence: {},
      recommendation:
        "Lägg till en FAQ-sida med vanliga frågor om era tjänster. Använd FAQPage-schema.",
    });
  }

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
        "Ingen strukturerad data för företaget. AI-motorer behöver schema.org för att referera korrekt.",
      evidence: {},
      recommendation: "Lägg till Organization eller LocalBusiness schema.",
    });
  }

  const missingMeta = pages.filter((p) => !p.metaDescription);
  if (missingMeta.length > pages.length * 0.3) {
    findings.push({
      category: "seo",
      severity: "medium",
      title: "Sidor saknar meta-beskrivning",
      description: `${missingMeta.length} av ${pages.length} sidor saknar meta-beskrivning.`,
      evidence: {},
      recommendation: "Skriv unika meta-beskrivningar (120-160 tecken) per sida.",
    });
  }

  const thinPages = pages.filter((p) => p.wordCount < 300);
  if (thinPages.length > pages.length * 0.5) {
    findings.push({
      category: "content",
      severity: "medium",
      title: "Tunt innehåll",
      description: `${thinPages.length} av ${pages.length} sidor har under 300 ord.`,
      evidence: {},
      recommendation: "Utöka innehållet med detaljerad information och definitioner.",
    });
  }

  const hasServicePages = pages.some(
    (p) =>
      p.url.toLowerCase().includes("tjanster") ||
      p.url.toLowerCase().includes("services") ||
      p.url.toLowerCase().includes("om-oss") ||
      p.url.toLowerCase().includes("about")
  );
  if (!hasServicePages) {
    findings.push({
      category: "geo",
      severity: "medium",
      title: "Saknar tjänstesidor",
      description: 'Inga dedikerade "Om oss" eller "Tjänster"-sidor hittades.',
      evidence: {},
      recommendation: "Skapa tydliga sidor som beskriver era tjänster i detalj.",
    });
  }

  const hasContact = pages.some(
    (p) =>
      p.url.toLowerCase().includes("kontakt") ||
      p.url.toLowerCase().includes("contact")
  );
  if (!hasContact) {
    findings.push({
      category: "entity",
      severity: "low",
      title: "Ingen dedikerad kontaktsida",
      description: "Ingen tydlig kontaktsida hittades.",
      evidence: {},
      recommendation: "Skapa en kontaktsida med adress, telefon och e-post.",
    });
  }

  const nonIndexable = pages.filter((p) => !p.indexable);
  if (nonIndexable.length > 0) {
    findings.push({
      category: "indexing",
      severity: "high",
      title: "Sidor blockerade från indexering",
      description: `${nonIndexable.length} sida/sidor har noindex-taggar.`,
      evidence: {},
      recommendation: "Ta bort noindex från sidor som ska vara synliga.",
    });
  }

  return findings;
}

function computeGeoScore(findings: Finding[], pages: ParsedPage[]): number {
  let score = 100;
  for (const f of findings) {
    switch (f.severity) {
      case "high": score -= 15; break;
      case "medium": score -= 8; break;
      case "low": score -= 3; break;
    }
  }
  const schemaCount = new Set(
    pages.flatMap((p) => p.schemaTypes.filter((s) => !s.includes("candidate")))
  ).size;
  if (schemaCount >= 2) score += 5;
  const avgWords = pages.reduce((s, p) => s + p.wordCount, 0) / (pages.length || 1);
  if (avgWords > 500) score += 5;
  return Math.max(0, Math.min(100, score));
}
