import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveOrgSender, sendWithFallback } from "../_shared/org-sender.ts";

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

    // Send FROM the org's own verified sender when configured, signed with the
    // matching Resend key (so DKIM passes at Gmail) — falling back to
    // mail@coflow.se on the platform key. The shared helper handles both.
    const sender = await resolveOrgSender(supabase, organizationId);
    const orgName = sender.fromName;

    // ── Guaranteed in-app notifications for every admin ──────────────────
    // Email is best-effort (and silently fails if the Resend domain/key is
    // misconfigured), so always drop an in-app notification too — that way the
    // admins get the signal in the CRM regardless of email delivery.
    if (adminIds.length > 0) {
      const inAppHeadline = dealEvent === "sent" ? "Offert skickad" : "Ny affär vunnen";
      const inAppMsg =
        dealEvent === "sent"
          ? `${sellerName} har skickat ${dealLabel}.${extra}`.trim()
          : `${sellerName} har vunnit en ${dealType}: ${dealLabel}.${extra}`.trim();
      await supabase.from("notifications").insert(
        adminIds.map((uid) => ({
          user_id: uid,
          type: dealEvent === "sent" ? "offer_sent" : "deal_won",
          title: inAppHeadline,
          message: inAppMsg,
          link: dealEvent === "sent" ? "/offers" : "/pipeline",
          metadata: { quoteId, leadId, documentId, sellerId: seller, event: dealEvent },
        })),
      ).then(({ error }) => {
        if (error) console.error("[notify-deal-won] in-app notification insert failed:", error.message);
      });
    }

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

    // Each From candidate is signed with the Resend key that matches its domain
    // (KODCO for the org domain, PLATFORM for coflow.se) so DKIM passes at Gmail.
    const { id: sentId, error: lastError } = await sendWithFallback(sender, {
      to: recipients,
      subject,
      html,
    });

    if (!sentId) {
      console.error("[notify-deal-won] All senders failed. recipients:", recipients);
      return json({ sent: false, recipients: recipients.length, resendError: lastError }, 502);
    }

    return json({ sent: true, recipients: recipients.length, id: sentId });
  } catch (e) {
    console.error("[notify-deal-won] FATAL:", String(e));
    return json({ sent: false, error: String(e) }, 500);
  }
});
