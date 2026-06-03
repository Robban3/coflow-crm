import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { selectNextItem, promotePoolToLead, buildLeadPayload } from "../_shared/power-call-helpers.ts";

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
    const body = await req.json();
    const { listId } = body;

    // Get user org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const orgId = profile?.organization_id;
    if (!orgId) throw new Error("No organization found for user");

    // Check for existing active session for this user+list
    let session: any = null;
    const sessionQuery = supabase
      .from("power_call_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .eq("status", "active");

    if (listId) {
      const { data: existing } = await sessionQuery.eq("list_id", listId).maybeSingle();
      session = existing;
    } else {
      const { data: existing } = await sessionQuery.is("list_id", null).maybeSingle();
      session = existing;
    }

    if (!session) {
      const { data: newSession, error: sessionErr } = await supabase
        .from("power_call_sessions")
        .insert({
          organization_id: orgId,
          user_id: user.id,
          list_id: listId || null,
          status: "active",
          served_lead_ids: [],
          cursor: {},
          next_lead_id: null,
          next_ready: false,
          next_preparing: false,
        })
        .select("*")
        .single();
      if (sessionErr || !newSession) throw new Error("Failed to create session");
      session = newSession;
    }

    // If session already has a current lead and is still active, restore it
    if (session.current_lead_id) {
      const { data: existingLead } = await supabase
        .from("leads")
        .select("*")
        .eq("id", session.current_lead_id)
        .single();

      if (existingLead) {
        const leadPayload = await buildLeadPayload(supabase, existingLead);
        console.log(`[power-call-start] Resuming session ${session.id} at lead ${session.current_lead_id}`);
        return new Response(JSON.stringify({
          sessionId: session.id,
          currentLead: leadPayload,
          nextReady: session.next_ready || false,
          nextPreparing: session.next_preparing || false,
          done: false,
          resumed: true,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Select first candidate
    const nextItem = await selectNextItem(supabase, {
      orgId,
      listId: listId || null,
      sessionId: session.id,
      userId: user.id,
      cursor: session.cursor || null,
    });

    if (!nextItem) {
      return new Response(JSON.stringify({ sessionId: session.id, currentLead: null, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Promote pool item to lead if needed
    let lead = nextItem.leadData;
    if (nextItem.kind === "pool" && nextItem.poolItem) {
      lead = await promotePoolToLead(supabase, orgId, nextItem.poolItem);
      if (!lead) {
        return new Response(JSON.stringify({ sessionId: session.id, currentLead: null, done: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const leadId = lead.id;

    // Acquire lock
    await supabase.from("power_call_locks").delete().lt("expires_at", new Date().toISOString());
    await supabase.from("power_call_locks").upsert({
      lead_id: leadId,
      organization_id: orgId,
      locked_by_user_id: user.id,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: "lead_id" });

    // Update session: set current, update cursor, mark next_preparing
    await supabase.from("power_call_sessions").update({
      current_lead_id: leadId,
      cursor: nextItem.newCursor,
      next_lead_id: null,
      next_ready: false,
      next_preparing: true,
      updated_at: new Date().toISOString(),
    }).eq("id", session.id);

    const leadPayload = await buildLeadPayload(supabase, lead);

    // Fire-and-forget: trigger prepare-next
    const projectRef = supabaseUrl.match(/\/\/([^.]+)\./)?.[1];
    const prepNextUrl = `https://${projectRef}.supabase.co/functions/v1/power-call-prepare-next`;
    fetch(prepNextUrl, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: session.id }),
    }).catch(() => null);

    return new Response(JSON.stringify({
      sessionId: session.id,
      currentLead: leadPayload,
      nextReady: false,
      nextPreparing: true,
      done: false,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("power-call-start error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
