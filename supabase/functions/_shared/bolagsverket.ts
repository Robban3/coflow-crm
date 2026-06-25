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
// NOTE: the exact request path and response field names should be confirmed
// against the dev-portal OpenAPI spec. The lookup helpers therefore also return
// the RAW response so the caller (POC) can reveal the true schema; normalisation
// is best-effort and reads several likely field names.

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

// ── normalisation (best-effort; verify field names against the spec) ──────────
const pick = (obj: any, ...keys: string[]): any => {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return null;
};

function normalize(raw: any): BolagsverketCompany {
  // The API returns a list of organisations (one per requested org number).
  const o = Array.isArray(raw)
    ? raw[0]
    : raw?.organisationer?.[0] ?? raw?.organisation ?? raw?.data ?? raw ?? {};
  const addr = o?.postadress ?? o?.adress ?? o?.besoksadress ?? {};
  const sni = o?.naringsgren ?? o?.sni ?? o?.naringsgrenskod ?? o?.naringsgrensLista ?? [];
  const sniArr = Array.isArray(sni) ? sni : sni ? [sni] : [];
  // Company name: confirmed schema nests names under organisationsnamnLista[].namn.
  const namnLista = o?.organisationsnamn?.organisationsnamnLista ?? o?.organisationsnamnLista ?? [];
  const primaryName = Array.isArray(namnLista) && namnLista[0]
    ? pick(namnLista[0], "namn", "name")
    : pick(o, "organisationsnamn", "namn", "foretagsnamn", "name");
  return {
    org_number: pick(o, "identitetsbeteckning", "organisationsnummer", "orgnr", "peOrgNr"),
    company_name: primaryName,
    legal_form: pick(o, "organisationsform", "juridiskForm", "bolagsform", "legalForm"),
    status: pick(o, "organisationsstatus", "status", "avregistrerad"),
    address: pick(addr, "utdelningsadress", "gatuadress", "adressrad1", "address") ?? pick(o, "adress"),
    postal_code: pick(addr, "postnummer", "postalCode"),
    city: pick(addr, "postort", "ort", "city"),
    sni_codes: sniArr.map((s: any) => pick(s, "kod", "snikod", "code") ?? String(s)).filter(Boolean),
    sni_descriptions: sniArr.map((s: any) => pick(s, "beskrivning", "text", "description")).filter(Boolean),
    business_description: pick(o, "verksamhetsbeskrivning", "verksamhet", "businessDescription"),
    registration_date: pick(o, "registreringsdatum", "registreringsDatum", "bildatDatum"),
    documents: o?.dokument ?? o?.handlingar ?? raw?.dokumentlista ?? [],
  };
}

/** Look up a company by organisationsnummer. Returns raw + best-effort normalized. */
export async function lookupByOrgNumber(orgNumber: string): Promise<BolagsverketResult> {
  const path = env("BOLAGSVERKET_ORG_PATH") ?? "/organisationer";
  try {
    // The API takes a LIST of org numbers (identitetsbeteckningar).
    const res = await bvPost(path, { identitetsbeteckningar: [orgNumber.replace(/\D/g, "")] });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, raw };
    const fel = (raw as any)?.fel ?? (Array.isArray(raw) ? (raw as any)[0]?.fel : (raw as any)?.organisationer?.[0]?.fel);
    if (fel?.typ) return { ok: false, error: `${fel.typ}: ${fel.felBeskrivning ?? ""}`.trim(), raw };
    return { ok: true, normalized: normalize(raw), raw };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Look up companies by organisationsnamn (name). Returns raw + best-effort normalized first hit. */
export async function lookupByName(name: string): Promise<BolagsverketResult> {
  const path = env("BOLAGSVERKET_ORG_PATH") ?? "/organisationer";
  try {
    const res = await bvPost(path, { organisationsnamn: name });
    const raw = await res.json().catch(() => null);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}`, raw };
    return { ok: true, normalized: normalize(raw), raw };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}
