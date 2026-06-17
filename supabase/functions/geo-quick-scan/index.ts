import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ─── CORS ───
const ALLOWED_ORIGINS = [
  "https://kodcogeo.se",
  "https://www.kodcogeo.se",
];

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow localhost in dev
  if (origin.includes("localhost") || origin.includes("127.0.0.1")) return true;
  return false;
}

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = isAllowedOrigin(origin) ? origin! : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, x-geo-secret",
    "Access-Control-Max-Age": "86400",
  };
}

// ─── Helpers ───

function generateToken(len = 32): string {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, len);
}

function isValidEmail(e: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
}

function normalizeWebsiteUrl(input: string): { normalizedUrl: string; hostname: string } | null {
  let value = (input || "").trim();
  if (!value) return null;

  if (value.startsWith("www.")) {
    value = "https://" + value;
  }
  if (!value.startsWith("http://") && !value.startsWith("https://")) {
    value = "https://" + value;
  }

  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return null;
  }

  if (!u.hostname.includes(".")) return null;

  // Block localhost & private IPs
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1" || h.startsWith("192.168.") || h.startsWith("10.") || h.startsWith("172.")) return null;

  return { normalizedUrl: u.origin, hostname: u.hostname.replace(/^www\./, "").toLowerCase() };
}

function jsonResponse(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
  });
}

// ─── Serve ───

