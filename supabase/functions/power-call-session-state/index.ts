import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAnalysisState } from "../_shared/power-call-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

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

    const supabase = createClient(supabaseUrl, serviceKey);

    // Support both GET (query param) and POST (body)
    let sessionId: string | null = null;
    if (req.method === "GET") {
      const url = new URL(req.url);
      sessionId = url.searchParams.get("sessionId");
    } else {
      const body = await req.json().catch(() => ({}));
      sessionId = body.sessionId;
    }

    if (!sessionId) throw new Error("sessionId required");

    const { data: session, error } = await supabase
      .from("power_call_sessions")
      .select("id, current_lead_id, next_lead_id, next_ready, next_preparing, cursor, status, served_lead_ids, organization_id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();

    if (error || !session) throw new Error("Session not found");

    // If next_lead exists but not yet ready, check if analyses completed since last poll
    // and auto-upgrade next_ready flag
    if (session.next_lead_id && !session.next_ready && !session.next_preparing) {
      const { data: nextLead } = await supabase
        .from("leads")
        .select("id, website")
        .eq("id", session.next_lead_id)
        .single();

      if (nextLead) {
        if (!nextLead.website) {
          // No website = immediately ready
          await supabase.from("power_call_sessions").update({
            next_ready: true,
            updated_at: new Date().toISOString(),
          }).eq("id", sessionId);
          session.next_ready = true;
        } else {
          const { webStatus, geoStatus } = await checkAnalysisState(supabase, session.next_lead_id);
          if (webStatus === "ready" && geoStatus === "ready") {
            await supabase.from("power_call_sessions").update({
              next_ready: true,
              updated_at: new Date().toISOString(),
            }).eq("id", sessionId);
            session.next_ready = true;
          }
        }
      }
    }

    return new Response(JSON.stringify({ session }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("power-call-session-state error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
