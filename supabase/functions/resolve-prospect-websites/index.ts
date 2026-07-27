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

import { createClient } from "npm:@supabase/supabase-js@2";
import { safeFetch, SafeFetchError } from "../_shared/safe-fetch.ts";
import { scoreWebsite, scoreNoWebsite } from "../_shared/opportunity-score.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  // Newer supabase-js sends x-supabase-client-* on every invoke; omitting them
  // fails the preflight with "Request header field ... is not allowed".
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

// Domains cannot contain å/ä/ö, so "Frisörmästar'n" lives at frisormastarn.se.
// Comparing the two without folding diacritics fails for most Swedish company
// names — which is exactly the market this runs against.
function foldDiacritics(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ø/g, "o")
    .replace(/æ/g, "ae")
    .replace(/ß/g, "ss");
}

function normalizeName(name: string): string {
  return foldDiacritics(name.toLowerCase())
    .replace(LEGAL_SUFFIXES, " ")
    .replace(/[^a-z0-9\s]/g, " ")
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

  // Fold the PAGE too, not just the company name — otherwise "frisörmästar" from
  // the name never matches "frisörmästar" on the page once the name has been
  // folded to "frisormastar".
  const text = foldDiacritics(args.html.toLowerCase());
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

  // The <title> is a strong signal — small business sites almost always put the
  // company name there, even when the logo is an image and the body is JS-rendered.
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(args.html)?.[1] ?? "";
  if (title && tokens.length > 0) {
    const t = foldDiacritics(title.toLowerCase());
    const titleHits = tokens.filter((tok) => t.includes(tok));
    if (titleHits.length === tokens.length) {
      score += 0.3;
      matched.push("title_match");
    }
  }

  // Domain echoing the company name. The previous `>= 4` guard silently skipped
  // this for short names — "GRO" never got compared against grohar.se and fell
  // just under the threshold as a result.
  const host = args.finalHost.toLowerCase().replace(/^www\./, "").split(".")[0];
  const compact = normalizeName(args.companyName).replace(/\s/g, "");
  if (host.length >= 3 && compact.length >= 3) {
    const stem = compact.slice(0, Math.min(12, compact.length));
    if (compact.includes(host) || host.includes(stem)) {
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

// Adapter så samma analyslogik kan köras mot prospect_list_items (dagens
// listflöde) och lead_pool (den nya färdiganalyserade poolen). Analysen nedan
// vet inte vilken tabell den skriver till.
type Target = {
  fetchQueue(batch: number): Promise<ItemRow[]>;
  update(id: string, patch: Record<string, unknown>): Promise<void>;
  countRemaining(): Promise<number>;
  onStart?(): Promise<void>;
  onDone?(): Promise<void>;
};

async function processItem(
  target: Target,
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
    await target.update(item.id, {
      website_status: "none_found",
      website_source: null,
      website_confidence: 0,
      website_evidence: { checked_at: new Date().toISOString(), reason: "no_candidate" },
      // No site at all is itself the opportunity — score it as such.
      ...(() => {
        const s = scoreNoWebsite();
        return {
          opportunity_score: s.opportunityScore,
          opportunity_score_version: s.scoringVersion,
          main_issue_code: s.mainIssueCode,
          score_reasons: s.reasons,
        };
      })(),
      scored_at: new Date().toISOString(),
    });
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
      await target.update(item.id, {
        website_status: "verify_failed",
        website_confidence: 0,
        website_evidence: { checked_at: new Date().toISOString(), error: err.code },
      });
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
  });

  const verified = reachable && verification.confidence >= ACCEPT_CONFIDENCE;

  await target.update(item.id, {
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
  });
}

// ── Targets ────────────────────────────────────────────────────────────
// Listläget måste bete sig EXAKT som förut — det används dagligen från
// ProspectListDetailPage. Poolläget är additivt.

function listTarget(supabase: any, listId: string): Target {
  const table = "prospect_list_items";
  return {
    async fetchQueue(batch) {
      const { data } = await supabase.from(table)
        .select("id, company_name, org_number, city, website, website_status")
        .eq("list_id", listId).eq("website_status", "unknown").limit(batch);
      return (data ?? []) as ItemRow[];
    },
    async update(id, patch) {
      await supabase.from(table).update(patch).eq("id", id);
    },
    async countRemaining() {
      const { count } = await supabase.from(table)
        .select("id", { count: "exact", head: true })
        .eq("list_id", listId).eq("website_status", "unknown");
      return count ?? 0;
    },
    async onStart() {
      await supabase.from("prospect_lists")
        .update({ status: "enriching", updated_at: new Date().toISOString() }).eq("id", listId);
    },
    async onDone() {
      await supabase.from("prospect_lists")
        .update({ status: "ready", updated_at: new Date().toISOString() }).eq("id", listId);
    },
  };
}

function poolTarget(
  supabase: any,
  orgId: string,
  market: string,
  industryKey: string | null,
): Target {
  const table = "lead_pool";
  return {
    async fetchQueue(batch) {
      let q = supabase.from(table)
        .select("id, company_name, org_nr, city, website, website_status")
        .eq("organization_id", orgId).eq("market", market)
        .eq("website_status", "unknown").limit(batch);
      if (industryKey) q = q.eq("industry_key", industryKey);
      const { data } = await q;
      // lead_pool kallar kolumnen org_nr, prospect_list_items kallar den
      // org_number. Normaliseras här så analyslogiken slipper veta om det.
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        company_name: r.company_name,
        org_number: r.org_nr,
        city: r.city,
        website: r.website,
        website_status: r.website_status,
      })) as ItemRow[];
    },
    async update(id, patch) {
      await supabase.from(table).update(patch).eq("id", id);
    },
    async countRemaining() {
      let q = supabase.from(table).select("id", { count: "exact", head: true })
        .eq("organization_id", orgId).eq("market", market).eq("website_status", "unknown");
      if (industryKey) q = q.eq("industry_key", industryKey);
      const { count } = await q;
      return count ?? 0;
    },
  };
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
    if (!callerOrg) {
      return new Response(JSON.stringify({ error: "No organization" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { listId, scope, market = "SE", industryKey, limit } = body ?? {};

    let target: Target;

    if (scope === "pool") {
      // Poolen är admin-territorium: RLS tillåter bara admin att skriva, och
      // service_role passerar RLS — så kollen måste göras explicit här.
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
      target = poolTarget(supabase, callerOrg, market, industryKey ?? null);
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
      target = listTarget(supabase, listId);
    }

    const batchSize = Math.min(Math.max(Number(limit) || BATCH_DEFAULT, 1), 50);
    const queue = await target.fetchQueue(batchSize);

    if (queue.length === 0) {
      await target.onDone?.();
      return new Response(JSON.stringify({ processed: 0, remaining: 0, done: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await target.onStart?.();

    const placesKey = Deno.env.get("GOOGLE_PLACES_API_KEY") ?? null;

    // Bounded concurrency — the CRM's other batch paths are strictly sequential
    // with sleeps, which is needlessly slow for independent HTTP work.
    let cursor = 0;
    const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (cursor < queue.length) {
        const item = queue[cursor++];
        try {
          await processItem(target, item, placesKey);
        } catch (e) {
          console.error(`[resolve-prospect-websites] item ${item.id}:`, e);
          await target.update(item.id, {
            website_status: "verify_failed",
            website_evidence: { checked_at: new Date().toISOString(), error: String(e) },
          });
        }
      }
    });
    await Promise.all(workers);

    const left = await target.countRemaining();
    if (left === 0) await target.onDone?.();

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
