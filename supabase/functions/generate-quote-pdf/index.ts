import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { quoteId, viewToken } = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!quoteId && !viewToken) {
      throw new Error("quoteId or viewToken required");
    }

    if (quoteId) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await authClient.auth.getUser();
      if (authError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();
      if (!profile?.organization_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: quoteOrg } = await supabase
        .from("quotes")
        .select("organization_id")
        .eq("id", quoteId)
        .single();
      if (!quoteOrg || quoteOrg.organization_id !== profile.organization_id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch quote by id or token
    let query = supabase.from("quotes").select("*");
    if (quoteId) {
      query = query.eq("id", quoteId);
    } else if (viewToken) {
      query = query.eq("view_token", viewToken);
    }

    const { data: quote, error: qErr } = await query.single();
    if (qErr || !quote) throw new Error("Quote not found");

    const { data: items } = await supabase
      .from("quote_items")
      .select("*")
      .eq("quote_id", quote.id)
      .order("sort_order");

    let orgName = "";
    let orgLogo = "";
    let orgWebsite = "";
    if (quote.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("name, logo_url, website")
        .eq("id", quote.organization_id)
        .single();
      if (org) {
        orgName = org.name || "";
        orgLogo = org.logo_url || "";
        orgWebsite = org.website || "";
      }
    }

    const formatNum = (n: number) => Number(n).toLocaleString("sv-SE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

    const oneTimeItems = (items || []).filter((i: any) => i.billing_type !== "monthly");
    const monthlyItems = (items || []).filter((i: any) => i.billing_type === "monthly");
    const hasOneTime = oneTimeItems.length > 0;
    const hasMonthly = monthlyItems.length > 0;
    const oneTimeTotal = oneTimeItems.reduce((s: number, i: any) => s + Number(i.line_total || 0), 0);
    const monthlyTotal = monthlyItems.reduce((s: number, i: any) => s + Number(i.line_total || 0), 0);

    const billingLabel = (type: string) => type === "monthly" ? "Månad" : "Engång";

    const itemRows = (items || []).map((item: any) => {
      const lineDiscount = Number(item.discount_percent) || 0;
      const grossAmount = Number(item.quantity) * Number(item.unit_price);
      const isMonthly = item.billing_type === "monthly";
      const discountCell = lineDiscount > 0
        ? `<span style="color:#dc2626;font-weight:600;">-${lineDiscount}%</span><br/><span style="font-size:10px;color:#9ca3af;text-decoration:line-through;">${formatNum(grossAmount)} kr</span>`
        : `<span style="color:#9ca3af;">—</span>`;
      return `
      <tr>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
          <div>${escapeHtml(item.description)}</div>
          ${isMonthly ? `<div style="font-size:11px;color:#6b7280;margin-top:2px;">Återkommande månadskostnad</div>` : ""}
        </td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;vertical-align:top;">${item.quantity} ${escapeHtml(item.unit)}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;vertical-align:top;">${formatNum(item.unit_price)} kr</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;white-space:nowrap;vertical-align:top;">${discountCell}</td>
        <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;white-space:nowrap;vertical-align:top;">${formatNum(item.line_total || 0)} kr${isMonthly ? "<span style='font-size:11px;color:#6b7280;font-weight:400;'>/mån</span>" : ""}</td>
      </tr>
    `;
    }).join("");

    const discountPercent = Number(quote.discount_percent) || 0;
    const lineDiscountTotal = (items || []).reduce((s: number, i: any) => {
      const gross = Number(i.quantity) * Number(i.unit_price);
      const net = Number(i.line_total || 0);
      return s + Math.max(0, gross - net);
    }, 0);
    const lineDiscountRow = lineDiscountTotal > 0 ? `
      <tr><td colspan="5" style="text-align:right;padding:4px 8px;color:#dc2626;">Radrabatter totalt</td>
      <td style="text-align:right;padding:4px 8px;color:#dc2626;">-${formatNum(lineDiscountTotal)} kr</td></tr>
    ` : "";
    const discountRow = discountPercent > 0 ? `
      <tr><td colspan="5" style="text-align:right;padding:4px 8px;color:#dc2626;">Rabatt på hela offerten (${discountPercent}%)</td>
      <td style="text-align:right;padding:4px 8px;color:#dc2626;">-${formatNum(Number(quote.subtotal) * discountPercent / 100)} kr</td></tr>
    ` : "";

    const costBreakdown = hasOneTime && hasMonthly ? `
      <tr><td colspan="5" style="text-align:right;padding:4px 8px;color:#6b7280;">Engångskostnader</td><td style="text-align:right;padding:4px 8px;">${formatNum(oneTimeTotal)} kr</td></tr>
      <tr><td colspan="5" style="text-align:right;padding:4px 8px;color:#6b7280;">Månadskostnader</td><td style="text-align:right;padding:4px 8px;">${formatNum(monthlyTotal)} kr/mån</td></tr>
      <tr><td colspan="6" style="border-bottom:1px solid #e5e7eb;padding:0;"></td></tr>
    ` : "";

    const validUntilStr = quote.valid_until
      ? new Date(quote.valid_until).toLocaleDateString("sv-SE", { year: "numeric", month: "long", day: "numeric" })
      : "";

    // Fetch sender profile for signature names and logo
    let senderName = "";
    let senderLogo = "";
    if (quote.created_by) {
      const { data: senderProfile } = await supabase
        .from("profiles")
        .select("full_name, sender_display_name, company_logo_url")
        .eq("id", quote.created_by)
        .single();
      if (senderProfile) {
        senderName = senderProfile.sender_display_name || senderProfile.full_name || "";
        senderLogo = senderProfile.company_logo_url || "";
      }
    }

    // Use sender's company logo, fallback to org logo
    const displayLogo = senderLogo || orgLogo;

    const senderSigHtml = quote.sender_signature_data
      ? `<div style="margin-top:20px;"><p style="font-size:12px;color:#6b7280;margin-bottom:4px;">Avsändare</p><p style="font-size:13px;font-weight:600;margin:0 0 4px;">${escapeHtml(senderName || orgName)}</p><img src="${quote.sender_signature_data}" style="max-height:60px;" />${quote.sender_signed_at ? `<p style="font-size:11px;color:#6b7280;">Signerad: ${new Date(quote.sender_signed_at).toLocaleDateString("sv-SE")}</p>` : ""}</div>`
      : "";

    const recipientSigHtml = quote.recipient_signature_data
      ? `<div style="margin-top:20px;"><p style="font-size:12px;color:#6b7280;margin-bottom:4px;">Mottagare</p><p style="font-size:13px;font-weight:600;margin:0 0 4px;">${escapeHtml(quote.recipient_name || "")}</p><img src="${quote.recipient_signature_data}" style="max-height:60px;" />${quote.recipient_signed_at ? `<p style="font-size:11px;color:#6b7280;">Signerad: ${new Date(quote.recipient_signed_at).toLocaleDateString("sv-SE")}</p>` : ""}</div>`
      : "";

    const statusLabel: Record<string, string> = {
      draft: "Utkast",
      sent: "Skickad",
      viewed: "Visad",
      accepted: "Accepterad",
      won: "Vunnen affär",
      rejected: "Avböjd",
    };

    const docLabel = quote.document_label === "avtal" ? "Avtal" : "Offert";

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  @page { size: A4; margin: 40px; }
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1a1a2e; margin: 0; padding: 40px; font-size: 13px; line-height: 1.5; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 24px; }
  .logo-section { display: flex; align-items: center; gap: 16px; }
  .logo-section img { max-height: 56px; max-width: 200px; object-fit: contain; }
  .quote-meta { text-align: right; }
  .quote-meta h1 { font-size: 22px; margin: 0 0 4px 0; font-weight: 700; }
  .quote-meta p { margin: 2px 0; color: #6b7280; font-size: 12px; }
  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
  thead th { text-align: left; padding: 10px 8px; border-bottom: 2px solid #1a1a2e; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; color: #6b7280; }
  thead th:not(:first-child) { text-align: right; }
  .totals { margin-top: 8px; }
  .totals td { padding: 4px 8px; }
  .total-row td { font-size: 16px; font-weight: 700; border-top: 2px solid #1a1a2e; padding-top: 12px; }
  .section { margin-top: 24px; }
  .section h3 { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #374151; }
  .section p { color: #6b7280; white-space: pre-wrap; }
  .signatures { display: flex; gap: 40px; margin-top: 32px; padding-top: 20px; border-top: 1px solid #e5e7eb; }
  .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 11px; font-weight: 600; background: #f3f4f6; color: #374151; }
  .badge-accepted { background: #dcfce7; color: #166534; }
  .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #9ca3af; }
</style></head><body>
  <div class="header">
    <div class="logo-section">
      ${displayLogo ? `<img src="${displayLogo}" alt="${escapeHtml(orgName)}" crossorigin="anonymous" />` : ""}
      <div>
        <strong style="font-size:16px;">${escapeHtml(orgName)}</strong>
        ${orgWebsite ? `<br/><span style="font-size:11px;color:#6b7280;">${escapeHtml(orgWebsite)}</span>` : ""}
      </div>
    </div>
    <div class="quote-meta">
      <h1>${docLabel}</h1>
      <p>#${escapeHtml(quote.quote_number)}</p>
      <p><span class="badge ${quote.status === 'accepted' ? 'badge-accepted' : ''}">${statusLabel[quote.status] || quote.status}</span></p>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
    <div>
      <p style="font-size:12px;color:#6b7280;margin:0;">Till</p>
      <p style="font-weight:600;margin:2px 0;">${escapeHtml(quote.recipient_name)}</p>
      ${quote.recipient_email ? `<p style="color:#6b7280;margin:0;">${escapeHtml(quote.recipient_email)}</p>` : ""}
    </div>
    <div style="text-align:right;">
      <p style="font-size:12px;color:#6b7280;margin:0;">Titel</p>
      <p style="font-weight:600;margin:2px 0;">${escapeHtml(quote.title)}</p>
      ${validUntilStr ? `<p style="color:#6b7280;margin:0;font-size:12px;">Giltig t.o.m. ${validUntilStr}</p>` : ""}
    </div>
  </div>

  <table>
    <thead><tr><th>Beskrivning</th><th>Antal</th><th>Á-pris</th><th>Rabatt</th><th>Summa</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <table class="totals" style="width:55%;margin-left:auto;">
    ${costBreakdown}
    <tr><td style="text-align:right;color:#6b7280;">Netto</td><td style="text-align:right;">${formatNum(quote.subtotal || 0)} kr</td></tr>
    ${lineDiscountRow}
    ${discountRow}
    <tr><td style="text-align:right;color:#6b7280;">Moms</td><td style="text-align:right;">${formatNum(quote.vat_total || 0)} kr</td></tr>
    ${hasOneTime && hasMonthly ? (() => {
      const subtotalAll = Number(quote.subtotal) || (oneTimeTotal + monthlyTotal);
      const vatTotalAll = Number(quote.vat_total) || 0;
      const oneTimeNet = oneTimeTotal * (1 - discountPercent / 100);
      const monthlyNet = monthlyTotal * (1 - discountPercent / 100);
      const netSum = oneTimeNet + monthlyNet;
      const oneTimeVat = netSum > 0 ? vatTotalAll * (oneTimeNet / netSum) : 0;
      const monthlyVat = netSum > 0 ? vatTotalAll * (monthlyNet / netSum) : 0;
      return `
    <tr class="total-row"><td style="text-align:right;">Engångsbelopp inkl. moms</td><td style="text-align:right;">${formatNum(oneTimeNet + oneTimeVat)} ${escapeHtml(quote.currency)}</td></tr>
    <tr class="total-row"><td style="text-align:right;">Månadsbelopp inkl. moms</td><td style="text-align:right;">${formatNum(monthlyNet + monthlyVat)} ${escapeHtml(quote.currency)}/mån</td></tr>
    `;
    })() : `
    <tr class="total-row"><td style="text-align:right;">Totalt inkl. moms</td><td style="text-align:right;">${formatNum(quote.total || 0)} ${escapeHtml(quote.currency)}${hasMonthly && !hasOneTime ? "/mån" : ""}</td></tr>
    `}
  </table>

  ${quote.notes ? `<div class="section"><h3>Meddelande</h3><p>${escapeHtml(quote.notes)}</p></div>` : ""}
  ${quote.terms ? `<div class="section"><h3>Villkor</h3><p>${escapeHtml(quote.terms)}</p></div>` : ""}

  <div class="signatures">
    ${senderSigHtml}
    ${recipientSigHtml}
  </div>

  <div class="footer">${escapeHtml(orgName)} ${orgWebsite ? `• ${escapeHtml(orgWebsite)}` : ""}</div>
</body></html>`;

    // Return HTML for client-side PDF generation via print
    return new Response(JSON.stringify({ html, quoteNumber: quote.quote_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error generating quote PDF:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
