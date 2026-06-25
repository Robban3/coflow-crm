// One-shot-ish backfill of Bolagsverket data (status + business description and
// the other official fields) for existing leads that were enriched before those
// columns existed. Processes a batch per invocation and reports how many remain,
// so the caller can re-invoke until `remaining` is 0. Rate-limited to respect
// Bolagsverket's 60 req/min.
//
// Scope: the caller's organization. Auth: any authenticated org member.

import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { lookupByOrgNumber } from "../_shared/bolagsverket.ts";

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

const BATCH = 40;
const RATE_DELAY_MS = 1100; // ~55 req/min, under the 60/min cap
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

    // Leads in this org that have an org number but no company status yet.
    const { data: leads, error: leadsErr } = await supabase
      .from("leads")
      .select("id, org_number, company_name")
      .eq("organization_id", orgId)
      .not("org_number", "is", null)
      .is("company_status", null)
      .limit(BATCH);
    if (leadsErr) throw leadsErr;

    const queue = (leads ?? []).filter((l: any) => String(l.org_number ?? "").trim());
    let updated = 0;
    const failures: string[] = [];

    for (let i = 0; i < queue.length; i++) {
      const lead = queue[i] as any;
      const orgnr = String(lead.org_number).trim();
      try {
        const result = await lookupByOrgNumber(orgnr);
        if (result.ok && result.normalized) {
          const c = result.normalized;
          const row = {
            org_number: c.org_number || orgnr.replace(/\D/g, ""),
            company_name: c.company_name || lead.company_name || "",
            legal_form: c.legal_form,
            company_form: c.legal_form,
            status: c.status,
            registration_date: c.registration_date,
            address: c.address,
            postal_code: c.postal_code,
            city: c.city,
            sni_codes: c.sni_codes.length ? c.sni_codes.join(", ") : null,
            sni_descriptions: c.sni_descriptions.length ? c.sni_descriptions.join("; ") : null,
            business_description: c.business_description,
          };
          await supabase.from("company_registry").upsert(row, { onConflict: "org_number" });
          // Mark the lead. Use a sentinel so we don't re-fetch endlessly when the
          // API genuinely has no status for an org.
          await supabase.from("leads")
            .update({ company_status: c.status ?? "Okänd" })
            .eq("id", lead.id);
          updated++;
        } else {
          // Not found / error: mark as "Okänd" so it drops out of the queue.
          await supabase.from("leads").update({ company_status: "Okänd" }).eq("id", lead.id);
          failures.push(`${orgnr}: ${result.error ?? "not found"}`);
        }
      } catch (e) {
        failures.push(`${orgnr}: ${(e as Error).message}`);
      }
      if (i < queue.length - 1) await sleep(RATE_DELAY_MS);
    }

    // How many still need processing after this batch.
    const { count: remaining } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("org_number", "is", null)
      .is("company_status", null);

    return new Response(
      JSON.stringify({
        success: true,
        processed: queue.length,
        updated,
        remaining: remaining ?? 0,
        failures: failures.slice(0, 20),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
