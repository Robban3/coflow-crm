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

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) throw new Error("Unauthorized");

    const { documentId, recipientEmail, recipientName, message, offerUrl } = await req.json();

    if (!documentId || !recipientEmail || !offerUrl) {
      throw new Error("Missing required fields: documentId, recipientEmail, offerUrl");
    }

    // Get document
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) throw new Error("Document not found");

    // Get organization
    const { data: org } = await supabase
      .from("organizations")
      .select("name, logo_url, sender_email, sender_name, resend_api_key_configured")
      .eq("id", doc.organization_id)
      .single();

    // Get sender profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, sender_display_name, company_name, organization_id")
      .eq("id", user.id)
      .single();

    if (!profile?.organization_id || profile.organization_id !== doc.organization_id) {
      throw new Error("Forbidden");
    }

    const senderDisplayName = profile?.sender_display_name || profile?.full_name || org?.sender_name || org?.name || "CoFlow";

    // Determine Resend key and from-address
    const resendApiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
    let fromEmail = "mail@coflow.se";
    if (org?.resend_api_key_configured && org?.sender_email) {
      fromEmail = org.sender_email;
    }

    if (!resendApiKey) throw new Error("RESEND_API_KEY not configured");

    const resend = new Resend(resendApiKey);

    const logoHtml = org?.logo_url
      ? `<img src="${org.logo_url}" alt="${org.name}" style="height:48px;margin-bottom:16px;" /><br/>`
      : "";

    const messageHtml = message
      ? `<p style="font-size:15px;color:#333;line-height:1.6;">${message.replace(/\n/g, "<br/>")}</p>`
      : "";

    const totalFormatted = doc.total != null
      ? Number(doc.total).toLocaleString("sv-SE")
      : "–";

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:0;padding:0;background:#f4f4f5;">
      <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <div style="padding:32px 32px 24px;">
          ${logoHtml}
          <h1 style="font-size:22px;margin:0 0 8px;color:#1a1a1a;">Offert: ${doc.title}</h1>
          <p style="font-size:14px;color:#666;margin:0 0 20px;">${doc.document_number ? `#${doc.document_number} • ` : ""}${totalFormatted} ${doc.currency || "SEK"}</p>
          ${messageHtml}
        </div>
        <div style="padding:16px 32px 32px;">
          <a href="${offerUrl}" style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px;">Visa offert →</a>
        </div>
        <div style="padding:16px 32px;background:#fafafa;border-top:1px solid #eee;">
          <p style="font-size:12px;color:#999;margin:0;">Skickad av ${senderDisplayName} via ${org?.name || "CoFlow"}</p>
        </div>
      </div>
    </body>
    </html>`;

    let resendSuccess = false;
    let resendMessageId: string | null = null;
    let resendError: string | null = null;

    try {
      const emailResult = await resend.emails.send({
        from: `${senderDisplayName} <${fromEmail}>`,
        to: [recipientEmail],
        subject: `Offert: ${doc.title}`,
        html: htmlBody,
      });

      if (emailResult.error) {
        resendError = JSON.stringify(emailResult.error);
        console.error("Resend error:", JSON.stringify(emailResult.error, null, 2));
      } else {
        resendMessageId = emailResult.data?.id || null;
        resendSuccess = true;
        console.log("Resend success, email id:", resendMessageId);
      }
    } catch (err) {
      resendError = err instanceof Error ? err.message : String(err);
      console.error("Resend error:", JSON.stringify(resendError, null, 2));
    }

    if (resendSuccess) {
      // Update document status and recipient info only after successful send
      await supabase
        .from("documents")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipient_email: recipientEmail,
          recipient_name: recipientName || null,
        })
        .eq("id", documentId);

      // Insert document recipient record
      await supabase
        .from("document_recipients")
        .insert({
          document_id: documentId,
          email: recipientEmail,
          name: recipientName || null,
          sent_at: new Date().toISOString(),
        });
    }

    // Log to sent_emails with send result
    const { data: sentEmailRecord } = await supabase
      .from("sent_emails")
      .insert({
        recipient_email: recipientEmail,
        recipient_name: recipientName || null,
        subject: `Offert: ${doc.title}`,
        body: htmlBody,
        sent_by: user.id,
        source: "document",
        organization_id: profile?.organization_id || doc.organization_id,
        resend_email_id: resendMessageId,
        send_error: resendError,
        send_attempted_at: new Date().toISOString(),
        status: resendSuccess ? "sent" : "failed",
      })
      .select("id")
      .single();

    // Log activity event only after confirmed result
    const eventOrgId = profile?.organization_id || doc.organization_id;
    if (eventOrgId) {
      await logActivityEvent(supabase, {
        organization_id: eventOrgId,
        actor_user_id: user.id,
        type: resendSuccess ? "document.sent" : "email.failed",
        entity_type: "document",
        entity_id: documentId,
        metadata: resendError ? { error: resendError.substring(0, 500) } : undefined,
      });
    }

    if (!resendSuccess) {
      throw new Error(`Failed to send document email: ${resendError}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("send-document-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
