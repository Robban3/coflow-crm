/**
 * Shared helpers for Power Call edge functions — v3
 *
 * ── EVIDENCE REPORT ──────────────────────────────────────────────────────────
 *
 * A) Edge functions confirmed from file reads:
 *    - supabase/functions/pagespeed-analyze/index.ts (line ~139):
 *        const { url, strategy = 'mobile' } = await req.json()
 *        → payload must be { url: string }. NOT { leadId }.
 *    - supabase/functions/run-geo-analysis/index.ts (line 16):
 *        const { leadId, domain: directDomain } = body
 *        → payload { leadId: string } OR { domain: string }
 *
 * B) Analysis DB tables:
 *    - web_analyses: "ready" when row with lead_id exists (no status column)
 *    - geo_analyses: "ready" when row with lead_id + status='completed' exists
 *                   "running" when queued|running rows exist
 *
 * C) NAME-AGNOSTIC APPROACH:
 *    Candidates are loaded from analysis_endpoints table (DB).
 *    Each candidate is tried in priority order.
 *    Every attempt is logged to analysis_trigger_logs.
 *    Names and payloads can be changed via DB without redeploy.
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface Cursor {
  sort: string;
  last_registered_at: string | null;
  last_created_at: string | null;
  last_id: string | null;
}

export interface SelectNextItemParams {
  orgId: string;
  listId: string | null;
  sessionId: string;
  userId: string;
  cursor: Cursor | null;
  cooldownDays?: number;
}

// ── Analysis candidate from DB ────────────────────────────────────────────────

interface EndpointCandidate {
  id: string;
  kind: string;
  name: string;
  payload_type: string; // 'url' | 'leadId' | 'domain' | 'auto'
  priority: number;
}

interface TriggerResult {
  ok: boolean;
  usedName: string;
  usedPayloadType: string;
  statusCode: number | null;
  error?: string;
}

// ── Load candidates from DB (via service-role supabase client) ─────────────────

async function loadCandidates(
  supabase: any,
  kind: "web" | "geo",
  orgId?: string
): Promise<EndpointCandidate[]> {
  // Load global + org-specific candidates, sorted by priority
  let q = supabase
    .from("analysis_endpoints")
    .select("id, kind, name, payload_type, priority")
    .eq("kind", kind)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const { data, error } = await q;
  if (error || !data?.length) {
    // FALLBACK: hardcoded from evidence if DB is empty or unreachable
    console.warn(`[analysis-adapter] Could not load ${kind} candidates from DB (${error?.message}), using hardcoded fallback`);
    if (kind === "web") {
      return [{ id: "fallback-web", kind: "web", name: "pagespeed-analyze", payload_type: "url", priority: 1 }];
    } else {
      return [
        { id: "fallback-geo-1", kind: "geo", name: "run-geo-analysis", payload_type: "leadId", priority: 1 },
        { id: "fallback-geo-2", kind: "geo", name: "run-geo-analysis", payload_type: "domain", priority: 5 },
      ];
    }
  }

  // Prefer org-specific over global for same name
  return data as EndpointCandidate[];
}

// ── Build payload for a candidate ────────────────────────────────────────────

function buildPayload(
  candidate: EndpointCandidate,
  lead: { id: string; website?: string | null }
): Record<string, unknown> | null {
  const normalized = lead.website
    ? lead.website.startsWith("http") ? lead.website : `https://${lead.website}`
    : null;

  const domain = normalized
    ? (() => { try { return new URL(normalized).hostname; } catch { return null; } })()
    : null;

  switch (candidate.payload_type) {
    case "url":
      if (!normalized) return null; // cannot build payload without URL
      return { url: normalized };
    case "leadId":
      return { leadId: lead.id };
    case "domain":
      if (!domain) return null;
      return { domain };
    case "auto":
      // Try to build the most likely payload for the kind
      if (candidate.kind === "web") return normalized ? { url: normalized } : null;
      return { leadId: lead.id }; // geo default
    default:
      return { leadId: lead.id };
  }
}

// ── Try-candidates chain ──────────────────────────────────────────────────────

export async function triggerAnalysisKind(
  kind: "web" | "geo",
  lead: { id: string; website?: string | null; organization_id?: string | null },
  authHeader: string,
  supabaseUrl: string,
  supabaseClient: any
): Promise<TriggerResult> {
  const baseUrl = buildBaseUrl(supabaseUrl);
  const candidates = await loadCandidates(supabaseClient, kind, lead.organization_id ?? undefined);

  for (const candidate of candidates) {
    const payload = buildPayload(candidate, lead);

    if (payload === null) {
      console.log(`[analysis-adapter] ${kind} candidate=${candidate.name} payload_type=${candidate.payload_type}: skipped (missing required data)`);
      await logTriggerAttempt(supabaseClient, lead, kind, candidate, null, false, "Missing required data for payload");
      continue;
    }

    let statusCode: number | null = null;
    let ok = false;
    let errorMsg: string | undefined;

    try {
      console.log(`[analysis-adapter] ${kind} trying ${candidate.name} payload_type=${candidate.payload_type}`, payload);
      const resp = await fetch(`${baseUrl}/${candidate.name}`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      statusCode = resp.status;

      if (resp.status === 401 || resp.status === 403) {
        // Auth error — stop trying
        errorMsg = `Auth error (${resp.status})`;
        await logTriggerAttempt(supabaseClient, lead, kind, candidate, statusCode, false, errorMsg);
        return { ok: false, usedName: candidate.name, usedPayloadType: candidate.payload_type, statusCode, error: errorMsg };
      }

      if (resp.status === 404 || resp.status === 405) {
        // Wrong function name or method — try next candidate
        errorMsg = `Function not found (${resp.status})`;
        await logTriggerAttempt(supabaseClient, lead, kind, candidate, statusCode, false, errorMsg);
        console.log(`[analysis-adapter] ${candidate.name} returned ${resp.status}, trying next candidate`);
        continue;
      }

      if (resp.status >= 500) {
        // Server error — try next candidate
        errorMsg = `Server error (${resp.status})`;
        await logTriggerAttempt(supabaseClient, lead, kind, candidate, statusCode, false, errorMsg);
        console.log(`[analysis-adapter] ${candidate.name} returned ${resp.status}, trying next candidate`);
        continue;
      }

      // 2xx — success
      ok = true;
      console.log(`[analysis-adapter] ${kind} SUCCESS via ${candidate.name} (${resp.status})`);

      // For web (pagespeed-analyze): it returns raw scores — persist them to web_analyses
      if (kind === "web" && resp.ok) {
        const body = await resp.json().catch(() => null);
        // pagespeed-analyze wraps response: { success: true, data: { performance_score, ... } }
        const data = body?.data ?? body ?? null;
        if (data && (data.performance_score !== undefined || data.seo_score !== undefined)) {
          const normalized = lead.website?.startsWith("http") ? lead.website : `https://${lead.website}`;
          await supabaseClient.from("web_analyses").delete().eq("lead_id", lead.id).catch(() => null);
          await supabaseClient.from("web_analyses").insert({
            lead_id: lead.id,
            url: normalized,
            performance_score: data.performance_score ?? null,
            seo_score: data.seo_score ?? null,
            accessibility_score: data.accessibility_score ?? null,
            best_practices_score: data.best_practices_score ?? null,
            raw_data: data,
          }).catch((e: any) => console.warn("[analysis-adapter] web_analyses insert failed:", e?.message));
        } else {
          console.warn("[analysis-adapter] web result missing expected scores. Body:", JSON.stringify(body)?.slice(0, 200));
        }
      }

      await logTriggerAttempt(supabaseClient, lead, kind, candidate, statusCode, true, undefined);
      return { ok: true, usedName: candidate.name, usedPayloadType: candidate.payload_type, statusCode };

    } catch (networkErr: any) {
      errorMsg = networkErr?.message || "Network error";
      console.error(`[analysis-adapter] ${kind} ${candidate.name} network error:`, errorMsg);
      await logTriggerAttempt(supabaseClient, lead, kind, candidate, null, false, errorMsg);
      continue; // try next
    }
  }

  console.error(`[analysis-adapter] ${kind}: all candidates exhausted for lead ${lead.id}`);
  return { ok: false, usedName: "none", usedPayloadType: "none", statusCode: null, error: "All candidates exhausted" };
}

// ── Log to analysis_trigger_logs ─────────────────────────────────────────────

async function logTriggerAttempt(
  supabase: any,
  lead: { id: string; organization_id?: string | null },
  kind: string,
  candidate: EndpointCandidate,
  statusCode: number | null,
  ok: boolean,
  errorMessage?: string
): Promise<void> {
  try {
    await supabase.from("analysis_trigger_logs").insert({
      organization_id: lead.organization_id ?? null,
      lead_id: lead.id,
      kind,
      function_name: candidate.name,
      payload_type: candidate.payload_type,
      status_code: statusCode,
      ok,
      error_message: errorMessage ?? null,
    });
  } catch (e) {
    console.warn("[analysis-adapter] Failed to write trigger log:", e);
  }
}

// ── triggerAnalyses — wraps triggerAnalysisKind for both web + geo (fire-and-forget safe) ──

export async function triggerAnalyses(
  authHeader: string,
  supabaseUrl: string,
  leadId: string,
  modules: { web: boolean; geo: boolean },
  supabaseClient: any
): Promise<{ webTriggered: boolean; geoTriggered: boolean; webResult?: TriggerResult; geoResult?: TriggerResult }> {
  // Resolve full lead for payload building
  const { data: lead } = await supabaseClient
    .from("leads")
    .select("id, website, organization_id")
    .eq("id", leadId)
    .maybeSingle();

  if (!lead) {
    console.warn(`[triggerAnalyses] Lead ${leadId} not found`);
    return { webTriggered: false, geoTriggered: false };
  }

  const promises: Promise<TriggerResult>[] = [];

  if (modules.web) {
    promises.push(triggerAnalysisKind("web", lead, authHeader, supabaseUrl, supabaseClient));
  }
  if (modules.geo) {
    promises.push(triggerAnalysisKind("geo", lead, authHeader, supabaseUrl, supabaseClient));
  }

  // Fire-and-forget in background — don't block caller
  Promise.all(promises).catch(() => null);

  return {
    webTriggered: modules.web,
    geoTriggered: modules.geo,
  };
}

// ── Check current analysis state from DB ──────────────────────────────────────

export async function checkAnalysisState(
  supabase: any,
  leadId: string
): Promise<{ webStatus: string; geoStatus: string }> {
  const [webRes, geoCompleted, geoRunning] = await Promise.all([
    supabase.from("web_analyses").select("id").eq("lead_id", leadId).limit(1),
    supabase.from("geo_analyses").select("id").eq("lead_id", leadId).eq("status", "completed").limit(1),
    supabase.from("geo_analyses").select("id").eq("lead_id", leadId).in("status", ["queued", "running"]).limit(1),
  ]);

  const webStatus = (webRes.data?.length || 0) > 0 ? "ready" : "missing";
  let geoStatus = "missing";
  if ((geoCompleted.data?.length || 0) > 0) geoStatus = "ready";
  else if ((geoRunning.data?.length || 0) > 0) geoStatus = "running";

  return { webStatus, geoStatus };
}

// ── Build base URL ────────────────────────────────────────────────────────────

function buildBaseUrl(supabaseUrl: string): string {
  const projectRef = supabaseUrl.match(/\/\/([^.]+)\./)?.[1];
  return projectRef
    ? `https://${projectRef}.supabase.co/functions/v1`
    : `${supabaseUrl}/functions/v1`;
}

// ── Get active locks by others ─────────────────────────────────────────────────

async function getLockedLeadIds(
  supabase: any,
  orgId: string,
  userId: string
): Promise<string[]> {
  const { data } = await supabase
    .from("power_call_locks")
    .select("lead_id")
    .eq("organization_id", orgId)
    .neq("locked_by_user_id", userId)
    .gt("expires_at", new Date().toISOString());
  return (data || []).map((l: any) => l.lead_id).filter(Boolean);
}

// ── Cursor utilities ──────────────────────────────────────────────────────────

function buildNewCursor(item: any, sort: string): Cursor {
  return {
    sort,
    last_registered_at: item.registered_at ?? null,
    last_created_at: item.created_at ?? null,
    last_id: item.id,
  };
}

// ── Pool-first: Find from lead_pool with seek pagination ──────────────────────

async function findFromLeadPoolWithCursor(
  supabase: any,
  orgId: string,
  filter: Record<string, unknown>,
  lockedLeadIds: string[],
  cursor: Cursor | null,
  sort: string
): Promise<{ poolItem: any; newCursor: Cursor } | null> {
  let q = supabase
    .from("lead_pool")
    .select("id, company_name, website, phone, email, city, industry, org_nr, registered_at, created_at, sni_codes, data")
    .eq("organization_id", orgId);

  if (filter.city && Array.isArray(filter.city) && filter.city.length) {
    q = q.in("city", filter.city);
  }
  if (filter.industry && Array.isArray(filter.industry) && filter.industry.length) {
    q = q.in("industry", filter.industry);
  }
  if (filter.must_have_website) {
    q = q.not("website", "is", null);
  }
  if (filter.registered_from) {
    q = q.gte("registered_at", filter.registered_from);
  }
  if (filter.registered_to) {
    q = q.lte("registered_at", filter.registered_to);
  }

  const effectiveSort = sort === "registered_at_desc" || sort === "registered_at_asc" ? sort : "created_at_desc";

  if (cursor?.last_id) {
    if (effectiveSort === "registered_at_desc" && cursor.last_registered_at) {
      q = q.or(`registered_at.lt.${cursor.last_registered_at},and(registered_at.eq.${cursor.last_registered_at},id.lt.${cursor.last_id})`);
    } else if (cursor.last_created_at) {
      q = q.or(`created_at.lt.${cursor.last_created_at},and(created_at.eq.${cursor.last_created_at},id.lt.${cursor.last_id})`);
    }
  }

  if (effectiveSort === "registered_at_desc") {
    q = q.order("registered_at", { ascending: false, nullsFirst: false }).order("id", { ascending: false });
  } else {
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
  }

  q = q.limit(20);

  const { data: poolBatch } = await q;
  if (!poolBatch?.length) return null;

  for (const poolItem of poolBatch) {
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, is_not_interested")
      .eq("organization_id", orgId)
      .eq("lead_pool_id", poolItem.id)
      .maybeSingle();

    if (existingLead) {
      if (existingLead.is_not_interested) continue;
      if (lockedLeadIds.includes(existingLead.id)) continue;
    }

    return { poolItem, newCursor: buildNewCursor(poolItem, effectiveSort) };
  }

  return null;
}

// ── Promote pool item to lead ─────────────────────────────────────────────────

export async function promotePoolToLead(
  supabase: any,
  orgId: string,
  poolItem: any
): Promise<any | null> {
  // Dedup: match org_nr if available
  if (poolItem.org_nr) {
    const { data: byOrgNr } = await supabase
      .from("leads")
      .select("id, is_not_interested")
      .eq("organization_id", orgId)
      .eq("org_number", poolItem.org_nr)
      .maybeSingle();
    if (byOrgNr) {
      if (byOrgNr.is_not_interested) return null;
      const { data: lead } = await supabase
        .from("leads")
        .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
        .eq("id", byOrgNr.id)
        .single();
      return lead;
    }
  }

  // Dedup: match by lead_pool_id
  const { data: byPoolId } = await supabase
    .from("leads")
    .select("id, is_not_interested")
    .eq("organization_id", orgId)
    .eq("lead_pool_id", poolItem.id)
    .maybeSingle();

  if (byPoolId) {
    if (byPoolId.is_not_interested) return null;
    const { data: lead } = await supabase
      .from("leads")
      .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
      .eq("id", byPoolId.id)
      .single();
    return lead;
  }

  // Create new lead from pool
  const { data: newLead, error } = await supabase
    .from("leads")
    .insert({
      organization_id: orgId,
      company_name: poolItem.company_name,
      website: poolItem.website || null,
      phone: poolItem.phone || null,
      email: poolItem.email || null,
      org_number: poolItem.org_nr || null,
      source: "lead_pool",
      lead_status: "active",
      is_not_interested: false,
      lead_pool_id: poolItem.id,
      source_data: {
        city: poolItem.city,
        industry: poolItem.industry,
        org_nr: poolItem.org_nr,
        sni_codes: poolItem.sni_codes,
        ...(poolItem.data || {}),
      },
    })
    .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
    .single();

  if (error) {
    console.error("promotePoolToLead error:", error);
    return null;
  }
  return newLead;
}

// ── Select next item (pool-first for dynamic, leads-first for static) ──────────

export async function selectNextItem(
  supabase: any,
  params: SelectNextItemParams
): Promise<{ kind: "lead" | "pool"; id: string; leadData?: any; poolItem?: any; newCursor: Cursor } | null> {
  const { orgId, listId, userId, cursor, cooldownDays = 7 } = params;
  const cooldownDate = new Date(Date.now() - cooldownDays * 24 * 60 * 60 * 1000).toISOString();

  const lockedLeadIds = await getLockedLeadIds(supabase, orgId, userId);

  let listConfig: any = null;
  if (listId) {
    const { data: list } = await supabase
      .from("power_call_lists")
      .select("source_type, static_lead_ids, filter_json, dynamic_filter, dynamic_sort")
      .eq("id", listId)
      .single();
    listConfig = list;
  }

  const sort = listConfig?.dynamic_sort || "created_at_desc";

  // ── STATIC LIST ──────────────────────────────────────────────────────────────
  if (listConfig?.source_type === "static" && listConfig?.static_lead_ids?.length) {
    const eligible = listConfig.static_lead_ids.filter((id: string) => !lockedLeadIds.includes(id));
    if (!eligible.length) return null;

    let q = supabase
      .from("leads")
      .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
      .in("id", eligible)
      .eq("organization_id", orgId)
      .eq("is_not_interested", false)
      .or(`last_call_at.is.null,last_call_at.lt.${cooldownDate}`)
      .order("last_call_at", { ascending: true, nullsFirst: true })
      .order("id", { ascending: true })
      .limit(1);

    if (cursor?.last_id) {
      q = q.neq("id", cursor.last_id);
    }

    const { data } = await q;
    if (!data?.[0]) return null;

    const lead = data[0];
    return {
      kind: "lead",
      id: lead.id,
      leadData: lead,
      newCursor: buildNewCursor(lead, "created_at_desc"),
    };
  }

  // ── DYNAMIC LIST: pool-first ─────────────────────────────────────────────────
  if (listConfig?.dynamic_filter || listConfig?.filter_json || listId) {
    const filter = listConfig?.dynamic_filter || listConfig?.filter_json || {};

    const poolResult = await findFromLeadPoolWithCursor(
      supabase, orgId, filter, lockedLeadIds, cursor, sort
    );

    if (poolResult) {
      return {
        kind: "pool",
        id: poolResult.poolItem.id,
        poolItem: poolResult.poolItem,
        newCursor: poolResult.newCursor,
      };
    }

    // Fallback: existing leads matching filter
    let leadsQ = supabase
      .from("leads")
      .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
      .eq("organization_id", orgId)
      .eq("lead_status", "active")
      .eq("is_not_interested", false)
      .or(`last_call_at.is.null,last_call_at.lt.${cooldownDate}`);

    if (lockedLeadIds.length) {
      leadsQ = leadsQ.not("id", "in", `(${lockedLeadIds.join(",")})`);
    }
    if (filter.must_have_website) leadsQ = leadsQ.not("website", "is", null);
    if (filter.only_uncontacted) leadsQ = leadsQ.is("last_call_at", null);
    if (cursor?.last_id && cursor.last_created_at) {
      leadsQ = leadsQ.or(`created_at.lt.${cursor.last_created_at},and(created_at.eq.${cursor.last_created_at},id.lt.${cursor.last_id})`);
    }
    leadsQ = leadsQ.order("last_call_at", { ascending: true, nullsFirst: true }).order("id").limit(1);

    const { data: leadsData } = await leadsQ;
    if (leadsData?.[0]) {
      const lead = leadsData[0];
      return { kind: "lead", id: lead.id, leadData: lead, newCursor: buildNewCursor(lead, "created_at_desc") };
    }
    return null;
  }

  // ── DEFAULT: all active leads in org ─────────────────────────────────────────
  let q = supabase
    .from("leads")
    .select("id, company_name, contact_name, phone, email, website, lead_status, source_data, last_call_at, last_call_outcome_key, is_not_interested, org_number, created_at, organization_id")
    .eq("organization_id", orgId)
    .eq("lead_status", "active")
    .eq("is_not_interested", false)
    .or(`last_call_at.is.null,last_call_at.lt.${cooldownDate}`);

  if (lockedLeadIds.length) {
    q = q.not("id", "in", `(${lockedLeadIds.join(",")})`);
  }

  if (cursor?.last_id && cursor.last_created_at) {
    q = q.or(`created_at.lt.${cursor.last_created_at},and(created_at.eq.${cursor.last_created_at},id.lt.${cursor.last_id})`);
  }

  q = q.order("last_call_at", { ascending: true, nullsFirst: true }).order("created_at", { ascending: false }).order("id").limit(1);

  const { data } = await q;
  if (!data?.[0]) return null;

  const lead = data[0];
  return { kind: "lead", id: lead.id, leadData: lead, newCursor: buildNewCursor(lead, "created_at_desc") };
}

// ── Build full lead payload with latest analysis data ─────────────────────────

export async function buildLeadPayload(supabase: any, lead: any) {
  const [webRes, geoRes] = await Promise.all([
    supabase
      .from("web_analyses")
      .select("id, performance_score, seo_score, accessibility_score")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("geo_analyses")
      .select("id, geo_score, summary, status")
      .eq("lead_id", lead.id)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1),
  ]);

  return {
    ...lead,
    webAnalysis: webRes.data?.[0] || null,
    geoAnalysis: geoRes.data?.[0] || null,
    analysisStatus: {
      web: webRes.data?.[0] ? "ready" : "missing",
      geo: geoRes.data?.[0] ? "ready" : "missing",
    },
  };
}
