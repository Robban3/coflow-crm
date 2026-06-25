import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// Emails the onboarding/handoff details (filled in by the seller when a deal is
// won) to the onboarding recipient. Best-effort.
const RECIPIENTS = ["robert@applabbet.com", "oliver@applabbet.com"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const row = (label: string, value?: string | null) =>
  value ? `<tr><td style="padding:4px 12px 4px 0;color:#666;white-space:nowrap">${label}</td><td style="padding:4px 0;font-weight:500">${value}</td></tr>` : "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { handoffId } = await req.json();
    if (!handoffId) return json({ sent: false, reason: "no handoffId" });

    const { data: h } = await supabase.from("deal_handoffs").select("*").eq("id", handoffId).single();
    if (!h) return json({ sent: false, reason: "not found" });

    let sellerName = "En säljare";
    if (h.created_by) {
      const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", h.created_by).single();
      sellerName = p?.full_name || p?.email || sellerName;
    }
    const { data: org } = await supabase.from("organizations").select("name").eq("id", h.organization_id).single();
    const orgName = org?.name || "CoFlow";

    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(resendApiKey);

    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:560px">
        <h2 style="margin:0 0 4px">Ny vunnen affär – onboarding</h2>
        <p style="margin:0 0 16px;color:#555">Registrerad av <strong>${sellerName}</strong></p>
        <table style="border-collapse:collapse;font-size:14px;width:100%">
          ${row("Företag", h.company_name)}
          ${row("Kontaktperson", h.contact_name)}
          ${row("E-post", h.email)}
          ${row("Telefon", h.phone)}
          ${row("Produkt/tjänst", h.product_service)}
          ${row("Onboarding", `${h.onboarding_date} ${h.onboarding_time}`)}
          ${row("Säljarens anteckningar", h.seller_notes)}
          ${row("Kundens mål", h.customer_goal)}
          ${row("Löften / överenskommelser", h.promises)}
        </table>
        <p style="margin:18px 0 0;color:#999;font-size:12px">Skickat automatiskt av ${orgName}</p>
      </div>`;

    await resend.emails.send({
      from: `${orgName} <mail@coflow.se>`,
      to: RECIPIENTS,
      subject: `Vunnen affär: ${h.company_name} – av ${sellerName}`,
      html,
    });

    return json({ sent: true });
  } catch (e) {
    return json({ sent: false, error: String(e) }, 500);
  }
});
