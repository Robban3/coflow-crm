import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED_EVENT_TYPES = new Set([
  "view",
  "heartbeat",
  "section_view",
  "scroll_depth",
  "cta_click",
  "pdf_click",
  "share_click",
]);

const ALLOWED_META_KEYS = new Set(["path", "viewportW", "viewportH", "variant"]);

function sanitizeMeta(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(meta as Record<string, unknown>)) {
    if (!ALLOWED_META_KEYS.has(k)) continue;
    if (typeof v === "string") {
      out[k] = v.slice(0, 200);
    } else if (typeof v === "number") {
      out[k] = v;
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

// Simple in-memory rate limiting (per isolate)
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string, maxPerMin: number): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  bucket.count++;
  return bucket.count > maxPerMin;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { token, sessionKey, events } = body;

    // Validate inputs
    if (
      !token ||
      typeof token !== "string" ||
      token.length < 10 ||
      token.length > 80
    ) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      !sessionKey ||
      typeof sessionKey !== "string" ||
      sessionKey.length < 10 ||
      sessionKey.length > 80
    ) {
      return new Response(JSON.stringify({ error: "Invalid sessionKey" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(events) || events.length === 0 || events.length > 20) {
      return new Response(
        JSON.stringify({ error: "Events must be array of 1-20 items" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Rate limit per token
    if (isRateLimited(`token:${token}`, 60)) {
      return new Response(JSON.stringify({ error: "Rate limited" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Upsert session
    const referrer =
      typeof body.referrer === "string"
        ? body.referrer.slice(0, 200)
        : null;
    const userAgentHash =
      typeof body.userAgentHash === "string"
        ? body.userAgentHash.slice(0, 64)
        : null;

    // Try to resolve report_id and lead_id from token
    const { data: share } = await supabase
      .from("report_shares")
      .select("report_id")
      .eq("token", token)
      .eq("enabled", true)
      .maybeSingle();

    let reportId: string | null = share?.report_id ?? null;
    let leadId: string | null = null;

    if (reportId) {
      const { data: report } = await supabase
        .from("reports")
        .select("lead_id")
        .eq("id", reportId)
        .maybeSingle();
      leadId = report?.lead_id ?? null;
    }

    // Count heartbeats for active time estimate (15s per heartbeat)
    const heartbeatCount = events.filter(
      (e: any) => e.type === "heartbeat"
    ).length;
    const activeMs = heartbeatCount * 15_000;

    // Upsert session
    const { error: sessionErr } = await supabase
      .from("report_view_sessions")
      .upsert(
        {
          session_key: sessionKey,
          report_token: token,
          report_id: reportId,
          lead_id: leadId,
          last_seen_at: new Date().toISOString(),
          user_agent_hash: userAgentHash,
          referrer,
          total_active_ms: activeMs,
        },
        {
          onConflict: "session_key",
          ignoreDuplicates: false,
        }
      );

    if (sessionErr) {
      // If upsert failed, try update only
      if (activeMs > 0) {
        // Use raw SQL via RPC for atomic increment — but we don't have one.
        // Just update last_seen_at
        await supabase
          .from("report_view_sessions")
          .update({
            last_seen_at: new Date().toISOString(),
          })
          .eq("session_key", sessionKey);
      }
    }

    // Insert events
    const validEvents = events
      .filter((e: any) => e.type && ALLOWED_EVENT_TYPES.has(e.type))
      .map((e: any) => ({
        report_token: token,
        session_key: sessionKey,
        event_type: e.type,
        event_name:
          typeof e.name === "string" ? e.name.slice(0, 100) : null,
        value_int:
          typeof e.valueInt === "number"
            ? Math.min(Math.max(e.valueInt, 0), 10000)
            : null,
        meta: sanitizeMeta(e.meta),
      }));

    if (validEvents.length > 0) {
      await supabase.from("report_view_events").insert(validEvents);
    }

    // --- First-time view notification ---
    const hasViewEvent = events.some((e: any) => e.type === "view");
    if (hasViewEvent && reportId && leadId) {
      // Check if this is the first session ever for this report token
      const { count } = await supabase
        .from("report_view_sessions")
        .select("id", { count: "exact", head: true })
        .eq("report_token", token);

      if (count !== null && count <= 1) {
        // First view – get report details and creator
        const { data: reportData } = await supabase
          .from("reports")
          .select("title, created_by")
          .eq("id", reportId)
          .maybeSingle();

        const { data: leadData } = await supabase
          .from("leads")
          .select("company_name, contact_name")
          .eq("id", leadId)
          .maybeSingle();

        if (reportData?.created_by) {
          const leadLabel = leadData?.company_name || leadData?.contact_name || "Okänd";
          await supabase.from("notifications").insert({
            user_id: reportData.created_by,
            type: "report_opened",
            title: "Rapport öppnad",
            message: `${leadLabel} öppnade rapporten "${reportData.title}"`,
            link: `/leads/${leadId}`,
            metadata: { report_id: reportId, lead_id: leadId },
          });

          // Also log an activity for the lead timeline
          await supabase.from("activities").insert({
            lead_id: leadId,
            type: "note",
            title: "Rapport öppnad av mottagare",
            description: `Rapporten "${reportData.title}" öppnades för första gången`,
            completed_at: new Date().toISOString(),
            user_id: null,
            organization_id: null,
          });
        }
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("report-track error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
