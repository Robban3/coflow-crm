// Resolve and verify websites for prospect list items, then score them.
//
// This is the capability the CRM did not have. Every existing analysis path
// (auto-enrich-lead, ensure-lead-analyses, analyze-seo, pagespeed-analyze)
// requires leads.website to already be populated and gives up otherwise
// ("reason: no_website"), so companies without a known site were imported and
// then permanently skipped. Here we go the other way: name + city + org number
// in, verified domain and an explainable opportunity score out.
//
// Verification matters more than discovery. Google Places will happily return a
// websiteUri pointing at a franchise HQ, a Facebook page or an aggregator, so a
// candidate is only accepted once the fetched page actually evidences the
// company. Unverified candidates are stored with their confidence and evidence
// rather than silently trusted.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { safeFetch, SafeFetchError } from "../_shared/safe-fetch.ts";
import { scoreWebsite, SCORING_VERSION } from "../_shared/opportunity-score.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_DEFAULT = 25;
const CONCURRENCY = 4;
const ACCEPT_CONFIDENCE = 0.5;

// Hosts that are never a company's own website.
const NON_SITE_HOSTS = [
  "facebook.com", "instagram.com", "linkedin.com", "x.com", "twitter.com",
  "youtube.com", "tiktok.com", "eniro.se", "hitta.se", "allabolag.se",
  "merinfo.se", "ratsit.se", "bolagsfakta.se", "google.com", "booking.com",
];

const LEGAL_SUFFIXES = /\b(ab|hb|kb|ekonomisk förening|handelsbolag|aktiebolag|kommanditbolag|publ|i konkurs)\b/gi;

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9åäö\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(name: string): string[] {
  return normalizeName(name).split(" ").filter((t) => t.length >= 3);
}

function hostIsNonSite(host: string): boolean {
  const h = host.toLowerCase().replace(/^www\./, "");
  return NON_SITE_HOSTS.some((b) => h === b || h.endsWith("." + b));
}

/**
 * How strongly does this page evidence that it belongs to the company?
 * Combines name-token overlap, org number presence and domain similarity.
 */
function verifyOwnership(args: {
  html: string;
  finalHost: string;
  companyName: string;
  orgNumber: string | null;
}): { confidence: number; matched: string[] } {
  const matched: string[] = [];
  let score = 0;

  const text = args.html.toLowerCase();
  const tokens = nameTokens(args.companyName);

  if (tokens.length > 0) {
    const hits = tokens.filter((t) => text.includes(t));
    const ratio = hits.length / tokens.length;
    if (ratio >= 0.5) {
      score += 0.45 * ratio;
      matched.push(`name_tokens:${hits.length}/${tokens.length}`);
    }
  }

  // Org number on the page is near-conclusive (Swedish sites print it in the footer).
  if (args.orgNumber) {
    const digits = args.orgNumber.replace(/\D/g, "");
    if (digits.length >= 10) {
      const dashed = `${digits.slice(0, 6)}-${digits.slice(6)}`;
      if (text.includes(digits) || text.includes(dashed)) {
        score += 0.45;
        matched.push("org_number");
      }
    }
  }

  // Domain echoing the company name.
  const host = args.finalHost.toLowerCase().replace(/^www\./, "").split(".")[0];
  const compact = normalizeName(args.companyName).replace(/\s/g, "");
  if (host.length >= 4 && compact.length >= 4) {
    if (compact.includes(host) || host.includes(compact.slice(0, Math.min(12, compact.length)))) {
      score += 0.25;
      matched.push("domain_match");
    }
  }

  return { confidence: Math.min(1, Number(score.toFixed(2))), matched };
}

async function findWebsiteViaPlaces(
  apiKey: string,
  companyName: string,
  city: string | null,
): Promise<{ uri: string | null; placeId: string | null }> {
  const textQuery = [companyName, city].filter(Boolean).join(" ");
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "places.id,places.displayName,places.websiteUri",
    },
    body: JSON.stringify({ textQuery, languageCode: "sv", regionCode: "SE", maxResultCount: 3 }),
  });
  if (!res.ok) return { uri: null, placeId: null };

  const json = await res.json();
  const places: any[] = json.places ?? [];
  const wanted = normalizeName(companyName);

  for (const p of places) {
    const uri: string | undefined = p.websiteUri;
    if (!uri) continue;
    try {
      if (hostIsNonSite(new URL(uri).hostname)) continue;
    } catch { continue; }
    // Only accept a Places hit whose own name resembles what we searched for.
    const got = normalizeName(p.displayName?.text ?? "");
    if (got && wanted && (got.includes(wanted) || wanted.includes(got))) {
      return { uri, placeId: p.id ?? null };
    }
  }
  return { uri: null, placeId: null };
}

type ItemRow = {
  id: string;
  company_name: string;
  org_number: string | null;
  city: string | null;
  website: string | null;
  website_status: string;
};

