// Fyller lead_pool från det svenska företagsregistret.
//
// Det här är steg ett i "säljarna analyserar inte själva". En admin väljer
// bransch och län, den här funktionen kopierar matchande bolag ur
// company_registry till lead_pool, och analysstegen tar vid därifrån.
//
// Svarsformen { scanned, inserted, cursor, done } är avsiktligt densamma som de
// befintliga analysfunktionerna använder, så samma webbläsarloop i admin-UI:t
// kan driva alla tre stegen.
//
// Paginering sker med keyset på org_number (unikt btree) — aldrig .range() med
// offset, som blir kvadratiskt över miljontals rader.

import { requireAdmin, AuthError } from "../_shared/require-admin.ts";
import { INDUSTRY_TAXONOMY, isIndustryKey } from "../_shared/industry-taxonomy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rader lästa ur registret per anrop. Loopen i UI:t står för uthålligheten.
const SCAN_DEFAULT = 500;
const SCAN_MAX = 2000;

type RegistryRow = {
  org_number: string;
  company_name: string;
  city: string | null;
  postal_code: string | null;
  address: string | null;
  sni_codes: string | null;
  sni_descriptions: string | null;
  business_description: string | null;
  status: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { orgId, service } = await requireAdmin(req);

    const body = await req.json();
    // countyPrefixes: ett län motsvarar FLERA postnummerprefix
    // (Stockholm = 10–19), så det måste vara en lista — se COUNTIES i
    // src/lib/swedishProspecting.ts.
    const { market = "SE", industryKey, countyPrefixes, city, cursor } = body ?? {};
    const scanLimit = Math.min(Math.max(Number(body?.limit) || SCAN_DEFAULT, 1), SCAN_MAX);

    if (market !== "SE") {
      // Registret innehåller bara svenska bolag. Utanför SE finns idag ingen
      // källa än Google Places, vilket är ett eget bygge.
      throw new Error("Endast marknaden SE stöds tills vidare");
    }
    if (!isIndustryKey(industryKey)) {
      throw new Error(`Okänd bransch: ${industryKey}`);
    }

    const def = INDUSTRY_TAXONOMY[industryKey];

    let q = service
      .from("company_registry")
      .select(
        "org_number, company_name, city, postal_code, address, sni_codes, sni_descriptions, business_description, status",
      )
      .order("org_number", { ascending: true })
      .limit(scanLimit);

    // Primärt: indexerad SNI-division. Fallback: trigram mot beskrivningarna,
    // för rader som saknar SNI-kod (Bolagsverket-hämtade snarare än CSV).
    const termFilters = def.terms
      .flatMap((t) => [
        `sni_descriptions.ilike.%${t}%`,
        `business_description.ilike.%${t}%`,
      ])
      .join(",");
    q = q.or(
      `sni_division.in.(${def.sniDivisions.join(",")}),${termFilters}`,
    );

    if (Array.isArray(countyPrefixes) && countyPrefixes.length > 0) {
      q = q.or(
        countyPrefixes
          .filter((p: unknown) => typeof p === "string" && /^\d{1,2}$/.test(p))
          .map((p: string) => `postal_code.like.${p}%`)
          .join(","),
      );
    }
    if (city) q = q.ilike("city", city);
    if (cursor) q = q.gt("org_number", cursor);

    const { data, error } = await q;
    if (error) throw new Error(`Registerläsning misslyckades: ${error.message}`);

    const rows = (data ?? []) as RegistryRow[];
    const scanned = rows.length;

    if (scanned === 0) {
      return json({ scanned: 0, inserted: 0, cursor: null, done: true });
    }

    // Avregistrerade bolag är inga leads.
    const usable = rows.filter(
      (r) => r.company_name && !/avregistrer|konkurs|likvid/i.test(r.status ?? ""),
    );

    const poolRows = usable.map((r) => ({
      organization_id: orgId,
      source: "company_registry",
      market: "SE",
      industry_key: industryKey,
      company_name: r.company_name,
      org_nr: r.org_number, // normaliseras till siffror av trg_normalize_pool_org_nr
      // Rå beskrivning behålls för visning; industry_key är det man filtrerar på.
      industry: r.sni_descriptions ?? r.business_description ?? null,
      sni_codes: r.sni_codes
        ? r.sni_codes.split(/[,;]/).map((c) => c.trim()).filter(Boolean)
        : null,
      city: r.city,
      website: null,
      website_status: "unknown",
      data: {
        address: r.address,
        postal_code: r.postal_code,
        business_description: r.business_description,
      },
    }));

    let inserted = 0;
    if (poolRows.length > 0) {
      // ignoreDuplicates mot unikindexet (organization_id, org_nr) gör hela
      // körningen idempotent — admin kan köra om utan att skapa dubbletter.
      const { data: ins, error: insErr } = await service
        .from("lead_pool")
        .upsert(poolRows, {
          onConflict: "organization_id,org_nr",
          ignoreDuplicates: true,
        })
        .select("id");
      if (insErr) throw new Error(`Kunde inte skriva till poolen: ${insErr.message}`);
      inserted = ins?.length ?? 0;
    }

    const nextCursor = rows[rows.length - 1].org_number;

    return json({
      scanned,
      inserted,
      cursor: nextCursor,
      // Färre rader än vi bad om ⇒ registret är slut för den här slicen.
      done: scanned < scanLimit,
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return json({ error: err.message }, err.status);
    }
    console.error("[fill-lead-pool]", err);
    return json({ error: (err as Error).message }, 400);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
