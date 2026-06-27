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

    const { quoteId, leadId, documentId, sellerId, event } = await req.json();
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
    } else if (documentId) {
      // Offers live in the `documents` table (separate from `quotes`).
      const { data: d } = await supabase.from("documents").select("*").eq("id", documentId).single();
      if (d) {
        organizationId = d.organization_id;
        seller = seller ?? d.created_by;
        dealType = "offert";
        dealLabel = d.document_number ? `Offert ${d.document_number}` : (d.title || "Offert");
        if (d.recipient_name) extra += ` Kund: ${d.recipient_name}.`;
        if (d.total != null) extra += ` Värde: ${d.total} ${d.currency || "kr"}.`;
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

    // Seller name
    let sellerName = "En säljare";
    if (seller) {
      const { data: p } = await supabase.from("profiles").select("full_name, email").eq("id", seller).single();
      sellerName = p?.full_name || p?.email || sellerName;
    }

    // Recipients: ALWAYS notify Robert & Oliver, plus any org admins (best-effort
    // enrichment). Never bail out on missing org/admin data — the guaranteed
    // recipients must always get the mail.
    const GUARANTEED = ["robert@applabbet.com", "oliver@applabbet.com"];
    let adminEmails: string[] = [];
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIds = (adminRoles ?? []).map((r: { user_id: string }) => r.user_id);
    if (adminIds.length > 0) {
      let q = supabase.from("profiles").select("email").in("id", adminIds);
      if (organizationId) q = q.eq("organization_id", organizationId);
      const { data: admins } = await q;
      adminEmails = (admins ?? []).map((a: { email: string | null }) => a.email).filter(Boolean) as string[];
    }
    const recipients = [...new Set([...GUARANTEED, ...adminEmails])];

    let orgName = "CoFlow";
    if (organizationId) {
      const { data: org } = await supabase.from("organizations").select("name").eq("id", organizationId).single();
      orgName = org?.name || "CoFlow";
    }

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
      to: recipients,
      subject,
      html,
    });

    return json({ sent: true, recipients: recipients.length });
  } catch (e) {
    return json({ sent: false, error: String(e) }, 500);
  }
});