serve(async (req) => {
  const origin = req.headers.get("origin");
  const reqId = crypto.randomUUID().slice(0, 8);

  // OPTIONS
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error_code: "method_not_allowed", message: "Only POST is accepted" }, 405, origin);
  }

  try {
    // ─── Auth ───
    const WEBHOOK_SECRET = Deno.env.get("KODCOGEO_WEBHOOK_SECRET");
    const secret = req.headers.get("x-geo-secret");
    if (!WEBHOOK_SECRET || !secret || secret !== WEBHOOK_SECRET) {
      console.log(`[${reqId}] 401 unauthorized`);
      return jsonResponse({ error_code: "unauthorized", message: "Unauthorized" }, 401, origin);
    }

    const body = await req.json();
    const { companyName, email, website: rawWebsite, phone, message: leadMessage } = body;

    // ─── Validation ───
    if (!email || !isValidEmail(email)) {
      return jsonResponse({ error_code: "invalid_email", message: "Ogiltig e-postadress" }, 400, origin);
    }

    if (!rawWebsite || (typeof rawWebsite === "string" && rawWebsite.trim().length < 3)) {
      return jsonResponse({ error_code: "invalid_website", message: "Skriv en giltig webbplats, t.ex. företag.se eller https://företag.se" }, 400, origin);
    }

    const normalized = normalizeWebsiteUrl(rawWebsite);
    if (!normalized) {
      return jsonResponse({ error_code: "invalid_website", message: "Skriv en giltig webbplats, t.ex. företag.se eller https://företag.se" }, 400, origin);
    }

    const { normalizedUrl: website, hostname: domain } = normalized;
    const emailLower = email.toLowerCase().trim();

    // ─── Forced org ───
    const KODCO_ORG_ID = Deno.env.get("KODCO_ORG_ID");
    if (!KODCO_ORG_ID) {
      console.error(`[${reqId}] KODCO_ORG_ID not configured`);
      return jsonResponse({ error_code: "server_error", message: "Server configuration error" }, 500, origin);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ─── Lead linking (within Kodco org) ───
    let leadId: string | null = null;

    // Try find by email
    const { data: leadByEmail } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", KODCO_ORG_ID)
      .eq("email", emailLower)
      .limit(1)
      .maybeSingle();

    if (leadByEmail) {
      leadId = leadByEmail.id;
    } else {
      // Try find by domain match
      const { data: leadByDomain } = await supabase
        .from("leads")
        .select("id, website")
        .eq("organization_id", KODCO_ORG_ID)
        .not("website", "is", null)
        .limit(50);

      if (leadByDomain) {
        for (const l of leadByDomain) {
          if (!l.website) continue;
          const n = normalizeWebsiteUrl(l.website);
          if (n && n.hostname === domain) {
            leadId = l.id;
            break;
          }
        }
      }
    }

    // Create lead if not found
    if (!leadId) {
      const notes = [phone ? `Tel: ${phone}` : null, leadMessage || null].filter(Boolean).join("\n");
      const { data: newLead, error: leadErr } = await supabase
        .from("leads")
        .insert({
          company_name: companyName || domain,
          email: emailLower,
          website,
          phone: phone || null,
          source: "kodcogeo",
          organization_id: KODCO_ORG_ID,
          source_data: leadMessage ? { message: leadMessage } : null,
        })
        .select("id")
        .single();

      if (leadErr) {
        console.error(`[${reqId}] Lead creation error:`, leadErr);
        // Non-fatal: continue without lead link
      } else {
        leadId = newLead.id;
        console.log(`[${reqId}] Created lead ${leadId}`);
      }
    } else {
      console.log(`[${reqId}] Linked to existing lead ${leadId}`);
    }

    // ─── Dedupe: completed scan in last 24h ───
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: completed } = await supabase
      .from("geo_quick_scans")
      .select("id, public_token, geo_score, status")
      .eq("email", emailLower)
      .eq("domain", domain)
      .eq("status", "completed")
      .gte("created_at", twentyFourHoursAgo)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (completed) {
      console.log(`[${reqId}] Dedupe: completed scan ${completed.id}, token=${completed.public_token}`);
      return jsonResponse({
        status: "completed",
        token: completed.public_token,
        geoScore: completed.geo_score,
        reportUrl: `https://coflow.se/r/geo/${completed.public_token}`,
      }, 200, origin);
    }

    // Dedupe: queued/running scan
    const { data: pending } = await supabase
      .from("geo_quick_scans")
      .select("id, public_token, status")
      .eq("email", emailLower)
      .eq("domain", domain)
      .in("status", ["queued", "running"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending) {
      console.log(`[${reqId}] Dedupe: pending scan ${pending.id}, status=${pending.status}`);
      return jsonResponse({
        status: pending.status,
        token: pending.public_token,
        reportUrl: `https://coflow.se/r/geo/${pending.public_token}`,
        geoScore: null,
      }, 200, origin);
    }

    // ─── Create new scan ───
    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: scan, error: insertErr } = await supabase
      .from("geo_quick_scans")
      .insert({
        company_name: companyName || null,
        email: emailLower,
        website,
        domain,
        lead_id: leadId,
        organization_id: KODCO_ORG_ID,
        public_token: token,
        expires_at: expiresAt,
        status: "queued",
        progress_step: 1,
        progress_label: "Tar emot uppgifter",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[${reqId}] Insert error:`, insertErr);
      return jsonResponse({ error_code: "server_error", message: "Kunde inte skapa scan" }, 500, origin);
    }

    console.log(`[${reqId}] New scan ${scan.id}, token=${token}, lead=${leadId}`);

    // Fire-and-forget: trigger processor
    const processUrl = `${supabaseUrl}/functions/v1/run-geo-quick-scan`;
    fetch(processUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ scanId: scan.id }),
    }).then((r) => {
      console.log(`[${reqId}] Processor trigger: ${r.status}`);
    }).catch((e) => {
      console.error(`[${reqId}] Failed to trigger processor:`, e);
    });

    return jsonResponse({
      status: "queued",
      token,
      reportUrl: `https://coflow.se/r/geo/${token}`,
      geoScore: null,
    }, 200, origin);

  } catch (error) {
    console.error(`[${reqId}] Unhandled error:`, error);
    return jsonResponse({
      error_code: "server_error",
      message: error instanceof Error ? error.message : "Okänt fel",
    }, 500, origin);
  }
});
