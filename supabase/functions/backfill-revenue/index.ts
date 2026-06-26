// Refresh omsättning (revenue + fiscal year) for the caller's org. Targets
// company_registry rows — joined to this org's leads via org_number — that are
// missing revenue_year (older enrichments stored the figure before the year was
// captured, or before the year-extraction fix). Re-runs the allabolag lookup and
// writes revenue + revenue_year. Processes one batch per invocation and reports
// how many remain, so the caller re-invokes until `remaining` is 0.
//
// Scope: the caller's organization. Auth: any authenticated org member.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { findRevenueByName } from "../_shared/revenue-lookup.ts";

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

const BATCH = 30;
const RATE_DELAY_MS = 400; // gentle on Firecrawl
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = supabaseAdmin();

    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userId).maybeSingle();
    const orgId = profile?.organization_id as string | null;
    if (!orgId) {
      return new Response(JSON.stringify({ success: false, error: "No organization" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Org numbers used by this org's leads.
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("org_number, company_name")
      .eq("organization_id", orgId)
      .not("org_number", "is", null);
    if (leadsErr) throw leadsErr;

    const orgNumbers = [...new Set(
      (leads ?? [])
        .map((l: any) => String(l.org_number ?? "").replace(/\D/g, ""))
        .filter((n: string) => n.length >= 10),
    )];
    if (!orgNumbers.length) {
      return new Response(JSON.stringify({ success: true, processed: 0, updated: 0, remaining: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Registry rows for those orgs that have a revenue figure but no fiscal year
    // (the figure was stored before the year was captured / before the fix).
    const { data: rows, error: rowsErr } = await supabase
      .from("company_registry")
      .select("org_number, company_name, city")
      .in("org_number", orgNumbers)
      .not("revenue", "is", null)
      .is("revenue_year", null)
      .limit(BATCH);
    if (rowsErr) throw rowsErr;

    const queue = rows ?? [];
    let updated = 0;

    for (let i = 0; i < queue.length; i++) {
      const row = queue[i] as any;
      try {
        const rev = await findRevenueByName(row.company_name || "", row.city);
        if (rev && (rev.revenue || rev.year)) {
          await supabase.from("company_registry")
            .update({ revenue: rev.revenue ?? null, revenue_year: rev.year ?? null })
            .eq("org_number", row.org_number);
          if (rev.year) updated++;
        }
      } catch (_e) {
        // best-effort; skip on failure
      }
      if (i < queue.length - 1) await sleep(RATE_DELAY_MS);
    }

    // How many registry rows for this org still have a figure but no year.
    const { count: remaining } = await supabase
      .from("company_registry")
      .select("org_number", { count: "exact", head: true })
      .in("org_number", orgNumbers)
      .not("revenue", "is", null)
      .is("revenue_year", null);

    return new Response(
      JSON.stringify({
        success: true,
        processed: queue.length,
        updated,
        remaining: remaining ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
