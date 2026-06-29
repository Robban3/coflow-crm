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

    // Send FROM the org's own verified sender when they have one configured —
    // the exact same address the (working) customer emails use. Internal
    // notifications were hardcoded to mail@coflow.se, which fails if that domain
    // isn't verified on the Resend account even though the org's own domain is.
    let orgName = "CoFlow";
    let fromEmail = "mail@coflow.se";
    if (organizationId) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, sender_email, sender_name, resend_api_key_configured")
        .eq("id", organizationId)
        .single();
      orgName = org?.sender_name || org?.name || "CoFlow";
      if (org?.resend_api_key_configured && org?.sender_email) {
        fromEmail = org.sender_email;
      }
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");
    const resend = new Resend(resendApiKey);

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

    // Resend does NOT throw on API errors (e.g. unverified sender domain or a
    // bad key) — it resolves with { error }. Try the org's verified sender
    // first; if it's rejected, fall back to mail@coflow.se. Whichever domain is
    // actually verified on the Resend account will deliver. Log every outcome.
    const fromCandidates = [...new Set([fromEmail, "mail@coflow.se"])];
    let sentId: string | null = null;
    let lastError: unknown = null;

    for (const addr of fromCandidates) {
      const { data: sendData, error: sendError } = await resend.emails.send({
        from: `${orgName} <${addr}>`,
        to: recipients,
        subject,
        html,
      });
      if (sendError) {
        lastError = sendError;
        console.error(`[notify-deal-won] Resend error from ${addr}:`, JSON.stringify(sendError));
        continue;
      }
      sentId = sendData?.id ?? null;
      console.log(`[notify-deal-won] Email sent from ${addr}:`, sentId, "to", recipients.length, "recipient(s)");
      break;
    }

    if (!sentId) {
      console.error("[notify-deal-won] All senders failed. recipients:", recipients);
      return json({ sent: false, recipients: recipients.length, resendError: lastError, tried: fromCandidates }, 502);
    }

    return json({ sent: true, recipients: recipients.length, id: sentId });
  } catch (e) {
    console.error("[notify-deal-won] FATAL:", String(e));
    return json({ sent: false, error: String(e) }, 500);
  }
});
