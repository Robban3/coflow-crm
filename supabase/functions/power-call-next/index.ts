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
    const { sessionId, outcome, notes, callbackAt } = body;

    // Load session
    const { data: session, error: sessionErr } = await supabase
      .from("power_call_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .single();
    if (sessionErr || !session) throw new Error("Session not found or unauthorized");

    const orgId = session.organization_id;
    const prevLeadId = session.current_lead_id;

    // 1) Log call outcome if provided
    if (outcome && prevLeadId) {
      const { data: outcomeConfig } = await supabase
        .from("call_outcomes")
        .select("*")
        .eq("organization_id", orgId)
        .eq("key", outcome)
        .maybeSingle();

      const outcomeLabel = outcomeConfig?.label || outcome;

      // Create callback task if needed
      let callbackTaskId: string | null = null;
      if (callbackAt && (outcome === "callback" || outcomeConfig?.requires_task)) {
        const { data: task } = await supabase
          .from("tasks")
          .insert({
            lead_id: prevLeadId,
            title: `Återkoppla`,
            description: notes || null,
            priority: "medium",
            due_date: callbackAt,
            status: "todo",
            assigned_to: user.id,
            created_by: user.id,
            organization_id: orgId,
          })
          .select("id")
          .single();
        callbackTaskId = task?.id ?? null;
      }

      // Insert call log
      await supabase.from("call_logs").insert({
        organization_id: orgId,
        lead_id: prevLeadId,
        outcome_key: outcome,
        outcome_label: outcomeLabel,
        note: notes || null,
        callback_task_id: callbackTaskId,
        created_by: user.id,
      });

      // Update lead state
      const leadUpdate: Record<string, unknown> = {
        last_call_outcome_key: outcome,
        last_call_at: new Date().toISOString(),
      };
      if (outcome === "not_interested" || outcomeConfig?.lead_status_effect === "not_interested") {
        leadUpdate.is_not_interested = true;
        leadUpdate.not_interested_at = new Date().toISOString();
        leadUpdate.not_interested_reason = notes || null;
      }
      if (outcomeConfig?.lead_status_effect && outcomeConfig.lead_status_effect !== "not_interested") {
        leadUpdate.lead_status = outcomeConfig.lead_status_effect;
      }
      await supabase.from("leads").update(leadUpdate).eq("id", prevLeadId);
    }

    // 2) Release lock on previous lead
    if (prevLeadId) {
      await supabase.from("power_call_locks").delete()
        .eq("lead_id", prevLeadId)
        .eq("locked_by_user_id", user.id);
    }

    // 3) Determine next lead — prefer preloaded next
    let nextLeadId: string | null = null;
    // Track whether cursor was already advanced by prepare-next
    // When we use preloaded next, cursor was already saved by prepare-next, so no update needed.
    // When we select synchronously (fallback), we must update cursor here.
    let cursorAlreadyAdvanced = false;

    if (session.next_lead_id) {
      // Preloaded next (ready or not) — always use it for instant transition
      // cursor was advanced when prepare-next selected this lead, nothing to do
      nextLeadId = session.next_lead_id;
      cursorAlreadyAdvanced = true;
      console.log(`[power-call-next] Using preloaded next lead ${nextLeadId} (ready=${session.next_ready})`);
    } else {
      // Fallback: select synchronously using the current session cursor
      console.log(`[power-call-next] No preloaded next, selecting synchronously`);
      const nextItem = await selectNextItem(supabase, {
        orgId,
        listId: session.list_id,
        sessionId,
        userId: user.id,
        cursor: session.cursor || null,
      });

      if (nextItem) {
        if (nextItem.kind === "pool" && nextItem.poolItem) {
          const promoted = await promotePoolToLead(supabase, orgId, nextItem.poolItem);
          nextLeadId = promoted?.id || null;
        } else {
          nextLeadId = nextItem.id;
        }

        // Advance cursor immediately so repeated calls don't pick the same lead
        if (nextItem.newCursor) {
          await supabase.from("power_call_sessions").update({
            cursor: nextItem.newCursor,
          }).eq("id", sessionId);
          cursorAlreadyAdvanced = true;
        }
      }
    }

    if (!nextLeadId) {
      await supabase.from("power_call_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
        current_lead_id: null,
        next_lead_id: null,
        next_ready: false,
        next_preparing: false,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);

      return new Response(JSON.stringify({ done: true, sessionId, currentLead: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4) Acquire lock on next lead
    await supabase.from("power_call_locks").delete().lt("expires_at", new Date().toISOString());
    const { error: lockErr } = await supabase.from("power_call_locks").upsert({
      lead_id: nextLeadId,
      organization_id: orgId,
      locked_by_user_id: user.id,
      locked_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    }, { onConflict: "lead_id" });

    if (lockErr) {
      console.warn(`[power-call-next] Lock failed for ${nextLeadId}, trying fallback`);
      // Lock failed — try another candidate
      const fallbackItem = await selectNextItem(supabase, {
        orgId,
        listId: session.list_id,
        sessionId,
        userId: user.id,
        cursor: session.cursor || null,
      });
      if (fallbackItem) {
        if (fallbackItem.kind === "pool" && fallbackItem.poolItem) {
          const promoted = await promotePoolToLead(supabase, orgId, fallbackItem.poolItem);
          nextLeadId = promoted?.id || null;
        } else {
          nextLeadId = fallbackItem.id;
        }
      } else {
        nextLeadId = null;
      }
    }

    if (!nextLeadId) {
      await supabase.from("power_call_sessions").update({
        status: "ended",
        ended_at: new Date().toISOString(),
        current_lead_id: null,
        next_lead_id: null,
        next_ready: false,
        next_preparing: false,
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId);
      return new Response(JSON.stringify({ done: true, sessionId, currentLead: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5) Update session: new current, clear next, mark preparing
    await supabase.from("power_call_sessions").update({
      current_lead_id: nextLeadId,
      next_lead_id: null,
      next_ready: false,
      next_preparing: true,
      updated_at: new Date().toISOString(),
    }).eq("id", sessionId);

    // 6) Build payload for new current
    const { data: leadRow } = await supabase
      .from("leads")
      .select("*")
      .eq("id", nextLeadId)
      .single();

    const leadPayload = leadRow ? await buildLeadPayload(supabase, leadRow) : null;

    // 7) Fire-and-forget: prepare next
    const projectRef = supabaseUrl.match(/\/\/([^.]+)\./)?.[1];
    fetch(`https://${projectRef}.supabase.co/functions/v1/power-call-prepare-next`, {
      method: "POST",
      headers: { Authorization: authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    }).catch(() => null);

    return new Response(JSON.stringify({
      done: false,
      sessionId,
      currentLead: leadPayload,
      nextReady: false,
      nextPreparing: true,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("power-call-next error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
