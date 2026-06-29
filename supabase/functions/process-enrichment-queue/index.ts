import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json().catch(() => ({}));
    const organizationId = body.organization_id;
    let callerUserId = body.user_id || null;

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (token !== serviceRoleKey) {
      const authClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!profile?.organization_id || profile.organization_id !== organizationId) {
        return new Response(
          JSON.stringify({ error: "Forbidden" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      callerUserId = user.id;
    }

    console.log("[process-enrichment-queue] Starting for org:", organizationId);

    // Fetch up to 10 pending leads with explicit filters
    const { data: pendingLeads, error } = await supabase
      .from("leads")
      .select("id, company_name, website, enrichment_status, created_at, created_by, assigned_to")
      .eq("organization_id", organizationId)
      .eq("enrichment_status", "pending")
      .eq("imported_via_prospecting", true)
      .order("created_at", { ascending: true })
      .limit(10);

    if (error) {
      console.error("[process-enrichment-queue] Query error:", error);
      throw new Error(`Query error: ${error.message}`);
    }

    console.log("[process-enrichment-queue] Queue query result:", pendingLeads?.length ?? 0, "leads found");

    if (!pendingLeads || pendingLeads.length === 0) {
      return new Response(
        JSON.stringify({ processed: 0, failed: 0, skipped: 0, lead_ids: [], errors: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const processedLeadIds: string[] = [];
    const errors: { lead_id: string; error: string }[] = [];
    let processedCount = 0;
    let failedCount = 0;

    for (const lead of pendingLeads) {
      console.log("[process-enrichment-queue] Processing lead:", lead.id, lead.company_name, lead.website);

      // Mark as processing immediately
      const { error: updateErr } = await supabase
        .from("leads")
        .update({ enrichment_status: "processing", enrichment_started_at: new Date().toISOString() })
        .eq("id", lead.id);

      if (updateErr) {
        console.error("[process-enrichment-queue] Failed to mark processing:", lead.id, updateErr);
      }

      try {
        console.log("[process-enrichment-queue] Calling auto-enrich-lead for", lead.id);

        const enrichRes = await fetch(
          `${Deno.env.get("SUPABASE_URL")}/functions/v1/auto-enrich-lead`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            // Light mode: enrich cheap company data + draft only. The heavy web
            // analysis (Firecrawl scrape + PageSpeed) is deferred and run on
            // demand from the lead view — so imports stay fast, reliable and
            // don't burn Firecrawl credits on every lead.
            body: JSON.stringify({ lead_id: lead.id, user_id: callerUserId, light: true }),
          },
        );

        if (!enrichRes.ok) {
          const errorText = await enrichRes.text();
          console.error("[process-enrichment-queue] auto-enrich-lead failed for", lead.id, errorText);
          console.log("[process-enrichment-queue] Using fallback enrichment for", lead.id);

          // === FALLBACK ENRICHMENT ===
          // No website scrape here: the hybrid flow keeps imports credit-free,
          // so the fallback only produces a company-data draft. The full web
          // analysis is run on demand from the lead view.
          try {
            const aiSummary = `Företag: ${lead.company_name || 'Okänt'}`;

            // Step b: Generate outreach draft via the same flow as "Regenerera"
            console.log("[process-enrichment-queue] Fallback: generating outreach for", lead.id);
            let draftSubject = `Hej från oss – ${lead.company_name || "ert företag"}`;
            let draftBody = `Hej!\n\nVi har tittat på ${lead.company_name || "ert företag"}${lead.website ? ` (${lead.website})` : ""} och ser potential att hjälpa er växa online.\n\nVi skulle gärna visa hur – kan vi boka ett kort samtal?\n\nMed vänlig hälsning`;
            const draftSummary = aiSummary.substring(0, 300);

            try {
              let generationUserId = callerUserId || lead.created_by || lead.assigned_to || null;

              if (!generationUserId) {
                const { data: anyOrgUser } = await supabase
                  .from("profiles")
                  .select("id")
                  .eq("organization_id", organizationId)
                  .limit(1)
                  .single();
                generationUserId = anyOrgUser?.id || null;
              }

              if (generationUserId) {
                const outreachRes = await fetch(
                  `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-outreach-email`,
                  {
                    method: "POST",
                    headers: {
                      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      leadId: lead.id,
                      stepNumber: 1,
                      totalSteps: 1,
                      userId: generationUserId,
                    }),
                  },
                );

                if (outreachRes.ok) {
                  const outreachData = await outreachRes.json();
                  if (outreachData?.subject) draftSubject = outreachData.subject;
                  if (outreachData?.body_without_signature) {
                    draftBody = outreachData.body_without_signature;
                  } else if (outreachData?.body) {
                    draftBody = outreachData.body;
                  }
                  console.log("[process-enrichment-queue] Fallback: AI outreach generated for", lead.id);
                } else {
                  const errorBody = await outreachRes.text();
                  console.warn("[process-enrichment-queue] Fallback: generate-outreach-email failed for", lead.id, outreachRes.status, errorBody);
                }
              } else {
                console.warn("[process-enrichment-queue] Fallback: no user available for outreach generation", lead.id);
              }
            } catch (outreachErr) {
              console.warn("[process-enrichment-queue] Fallback: outreach generation exception for", lead.id, outreachErr);
            }

            // Step c: Insert prospecting draft
            const { error: draftErr } = await supabase.from("prospecting_drafts").insert({
              organization_id: organizationId,
              lead_id: lead.id,
              subject: draftSubject,
              body: draftBody,
              ai_summary: draftSummary,
              ai_confidence: 70,
              status: "draft",
            });
            if (draftErr) {
              console.error("[process-enrichment-queue] Fallback: draft insert failed for", lead.id, draftErr);
            }

            // Step d: Mark lead as ready
            await supabase.from("leads").update({
              enrichment_status: "ready",
              auto_draft_generated: true,
              enrichment_completed_at: new Date().toISOString(),
              enrichment_error: null,
            }).eq("id", lead.id);

            console.log("[process-enrichment-queue] Fallback enrichment completed for", lead.id);
            processedLeadIds.push(lead.id);
            processedCount++;
            continue;
          } catch (fallbackErr) {
            // Step 2: Even fallback failed
            const fallbackErrMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
            console.error("[process-enrichment-queue] Fallback also failed for", lead.id, fallbackErrMsg);
            await supabase.from("leads").update({
              enrichment_status: "failed",
              enrichment_error: `Both primary and fallback enrichment failed: ${fallbackErrMsg}`.substring(0, 500),
            }).eq("id", lead.id);
            errors.push({ lead_id: lead.id, error: `Fallback failed: ${fallbackErrMsg}`.substring(0, 200) });
            failedCount++;
            continue;
          }
        }

        const enrichData = await enrichRes.json().catch(() => ({}));
        console.log("[process-enrichment-queue] Enrichment result for", lead.id, ":", enrichData.status || "unknown");

        processedLeadIds.push(lead.id);
        processedCount++;
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        console.error("[process-enrichment-queue] Exception for lead", lead.id, ":", errMsg);
        await supabase
          .from("leads")
          .update({ enrichment_status: "failed", enrichment_error: errMsg.substring(0, 500) })
          .eq("id", lead.id);
        errors.push({ lead_id: lead.id, error: errMsg.substring(0, 200) });
        failedCount++;
      }

      // 2 second delay between calls (except after last)
      if (lead !== pendingLeads[pendingLeads.length - 1]) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }

    const skipped = pendingLeads.length - processedCount - failedCount;

    console.log("[process-enrichment-queue] Done. Processed:", processedCount, "Failed:", failedCount, "Skipped:", skipped);

    return new Response(
      JSON.stringify({ processed: processedCount, failed: failedCount, skipped, lead_ids: processedLeadIds, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[process-enrichment-queue] FATAL:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
