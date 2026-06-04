import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { selectNextItem, promotePoolToLead, checkAnalysisState, triggerAnalyses } from "../_shared/power-call-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Declare sessionId in outer scope so error handler can reset next_preparing
  let sessionId: string | null = null;
  let supabase: any = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    sessionId = body.sessionId;

    const { data: session } = await supabase
      .from("power_call_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (!session) throw new Error("Session not found");

    // Anti-race: if already preparing AND we have a next_lead_id, bail out
    if (session.next_preparing && session.next_lead_id) {
      console.log(`[power-call-prepare-next] Already preparing for session ${sessionId}, skipping`);
      return new Response(JSON.stringify({ ok: true, skipped: true, nextLeadId: session.next_lead_id, nextReady: session.next_ready }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const orgId = session.organization_id;

    // Mark preparing = true immediately to prevent races
    await supabase.from("power_call_sessions").update({
      next_preparing: true,
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);

    // Select next candidate using the CURRENT session cursor
    // (current lead is locked so selectNextItem naturally excludes it)
    const nextItem = await selectNextItem(supabase, {
      orgId,
      listId: session.list_id,
      sessionId,
      userId: user.id,
      cursor: session.cursor || null,
    });

    if (!nextItem) {
      console.log(`[power-call-prepare-next] No more candidates for session ${sessionId}`);
      await supabase.from("power_call_sessions").update({
        next_lead_id: null,
        next_ready: false,
        next_preparing: false,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return new Response(JSON.stringify({ ok: true, nextLeadId: null, nextReady: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Promote pool item if needed
    let candidateId: string | null = null;
    if (nextItem.kind === "pool" && nextItem.poolItem) {
      const promoted = await promotePoolToLead(supabase, orgId, nextItem.poolItem);
      candidateId = promoted?.id || null;
    } else {
      candidateId = nextItem.id;
    }

    if (!candidateId) {
      await supabase.from("power_call_sessions").update({
        next_lead_id: null,
        next_ready: false,
        next_preparing: false,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      return new Response(JSON.stringify({ ok: true, nextLeadId: null, nextReady: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Persist the chosen next candidate AND advance cursor
    // CRITICAL FIX: cursor must be updated here so next call to selectNextItem
    // (in prepare-next or power-call-next fallback) doesn't pick the same lead
    await supabase.from("power_call_sessions").update({
      next_lead_id: candidateId,
      next_ready: false,
      cursor: nextItem.newCursor,  // advance cursor so list doesn't reset
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);

    // Get lead website to decide if we need analysis
    const { data: candidateLead } = await supabase
      .from("leads")
      .select("id, website")
      .eq("id", candidateId)
      .single();

    let nextReady = false;

    if (candidateLead?.website) {
      // Check existing analysis state
      const { webStatus, geoStatus } = await checkAnalysisState(supabase, candidateId);
      console.log(`[power-call-prepare-next] candidate=${candidateId} web=${webStatus} geo=${geoStatus}`);

      if (webStatus === "ready" && geoStatus === "ready") {
        // Analyses already exist — next is immediately ready
        nextReady = true;
      } else {
        // Trigger missing analyses (fire-and-forget — do not block)
        // Pass supabase client so triggerAnalyses can resolve website URL and persist web results
        triggerAnalyses(authHeader, supabaseUrl, candidateId, {
          web: webStatus !== "ready",
          geo: geoStatus !== "ready",
        }, supabase).catch(() => null);
        // next_ready stays false — session-state polling will detect completion and flip it
      }
    } else {
      // No website: analyses not applicable, mark ready immediately
      nextReady = true;
    }

    // Final update: set next_ready and clear preparing flag
    await supabase.from("power_call_sessions").update({
      next_ready: nextReady,
      next_preparing: false,
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);

    console.log(`[power-call-prepare-next] Done: candidate=${candidateId} nextReady=${nextReady}`);

    return new Response(JSON.stringify({ ok: true, nextLeadId: candidateId, nextReady }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("power-call-prepare-next error:", error);

    // Reset next_preparing flag so session is never stuck
    if (sessionId && supabase) {
      try {
        await supabase.from("power_call_sessions").update({
          next_preparing: false,
          updated_at: new Date().toISOString(),
        }).eq("id", sessionId);
      } catch { /* städning misslyckades – ignorera, felet rapporteras nedan */ }
    }

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
