import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { lookupByName, lookupByOrgNumber } from "../_shared/bolagsverket.ts";

// Looks up a Swedish company in Bolagsverket's "Värdefulla datamängder" API by
// organisationsnummer or organisationsnamn. Returns a normalised company object
// AND the raw API response (so the exact schema can be confirmed during the POC).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    const { orgNumber, name } = await req.json().catch(() => ({}));
    if (!orgNumber && !name) {
      return json({ error: "Ange orgNumber eller name" }, 400);
    }

    const result = orgNumber
      ? await lookupByOrgNumber(String(orgNumber))
      : await lookupByName(String(name));

    if (!result.ok) {
      return json({ success: false, error: result.error, raw: result.raw }, 502);
    }
    return json({ success: true, company: result.normalized, raw: result.raw });
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
