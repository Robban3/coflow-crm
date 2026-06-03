import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@2.0.0";
import { logActivityEvent } from "../_shared/activity-logger.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { quoteId, recipientEmail, recipientName, message, quoteUrl } = await req.json();

    if (!quoteId || !recipientEmail || !quoteUrl) {
      throw new Error("Missing required fields");
    }

    // Get quote data
    const { data: quote, error: quoteError } = await supabase
      .from("quotes")
      .select("*, organization_id")
      .eq("id", quoteId)
      .single();

    if (quoteError || !quote) throw new Error("Quote not found");

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, sender_email, sender_name, resend_api_key_configured")
      .eq("id", quote.organization_id)
      .single();

    // Get sender profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, sender_display_name, company_name, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id || profile.organization_id !== quote.organization_id) {
      throw new Error("Forbidden");
    }

    const senderDisplayName = profile?.sender_display_name || profile?.full_name || org?.sender_name || org?.name || "CoFlow";

    // Determine which Resend key and from-address to use
    let resendApiKey: string | undefined;
    let fromEmail = "mail@coflow.se";

    if (org?.name === "Kod & Co.") {
      resendApiKey = Deno.env.get("RESEND_API_KEY");
      fromEmail = org?.sender_email || "hej@kodco.se";
    } else {
      resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM");
      if (org?.resend_api_key_configured && org?.sender_email) {
        fromEmail = org.sender_email;
      }
    }

    if (!resendApiKey) {
      console.error("FATAL: RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resend = new Resend(resendApiKey);

    const logoHtml = org?.logo_url
      ? `<img src="${org.logo_url}" alt="${org.name}" style="height:48px;margin-bottom:16px;" /><br/>`
      : "";

    const messageHtml = message
      ? `<p style="font-size:15px;color:#333;line-height:1.6;">${message.replace(/\n/g, "<br/>")}</p>`
      : "";

    const docLabel = (quote as any).document_label === "avtal" ? "Avtal" : "Offert";

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f4f4f5;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="padding:32px 32px 24px;">
          ${logoHtml}
          <h1 style="font-size:22px;margin:0 0 8px;color:#1a1a1a;">${docLabel}: ${quote.title}</h1>
          <p style="font-size:14px;color:#666;margin:0 0 20px;">#${quote.quote_number} • ${Number(quote.total).toLocaleString("sv-SE")} ${quote.currency}</p>
          ${messageHtml}
        </div>
        <div style="padding:16px 32px 32px;">
          <a href="${quoteUrl}" style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Visa ${docLabel.toLowerCase()} →</a>
        </div>
        <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">Skickad av ${senderDisplayName} via ${org?.name || "CoFlow"}</p>
        </div>
      </div>
    </body>
    </html>`;

    // Create sent_emails record before sending
    const { data: sentEmailRecord } = await supabase
      .from("sent_emails")
      .insert({
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        subject: `${docLabel}: ${quote.title} (#${quote.quote_number})`,
        body: htmlBody,
        sent_by: user.id,
        source: "quote",
        organization_id: profile?.organization_id || quote.organization_id,
      })
      .select("id")
      .single();

    let resendSuccess = false;
    let resendMessageId: string | null = null;
    let resendError: string | null = null;

    try {
      const emailResult = await resend.emails.send({
        from: `${senderDisplayName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `${docLabel}: ${quote.title} (#${quote.quote_number})`,
        html: htmlBody,
      });

      if (emailResult.error || !emailResult.data?.id) {
        resendError = JSON.stringify(emailResult.error);
        console.error("Resend error:", JSON.stringify(emailResult.error, null, 2));
      } else {
        resendMessageId = emailResult.data.id;
        resendSuccess = true;
        console.log("Resend success, id:", resendMessageId);
      }
    } catch (err) {
      resendError = err instanceof Error ? err.message : String(err);
      console.error("Resend error:", JSON.stringify(resendError, null, 2));
    }

    // Update sent_emails with result
    if (sentEmailRecord?.id) {
      await supabase
        .from("sent_emails")
        .update({
          resend_email_id: resendMessageId,
          send_error: resendError,
          send_attempted_at: new Date().toISOString(),
          status: resendSuccess ? "sent" : "failed",
        })
        .eq("id", sentEmailRecord.id);
    }

    // Log activity event only after confirmed result
    const eventOrgId = profile?.organization_id || quote.organization_id;
    if (eventOrgId) {
      await logActivityEvent(supabase, {
        organization_id: eventOrgId,
        actor_user_id: user.id,
        type: resendSuccess ? "email.sent" : "email.failed",
        entity_type: "quote",
        entity_id: quoteId,
        metadata: {
          source: "quote",
          ...(resendError ? { error: resendError.substring(0, 500) } : {}),
        },
      });
    }

    if (!resendSuccess) {
      return new Response(
        JSON.stringify({ error: `Failed to send email: ${resendError}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, emailId: resendMessageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-quote-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
