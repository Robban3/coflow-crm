// Shared client for Bolagsverket's "Värdefulla datamängder" API (free, OAuth2,
// 60 req/min). Data from Bolagsverket + SCB: organisation name, legal form,
// addresses, business description, SNI/industry code, status + filed documents.
//
// Auth: OAuth2 client-credentials. Token is cached in-memory for the lifetime of
// the (warm) function instance.
//
// Configuration via Supabase secrets (set these before use):
//   BOLAGSVERKET_TOKEN_URL   - optional, defaults to portal.api.bolagsverket.se/oauth2/token
//   BOLAGSVERKET_BASE_URL    - API base URL (prod or test)
//   BOLAGSVERKET_CLIENT_ID
//   BOLAGSVERKET_CLIENT_SECRET
//   BOLAGSVERKET_SCOPE       - optional, defaults to "vardefulla-datamangder:read"
//   BOLAGSVERKET_ORG_PATH    - optional, defaults to "/organisationer"
//
// The request body is { identitetsbeteckning: "<orgnr>" } and the response is
// { organisationer: [ { ... } ] }; normalisation below is mapped against that
// live schema. The helpers still return the RAW response alongside the
// normalised object so callers can access fields we don't surface.

import { fetchWithRetry } from "./http.ts";

export interface BolagsverketCompany {
  org_number: string | null;
  company_name: string | null;
  legal_form: string | null;
  status: string | null;
  address: string | null;
  postal_code: string | null;
  city: string | null;
  sni_codes: string[];
  sni_descriptions: string[];
  business_description: string | null;
  registration_date: string | null;
  documents: unknown[];
}

export interface BolagsverketResult {
  ok: boolean;
  error?: string;
  normalized?: BolagsverketCompany;
  raw?: unknown;
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function env(name: string): string | undefined {
  const v = Deno.env.get(name);
  return v && v.trim() ? v.trim() : undefined;
}

/** OAuth2 client-credentials token, cached until ~60s before expiry. */
async function getToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value;
  }
  const tokenUrl = env("BOLAGSVERKET_TOKEN_URL") ?? "https://portal.api.bolagsverket.se/oauth2/token";
  const clientId = env("BOLAGSVERKET_CLIENT_ID");
  const clientSecret = env("BOLAGSVERKET_CLIENT_SECRET");
  const scope = env("BOLAGSVERKET_SCOPE") ?? "vardefulla-datamangder:read";
  if (!tokenUrl || !clientId || !clientSecret) {
    throw new Error(
      "Bolagsverket OAuth2 is not configured (set BOLAGSVERKET_TOKEN_URL / _CLIENT_ID / _CLIENT_SECRET)",
    );
  }

  // RFC 6749 §4.4 client-credentials grant. The spec allows two ways to pass the
  // client credentials: HTTP Basic (recommended, §2.3.1) or as body params. We try
  // Basic first and fall back to body params on a 400/401 so an auth-method mismatch
  // on the server doesn't break the first real call.
  async function requestToken(useBasic: boolean): Promise<Response> {
    const params: Record<string, string> = { grant_type: "client_credentials", scope };
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    };
    if (useBasic) {
      headers.Authorization = `Basic ${btoa(`${clientId}:${clientSecret}`)}`;
    } else {
      params.client_id = clientId!;
      params.client_secret = clientSecret!;
    }
    return await fetchWithRetry(tokenUrl!, {
      method: "POST",
      headers,
      body: new URLSearchParams(params).toString(),
    });
  }

  let res = await requestToken(true);
  if (res.status === 400 || res.status === 401) {
    res = await requestToken(false);
  }
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Bolagsverket token error ${res.status}: ${txt.slice(0, 300)}`);
  }
  const json = await res.json();
  const accessToken = json.access_token as string;
  const expiresIn = Number(json.expires_in ?? 3300);
  cachedToken = { value: accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}

/** Low-level authenticated POST to the värdefulla-datamängder API. */
async function bvPost(path: string, payload: Record<string, unknown>): Promise<Response> {
  const base = env("BOLAGSVERKET_BASE_URL");
  if (!base) throw new Error("BOLAGSVERKET_BASE_URL is not configured");
  const token = await getToken();
  return await fetchWithRetry(`${base.replace(/\/$/, "")}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
}

// ── normalisation (mapped against the live API response schema) ───────────────
function normalize(raw: any): BolagsverketCompany {
  // Response shape: { organisationer: [ { ...one per requested org... } ] }
  const o = raw?.organisationer?.[0] ?? (Array.isArray(raw) ? raw[0] : raw) ?? {};

  const addr = o?.postadressOrganisation?.postadress ?? {};
  const sniArr: any[] = Array.isArray(o?.naringsgrenOrganisation?.sni)
    ? o.naringsgrenOrganisation.sni
    : [];
  const namnLista = o?.organisationsnamn?.organisationsnamnLista ?? [];
  const primaryName = Array.isArray(namnLista) && namnLista[0] ? namnLista[0].namn ?? null : null;

  // Status: a deregistered org wins; otherwise the SCB "verksam" flag (JA/NEJ).
  const status = o?.avregistreradOrganisation
    ? "Avregistrerad"
    : o?.verksamOrganisation?.kod === "JA"
      ? "Aktiv"
      : o?.verksamOrganisation?.kod === "NEJ"
        ? "Ej verksam"
        : null;

  return {
    org_number: o?.organisationsidentitet?.identitetsbeteckning ?? null,
    company_name: primaryName,
    legal_form: o?.organisationsform?.klartext ?? o?.juridiskForm?.klartext ?? null,
    status,
    address: addr?.utdelningsadress ?? null,
    postal_code: addr?.postnummer ?? null,
    city: addr?.postort ?? null,
    sni_codes: sniArr.map((s) => s?.kod).filter(Boolean),
    sni_descriptions: sniArr.map((s) => s?.klartext).filter(Boolean),
    business_description: o?.verksamhetsbeskrivning?.beskrivning ?? null,
    registration_date: o?.organisationsdatum?.registreringsdatum ?? null,
    documents: [],
  };
}

/** Look up a company by organisationsnummer. Returns raw + best-effort normalized. */
export async function lookupByOrgNumber(orgNumber: string): Promise<BolagsverketResult> {
  const path = env("BOLAGSVERKET_ORG_PATH") ?? "/organisationer";
  try {
    // Request body: { identitetsbeteckning: "5560360793" } — single string, not a list.
    const res = await bvPost(path, { identitetsbeteckning: orgNumber.replace(/\D/g, "") });
    const raw = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = (raw as any)?.felBeskrivning ?? (raw as any)?.message ?? (raw as any)?.error;
      return { ok: false, error: msg ? `HTTP ${res.status}: ${msg}` : `HTTP ${res.status}`, raw };
    }
    if (!Array.isArray((raw as any)?.organisationer) || (raw as any).organisationer.length === 0) {
      return { ok: false, error: "Organisationen hittades inte", raw };
    }
    return { ok: true, normalized: normalize(raw), raw };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/**
 * The Värdefulla datamängder API only looks organisations up by
 * identitetsbeteckning (org number) — there is no free-text name search. Name →
 * org-number resolution must come from the bulk register, so this is a clear
 * no-op rather than a broken request.
 */
export function lookupByName(_name: string): Promise<BolagsverketResult> {
  return Promise.resolve({
    ok: false,
    error: "Bolagsverket-API:t stöder bara uppslag på organisationsnummer, inte namn.",
  });
}
