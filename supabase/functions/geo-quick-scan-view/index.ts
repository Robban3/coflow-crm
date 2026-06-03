import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const { token } = await req.json();
    if (!token || typeof token !== "string" || token.length < 10) {
      return new Response(
        JSON.stringify({ error: "Ogiltig token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: scan, error } = await supabase
      .from("geo_quick_scans")
      .select(
        "id, domain, company_name, email, website, status, geo_score, summary_short, top_findings, top_actions, public_token, expires_at, created_at, completed_at, progress_step, progress_label, error_code, error_message"
      )
      .eq("public_token", token)
      .maybeSingle();

    if (error || !scan) {
      return new Response(
        JSON.stringify({ error: "Rapport ej tillgänglig" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check expiry only for completed scans
    if (scan.status === "completed" && scan.expires_at && new Date(scan.expires_at) < new Date()) {
      return new Response(
        JSON.stringify({ error: "Rapporten har gått ut", status: "expired" }),
        { status: 410, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(scan), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("geo-quick-scan-view error:", e);
    return new Response(
      JSON.stringify({ error: "Serverfel" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
