import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveOrgSender, sendWithFallback } from "../_shared/org-sender.ts";
import { logActivityEvent } from "../_shared/activity-logger.ts";

// Emails a customer report (GEO customer report / growth report) to the lead.
// The email "comes from" the lead's OWNER (display name + reply-to = the owning
// salesperson), sent over a DKIM-verified domain. It links to the public report
// page (/r/{token}) rather than embedding the React-only report.
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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Missing auth" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authError || !user) return json({ success: false, error: "Unauthorized" }, 401);

    const { reportId, recipientEmail, recipientName, message, reportUrl } = await req.json();
    if (!reportId || !recipientEmail || !reportUrl) {
      return json({ success: false, error: "Missing required fields: reportId, recipientEmail, reportUrl" }, 400);
    }

    // Load report
    const { data: report, error: reportError } = await supabase
      .from("reports")
      .select("id, title, organization_id, lead_id")
      .eq("id", reportId)
      .single();
    if (reportError || !report) return json({ success: false, error: "Report not found" }, 404);

    // Authorize: caller must belong to the report's organization
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, organization_id")
      .eq("id", user.id)
      .single();
    if (!profile?.organization_id || profile.organization_id !== report.organization_id) {
      return json({ success: false, error: "Forbidden" }, 403);
    }

    // Resolve the lead's OWNER (assigned_to → created_by), fall back to the caller.
    let owner: { full_name: string | null; sender_display_name: string | null; email: string | null } | null = null;
    if (report.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("assigned_to, created_by")
        .eq("id", report.lead_id)
        .single();
      const ownerId = (lead?.assigned_to as string | null) || (lead?.created_by as string | null);
      if (ownerId) {
        const { data: op } = await supabase
          .from("profiles")
          .select("full_name, sender_display_name, email")
          .eq("id", ownerId)
          .single();
        if (op) owner = op;
      }
    }

    // Sender identity = the lead owner. From address stays on a DKIM-verified
    // domain; if the owner's email is on the org's verified domain, use it as the
    // From address directly, otherwise carry the owner via reply-to + display name.
    const sender = await resolveOrgSender(supabase, report.organization_id);
    const ownerName = owner?.sender_display_name || owner?.full_name || profile.full_name || sender.fromName;
    sender.fromName = ownerName;
    const ownerEmail = owner?.email || null;
    if (ownerEmail) {
      const kodco = sender.fromCandidates.find((c) => c.keyEnv === "RESEND_API_KEY_KODCO");
      const verifiedDomain = kodco?.addr.split("@")[1]?.toLowerCase();
      if (kodco && verifiedDomain && ownerEmail.toLowerCase().endsWith(`@${verifiedDomain}`)) {
        kodco.addr = ownerEmail;
      }
    }

    // Org branding for the email body
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url")
      .eq("id", report.organization_id)
      .single();

    const logoHtml = org?.logo_url
      ? `<img src="${org.logo_url}" alt="${org.name}" style="height:44px;margin-bottom:16px;" /><br/>`
      : "";
    const messageHtml = message
      ? `<p style="font-size:15px;color:#333;line-height:1.6;">${String(message).replace(/\n/g, "<br/>")}</p>`
      : "";

    const subject = `Rapport: ${report.title}`;
    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f4f4f5;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="padding:32px 32px 24px;">
          ${logoHtml}
          <h1 style="font-size:22px;margin:0 0 8px;color:#1a1a1a;">${report.title}</h1>
          <p style="font-size:14px;color:#666;margin:0 0 20px;">Vi har tagit fram en rapport åt er – klicka nedan för att öppna den.</p>
          ${messageHtml}
        </div>
        <div style="padding:16px 32px 32px;">
          <a href="${reportUrl}" style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Visa rapport →</a>
        </div>
        <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">Skickad av ${ownerName} via ${org?.name || "CoFlow"}</p>
        </div>
      </div>
    </body>
    </html>`;

    const { id: sentId, error: sendError } = await sendWithFallback(sender, {
      to: [recipientEmail],
      subject,
      html: htmlBody,
      ...(ownerEmail ? { replyTo: ownerEmail } : {}),
    });

    const resendSuccess = !!sentId;
    const resendError = sendError ? JSON.stringify(sendError) : null;

    // Log to sent_emails
    await supabase.from("sent_emails").insert({
      lead_id: report.lead_id,
      recipient_email: recipientEmail,
      recipient_name: recipientName || null,
      subject,
      body: htmlBody,
      sent_by: user.id,
      source: "report",
      organization_id: report.organization_id,
      resend_email_id: sentId,
      send_error: resendError,
      send_attempted_at: new Date().toISOString(),
      status: resendSuccess ? "sent" : "failed",
    });

    // Activity event
    await logActivityEvent(supabase, {
      organization_id: report.organization_id,
      actor_user_id: user.id,
      type: resendSuccess ? "report.sent" : "email.failed",
      entity_type: "report",
      entity_id: reportId,
      metadata: resendError ? { error: resendError.substring(0, 500) } : { recipient: recipientEmail },
    });

    if (!resendSuccess) {
      console.error("[send-report-email] All senders failed:", resendError);
      return json({ success: false, error: `Failed to send report email: ${resendError}` }, 502);
    }

    return json({ success: true, id: sentId });
  } catch (error) {
    console.error("send-report-email error:", error);
    return json({ success: false, error: (error as Error).message }, 500);
  }
});
