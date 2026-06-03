import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { checkAnalysisState, triggerAnalysisKind } from "../_shared/power-call-helpers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * ensure-lead-analyses — name-agnostic entry point
 *
 * Input:  { leadId: string, modules: { web: boolean, geo: boolean } }
 * Output: {
 *   webStatus: 'ready'|'missing'|'running'|'queued'|'not_applicable',
 *   geoStatus: same,
 *   hasWebsite: boolean,
 *   used: {
 *     web?: { name: string, payloadType: string },
 *     geo?: { name: string, payloadType: string }
 *   }
 * }
 *
 * Candidates are loaded from analysis_endpoints DB table (name-agnostic).
 * Every attempt is logged to analysis_trigger_logs.
 */
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

    // Verify user
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
    const { leadId, modules = { web: true, geo: true } } = body;

    if (!leadId) throw new Error("leadId required");

    // Verify lead belongs to user's org
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();
    const orgId = profile?.organization_id;
    if (!orgId) throw new Error("No organization");

    const { data: lead } = await supabase
      .from("leads")
      .select("id, website, organization_id")
      .eq("id", leadId)
      .eq("organization_id", orgId)
      .maybeSingle();

    if (!lead) throw new Error("Lead not found or unauthorized");

    const hasWebsite = !!lead.website;

    // 1) Check current DB status
    const { webStatus: currentWeb, geoStatus: currentGeo } = await checkAnalysisState(supabase, leadId);
    console.log(`[ensure-lead-analyses] lead=${leadId} web=${currentWeb} geo=${currentGeo} website=${lead.website}`);

    let finalWebStatus = currentWeb;
    let finalGeoStatus = currentGeo;
    const usedEndpoints: { web?: { name: string; payloadType: string }; geo?: { name: string; payloadType: string } } = {};

    if (!hasWebsite) {
      // No website — analyses not applicable
      finalWebStatus = "not_applicable";
      finalGeoStatus = "not_applicable";
    } else {
      // 2) Trigger missing analyses using name-agnostic adapter
      const triggerPromises: Promise<void>[] = [];

      if (modules.web && currentWeb === "missing") {
        triggerPromises.push(
          triggerAnalysisKind("web", lead, authHeader, supabaseUrl, supabase).then(result => {
            if (result.ok) {
              usedEndpoints.web = { name: result.usedName, payloadType: result.usedPayloadType };
              finalWebStatus = "queued";
            }
            console.log(`[ensure-lead-analyses] web trigger result:`, result);
          }).catch(() => null)
        );
      }

      if (modules.geo && currentGeo === "missing") {
        triggerPromises.push(
          triggerAnalysisKind("geo", lead, authHeader, supabaseUrl, supabase).then(result => {
            if (result.ok) {
              usedEndpoints.geo = { name: result.usedName, payloadType: result.usedPayloadType };
              finalGeoStatus = "queued";
            }
            console.log(`[ensure-lead-analyses] geo trigger result:`, result);
          }).catch(() => null)
        );
      }

      // Wait for triggers (they are fast — fire-and-forget happens inside triggerAnalysisKind)
      await Promise.all(triggerPromises);
    }

    // 3) Update lead_analysis_status table
    await supabase.from("lead_analysis_status").upsert({
      lead_id: leadId,
      organization_id: orgId,
      web_status: finalWebStatus,
      geo_status: finalGeoStatus,
      web_updated_at: new Date().toISOString(),
      geo_updated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "lead_id" });

    return new Response(JSON.stringify({
      webStatus: finalWebStatus,
      geoStatus: finalGeoStatus,
      hasWebsite,
      used: usedEndpoints,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("ensure-lead-analyses error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
