import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client to check role
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Service role client for insert
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { rows } = await req.json() as { rows: Array<Record<string, string>> };

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(
        JSON.stringify({ error: "No rows provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log first row keys for debugging
    if (rows.length > 0) {
      console.log("First row keys:", Object.keys(rows[0]));
    }

    // Helper: find value by trying multiple column name variants
    const getVal = (r: Record<string, string>, ...keys: string[]): string | null => {
      for (const k of keys) {
        if (r[k] !== undefined && r[k] !== null && r[k] !== "") return r[k];
      }
      // Also try case-insensitive match
      const rKeys = Object.keys(r);
      for (const k of keys) {
        const found = rKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase().trim());
        if (found && r[found]) return r[found];
      }
      return null;
    };

    // Map CSV columns to DB columns
    const mapped = rows.map((r) => ({
      company_name: getVal(r, "Företagsnamn", "Foretagsnamn", "company_name", "CompanyName") || "",
      org_number: getVal(r, "Org nr", "Org.nr", "Orgnr", "org_number", "OrgNumber") || "",
      company_form: getVal(r, "Bolagsform", "company_form"),
      registration_date: getVal(r, "Reg Datum", "Reg datum", "registration_date"),
      legal_form: getVal(r, "Juridisk form", "legal_form"),
      address: getVal(r, "Adress", "address"),
      co_address: getVal(r, "C/o-adress", "Co-adress", "co_address"),
      postal_code: getVal(r, "Postnummer", "postal_code"),
      city: getVal(r, "Postort", "city"),
      country: getVal(r, "Land", "country"),
      phone: getVal(r, "Telefonnummer", "Telefon", "phone"),
      sni_codes: getVal(r, "SNI-koder", "SNI koder", "sni_codes"),
      sni_descriptions: getVal(r, "SNI-beskrivningar", "SNI beskrivningar", "sni_descriptions"),
    })).filter((r) => r.company_name && r.org_number);

    console.log(`Mapped ${mapped.length} valid rows out of ${rows.length} total`);

    if (mapped.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No valid rows after mapping",
          debug: { 
            totalRows: rows.length,
            firstRowKeys: rows.length > 0 ? Object.keys(rows[0]) : [],
            firstRow: rows.length > 0 ? rows[0] : null
          }
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Upsert in chunks of 500
    const chunkSize = 500;
    let inserted = 0;
    let errors = 0;

    for (let i = 0; i < mapped.length; i += chunkSize) {
      const chunk = mapped.slice(i, i + chunkSize);
      const { error } = await serviceClient
        .from("company_registry")
        .upsert(chunk, { onConflict: "org_number" });

      if (error) {
        console.error("Upsert error:", error);
        errors += chunk.length;
      } else {
        inserted += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted, errors, total: mapped.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
