import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";

// Emails the organisation's admins when a seller marks a quote or lead as a
// won deal. Invoked (with the seller's JWT) from the quote editor and the
// pipeline. Best-effort: failures here must never block the deal itself.
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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { quoteId, leadId, sellerId, event } = await req.json();
    const dealEvent: "sent" | "won" = event === "sent" ? "sent" : "won";

    let organizationId: string | null = null;
    let seller: string | null = sellerId ?? null;
    let dealType = "affär";
    let dealLabel = "";
    let extra = "";

    if (quoteId) {
      const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).single();
      if (q) {
        organizationId = q.organization_id;
        seller = seller ?? q.created_by;
        dealType = "offert";
        dealLabel = q.quote_number ? `Offert ${q.quote_number}` : "Offert";
        if (q.recipient_name) extra += ` Kund: ${q.recipient_name}.`;
        const amount = q.total ?? q.total_amount ?? q.amount;
        if (amount) extra += ` Värde: ${amount} kr.`;
      }
    } else if (leadId) {
      const { data: l } = await supabase.from("leads").select("*").eq("id", leadId).single();
      if (l) {
        organizationId = l.organization_id;
        seller = seller ?? l.assigned_to ?? l.created_by;
        dealType = "lead";
        dealLabel = l.company_name || "Lead";
      }
    }

    if (!organizationId) return json({ sent: false, reason: "no organization" });

    // Seller name
    let sellerName = "En säljare";
    if (seller) {
      const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", seller).single();
      sellerName = p?.full_name || p?.email || sellerName;
    }

    // Admin recipients in the same org
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
    if (adminIds.length === 0) return json({ sent: false, reason: "no admins" });

    const { data: admins } = await supabase
      .from("profiles")
      .select("email")
      .in("id", adminIds)
      .eq("organization_id", organizationId);
    const adminEmails = (admins ?? []).map((a: { email: string | null }) => a.email).filter(Boolean) as string[];
    if (adminEmails.length === 0) return json({ sent: false, reason: "no admin emails" });

    const { data: org } = await supabase.from("organizations").select("name").eq("id", organizationId).single();
    const orgName = org?.name || "CoFlow";

    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(resendApiKey);

    const headline = dealEvent === "sent" ? "Offert skickad" : "Ny affär vunnen";
    const action =
      dealEvent === "sent"
        ? `<strong>${sellerName}</strong> har skickat en offert.`
        : `<strong>${sellerName}</strong> har satt en ${dealType} till affär (vunnen).`;
    const subject =
      dealEvent === "sent"
        ? `Offert skickad: ${dealLabel} – av ${sellerName}`
        : `Ny affär: ${dealLabel} – vunnen av ${sellerName}`;
    const html = `
      <div style="font-family:system-ui,sans-serif;max-width:520px">
        <h2 style="margin:0 0 8px">${headline}</h2>
        <p style="margin:0 0 12px">${action}</p>
        <div style="padding:12px 16px;border:1px solid #eee;border-radius:10px;background:#fafafa">
          <p style="margin:0;font-weight:600">${dealLabel}</p>
          ${extra ? `<p style="margin:6px 0 0;color:#555;font-size:14px">${extra.trim()}</p>` : ""}
        </div>
        <p style="margin:16px 0 0;color:#999;font-size:12px">Skickat automatiskt av ${orgName}</p>
      </div>`;

    await resend.emails.send({
      from: `${orgName} <mail@coflow.se>`,
      to: adminEmails,
      subject,
      html,
    });

    return json({ sent: true, recipients: adminEmails.length });
  } catch (e) {
    return json({ sent: false, error: String(e) }, 500);
  }
});