async function processItem(
  supabase: any,
  item: ItemRow,
  placesKey: string | null,
): Promise<void> {
  let candidate = item.website?.trim() || null;
  let source: string = candidate ? "existing" : "unresolved";
  let placeId: string | null = null;

  if (!candidate && placesKey) {
    const found = await findWebsiteViaPlaces(placesKey, item.company_name, item.city);
    candidate = found.uri;
    placeId = found.placeId;
    if (candidate) source = "google_places";
  }

  if (!candidate) {
    await supabase.from("prospect_list_items").update({
      website_status: "none_found",
      website_source: null,
      website_confidence: 0,
      website_evidence: { checked_at: new Date().toISOString(), reason: "no_candidate" },
      // No site at all is itself the opportunity — score it as such.
      opportunity_score: 100,
      opportunity_score_version: SCORING_VERSION,
      main_issue_code: "no_website",
      score_reasons: [{ code: "no_website", label: "Saknar webbplats helt", impact: 100, category: "technical" }],
      scored_at: new Date().toISOString(),
    }).eq("id", item.id);
    return;
  }

  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;

  let html = "";
  let finalUrl: string | null = null;
  let finalHost = "";
  let status: number | null = null;
  let reachable = false;
  let tlsError = false;
  let redirectHops = 0;

  try {
    const res = await safeFetch(candidate, { maxBytes: 1024 * 1024 });
    html = res.body;
    finalUrl = res.finalUrl;
    finalHost = res.finalHost;
    status = res.status;
    reachable = true;
    redirectHops = Math.max(res.redirectChain.length - 1, 0);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err instanceof SafeFetchError && (err.code === "blocked_host" || err.code === "blocked_ip")) {
      // A prospect "website" pointing at a private address is not a real site.
      await supabase.from("prospect_list_items").update({
        website_status: "verify_failed",
        website_confidence: 0,
        website_evidence: { checked_at: new Date().toISOString(), error: err.code },
      }).eq("id", item.id);
      return;
    }
    tlsError = /certificate|tls|ssl|handshake/i.test(msg);
  }

  const verification = reachable
    ? verifyOwnership({ html, finalHost, companyName: item.company_name, orgNumber: item.org_number })
    : { confidence: 0, matched: [] as string[] };

  const scored = scoreWebsite({
    html: reachable ? html : null,
    finalUrl,
    status,
    reachable,
    tlsError,
    httpsAvailable: finalUrl ? finalUrl.startsWith("https://") : false,
    redirectHops,
  });

  const verified = reachable && verification.confidence >= ACCEPT_CONFIDENCE;

  await supabase.from("prospect_list_items").update({
    website: verified ? finalUrl : candidate,
    website_status: !reachable
      ? "verify_failed"
      : verified
        ? (source === "existing" ? "linked" : "discovered")
        : "verify_failed",
    website_source: source,
    website_confidence: verification.confidence,
    website_evidence: {
      checked_at: new Date().toISOString(),
      candidate,
      final_url: finalUrl,
      status,
      matched: verification.matched,
      place_id: placeId,
      reachable,
    },
    opportunity_score: scored.opportunityScore,
    opportunity_score_version: scored.scoringVersion,
    main_issue_code: scored.mainIssueCode,
    score_reasons: scored.reasons,
    scored_at: new Date().toISOString(),
  }).eq("id", item.id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Auth: real user token + organisation match. Note that verify_jwt alone is
    // not enough — the public anon key is itself a signed JWT.
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

    const { listId, limit } = await req.json();
    if (!listId) throw new Error("listId krävs");

    const { data: list } = await supabase
      .from("prospect_lists").select("id, organization_id").eq("id", listId).maybeSingle();
    if (!list) throw new Error("Listan hittades inte");
    if (!callerOrg || list.organization_id !== callerOrg) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const batchSize = Math.min(Math.max(Number(limit) || BATCH_DEFAULT, 1), 50);

    const { data: items } = await supabase
      .from("prospect_list_items")
      .select("id, company_name, org_number, city, website, website_status")
      .eq("list_id", listId)
      .eq("website_status", "unknown")
      .limit(batchSize);

    const queue = (items ?? []) as ItemRow[];
    if (queue.length === 0) {
      await supabase.from("prospect_lists")
        .update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", listId);
      return new Response(JSON.stringify({ processed: 0, remaining: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase.from("prospect_lists")
      .update({ status: "enriching", updated_at: new Date().toISOString() }).eq("id", listId);

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? null;

    // Bounded concurrency — the CRM's other batch paths are strictly sequential
    // with sleeps, which is needlessly slow for independent HTTP work.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        try {
          await processItem(supabase, item, placesKey);
        } catch (e) {
          console.error(`[resolve-prospect-websites] item ${item.id}:`, e);
          await supabase.from("prospect_list_items").update({
            website_status: "verify_failed",
            website_evidence: { checked_at: new Date().toISOString(), error: String(e) },
          }).eq("id", item.id);
        }
      }
    });
    await Promise.all(workers);

    const { count: remaining } = await supabase
      .from("prospect_list_items")
      .select("id", { count: "exact", head: true })
      .eq("list_id", listId)
      .eq("website_status", "unknown");

    const left = remaining ?? 0;
    if (left === 0) {
      await supabase.from("prospect_lists")
        .update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", listId);
    }

    return new Response(
      JSON.stringify({ processed: queue.length, remaining: left, done: left === 0 }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[resolve-prospect-websites]", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
