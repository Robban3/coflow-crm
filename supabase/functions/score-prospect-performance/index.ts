// Second pass over a prospect list: measure real-world performance with
// Lighthouse and fold it into the opportunity score.
//
// Why this is separate from resolve-prospect-websites: a PSI run takes 10–20s
// per site, so it cannot share a batch size with the markup pass. It is also
// genuinely optional — you run it on a list you have already triaged, not on
// 500 freshly discovered companies, because each run costs quota and time.
//
// Reuses the existing pagespeed-analyze function (which already has a 24h cache
// and a sane failure taxonomy) rather than re-implementing the PSI call, and
// forwards the caller's JWT so its own auth check still applies.

import { createClient } from "npm:@supabase/supabase-js@2";
import { applyPsi, type IssueReason } from "../_shared/opportunity-score.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Small: each item is a 10–20s Lighthouse run, and the platform caps function
// wall-clock. The client loops on `remaining`.
const BATCH_DEFAULT = 4;

type ItemRow = {
  id: string;
  website: string | null;
  score_reasons: IssueReason[] | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, anonKey);
    const { data: userData, error: userErr } = await authClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: profile } = await supabase
      .from("profiles").select("organization_id").eq("id", userData.user.id).maybeSingle();
    const callerOrg = profile?.organization_id ?? null;

    const body = await req.json();
    const { listId, scope, market = "SE", industryKey, limit } = body ?? {};
    if (!callerOrg) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Två lägen mot samma analyslogik: dagens listflöde och den nya poolen.
    // Listvägen måste bete sig exakt som förut — den används dagligen.
    const isPool = scope === "pool";
    const table = isPool ? "lead_pool" : "prospect_list_items";

    if (isPool) {
      // service_role passerar RLS, så admin-kravet på lead_pool måste kollas här.
      const { data: roleRow } = await createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      })
        .from("user_roles").select("role")
        .eq("user_id", userData.user.id).eq("role", "admin").maybeSingle();
      if (!roleRow) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      if (!listId) throw new Error("listId krävs");
      const { data: list } = await supabase
        .from("prospect_lists").select("id, organization_id").eq("id", listId).maybeSingle();
      if (!list) throw new Error("Listan hittades inte");
      if (list.organization_id !== callerOrg) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Avgränsar batchen till rätt läge. Används för både kö och restberäkning.
    const scopeQuery = (q: any) =>
      isPool
        ? (industryKey
            ? q.eq("organization_id", callerOrg).eq("market", market).eq("industry_key", industryKey)
            : q.eq("organization_id", callerOrg).eq("market", market))
        : q.eq("list_id", listId);

    const batchSize = Math.min(Math.max(Number(limit) || BATCH_DEFAULT, 1), 10);

    // Only sites we actually verified — measuring an unverified or missing URL
    // would attribute someone else's performance to this company.
    const { data: items } = await scopeQuery(
      supabase.from(table).select("id, website, score_reasons"),
    )
      .in("website_status", ["linked", "discovered"])
      .not("website", "is", null)
      .is("psi_checked_at", null)
      .limit(batchSize);

    const queue = (items ?? []) as ItemRow[];
    let measured = 0;
    let failed = 0;

    // Sequential on purpose: PSI is rate-limited per key and these runs are slow.
    for (const item of queue) {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/pagespeed-analyze`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ url: item.website, strategy: "mobile" }),
        });

        if (!res.ok) {
          failed += 1;
          await supabase.from(table)
            .update({ psi_checked_at: new Date().toISOString() })
            .eq("id", item.id);
          continue;
        }

        // pagespeed-analyze wraps its payload: { success: true, data: {...} }.
        // Accept the bare shape too, so this keeps working if that ever changes.
        const body = await res.json();
        const psi = body?.data ?? body;

        const performance: number | null =
          typeof psi?.performance_score === "number" ? psi.performance_score : null;

        if (performance == null) {
          console.error(
            `[score-prospect-performance] no performance_score for ${item.website}:`,
            JSON.stringify(body).slice(0, 300),
          );
          failed += 1;
          await supabase.from(table)
            .update({ psi_checked_at: new Date().toISOString() })
            .eq("id", item.id);
          continue;
        }

        const rescored = applyPsi(item.score_reasons ?? [], performance);

        await supabase.from(table).update({
          psi_performance: performance,
          psi_accessibility:
            typeof psi?.accessibility_score === "number" ? psi.accessibility_score : null,
          psi_seo: typeof psi?.seo_score === "number" ? psi.seo_score : null,
          psi_checked_at: new Date().toISOString(),
          opportunity_score: rescored.opportunityScore,
          opportunity_score_version: rescored.scoringVersion,
          main_issue_code: rescored.mainIssueCode,
          score_reasons: rescored.reasons,
          scored_at: new Date().toISOString(),
        }).eq("id", item.id);

        measured += 1;
      } catch (e) {
        console.error(`[score-prospect-performance] item ${item.id}:`, e);
        failed += 1;
        await supabase.from(table)
          .update({ psi_checked_at: new Date().toISOString() })
          .eq("id", item.id);
      }
    }

    const { count: remaining } = await scopeQuery(
      supabase.from(table).select("id", { count: "exact", head: true }),
    )
      .in("website_status", ["linked", "discovered"])
      .not("website", "is", null)
      .is("psi_checked_at", null);

    const left = remaining ?? 0;

    return new Response(
      JSON.stringify({ measured, failed, remaining: left, done: left === 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[score-prospect-performance]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
