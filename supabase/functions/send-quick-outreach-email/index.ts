import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { validateQuickOutreachRequest, sanitizeForHtml } from "../_shared/validation.ts";
import { logActivityEvent } from "../_shared/activity-logger.ts";
import { fetchWithTimeout } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform",
};

function normalizeForIncludes(s: string) {
  return s.replace(/\r\n/g, "\n").trim();
}

function textToHtml(text: string) {
  // Simple, reliable: escape then convert newlines
  return sanitizeForHtml(text).replace(/\n/g, "<br>");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse and validate request body
    const rawBody = await req.json();
    const validation = validateQuickOutreachRequest(rawBody);
    
    if (!validation.success || !validation.data) {
      return new Response(JSON.stringify({ error: validation.error || "Invalid request" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, subject, bodyText, leadId } = validation.data;

    // API keys loaded after we determine which domain to use
    const RESEND_API_KEY_KODCO = Deno.env.get("RESEND_API_KEY");
    const RESEND_API_KEY_PLATFORM = Deno.env.get("RESEND_API_KEY_PLATFORM");
    if (!RESEND_API_KEY_KODCO && !RESEND_API_KEY_PLATFORM) throw new Error("No RESEND_API_KEY configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate token (signing-keys compatible)
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

  // Service client for profile + sending metadata
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name, company_name, company_website, company_logo_url, email_signature, email_footer, sender_display_name, organization_id")
      .eq("id", userId)
      .single();

    // Get organization email settings
    let orgEmail = "noreply@resend.dev";
    let orgName = profile?.sender_display_name || profile?.full_name || profile?.company_name || "CRM";
    let useCustomDomain = false; // Whether org has their own verified domain
    
    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("sender_email, sender_name, resend_api_key_configured, name")
        .eq("id", profile.organization_id)
        .single();
      
      if (org) {
        // Orgs with their own configured + verified domain send from it.
        if (org.sender_email && org.resend_api_key_configured) {
          orgEmail = org.sender_email;
          useCustomDomain = true;
        }
        // Default: use the platform domain (coflow.se).
        else {
          orgEmail = "mail@coflow.se";
        }

        if (org.sender_name) {
          orgName = profile?.sender_display_name || org.sender_name;
        }
      }
    }

    // Get lead info if leadId provided
    let recipientName: string | null = null;
    if (leadId) {
      const { data: lead } = await supabase
        .from("leads")
        .select("contact_name")
        .eq("id", leadId)
        .single();
      recipientName = lead?.contact_name || null;
    }

    // [PAUSED] CRM reply routing – temporarily disabled
    // const replyToken = useCustomDomain ? null : crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    // const smartReplyTo = useCustomDomain ? "reply@coflow.se" : `reply+${replyToken}@coflow.se`;
    const replyToken = null;

    // Create sent_emails record first to get ID for tracking pixel
    const { data: sentEmailRecord, error: insertError } = await supabase
      .from("sent_emails")
      .insert({
        lead_id: leadId || null,
        sent_by: userId,
        recipient_email: to,
        recipient_name: recipientName,
        subject,
        body: bodyText,
        source: "quick_outreach",
        organization_id: profile?.organization_id || null,
        reply_token: replyToken, // null for custom domain orgs
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating sent_emails record:", insertError);
    }

    // From address – reply-to is the sender's real email so replies go to Outlook
    const fromEmail = orgEmail;
    const fromName = orgName;
    // [PAUSED] CRM reply routing
    // const replyTo: string | string[] = useCustomDomain ? [orgEmail, smartReplyTo] : smartReplyTo;

    // Build HTML body
    let html = textToHtml(bodyText);

    // Signature (HTML) - robust duplicate detection
    // The body may already contain a signature appended by the email generation step
    const normalizedBody = normalizeForIncludes(bodyText);
    const normalizedSig = profile?.email_signature ? normalizeForIncludes(profile.email_signature) : "";
    
    // Check multiple markers to detect existing signature
    const bodyAlreadyHasSignature = (() => {
      // Direct signature match
      if (normalizedSig && normalizedBody.includes(normalizedSig)) return true;
      // Check for common signature markers that indicate generation step already added it
      if (normalizedBody.includes("med vänlig hälsning")) return true;
      if (normalizedBody.includes("mvh,")) return true;
      if (normalizedBody.includes("vänliga hälsningar")) return true;
      // Check if the user's full name appears near the end (likely a signature)
      if (profile?.full_name) {
        const nameNorm = normalizeForIncludes(profile.full_name);
        const lastChunk = normalizedBody.slice(-Math.min(normalizedBody.length, 300));
        if (lastChunk.includes(nameNorm)) return true;
      }
      return false;
    })();

    if (!bodyAlreadyHasSignature) {
      const sigParts: string[] = [];
      if (profile?.email_signature) sigParts.push(textToHtml(profile.email_signature));
      if (profile?.email_footer) sigParts.push(textToHtml(profile.email_footer));
      if (sigParts.length > 0) {
        html += `<br><br>${sigParts.join("<br><br>")}`;
      }
    }

    // Logo as IMG (HTML) - sanitize the alt text
    if (profile?.company_logo_url) {
      const alt = sanitizeForHtml(profile.company_name || "Logotyp");
      const img = `<img src="${profile.company_logo_url}" alt="${alt}" style="max-height:48px;max-width:200px;object-fit:contain;display:block;margin-top:12px;" />`;
      html += profile.company_website
        ? `<br><a href="${profile.company_website}" target="_blank" rel="noopener noreferrer" style="display:inline-block;">${img}</a>`
        : `<br>${img}`;
    }

    // Add tracking pixel if we have an email ID
    if (sentEmailRecord?.id) {
      const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${sentEmailRecord.id}`;
      html += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    }

    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject,
      html,
      // include a plain-text fallback
      text: bodyText,
    };
    // [PAUSED] CRM reply routing
    // if (replyTo) emailPayload.reply_to = replyTo;

    // Select API key based on domain
    const activeResendKey = useCustomDomain ? RESEND_API_KEY_KODCO : RESEND_API_KEY_PLATFORM;
    if (!activeResendKey) throw new Error(`RESEND API key not configured for ${useCustomDomain ? 'custom domain' : 'platform'}`);

    let resendSuccess = false;
    let resendMessageId: string | null = null;
    let resendError: string | null = null;
    let resendText = "";

    try {
      const resendResponse = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeResendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      resendText = await resendResponse.text();

      if (!resendResponse.ok) {
        resendError = resendText;
        console.error("Resend error:", JSON.stringify({ status: resendResponse.status, body: resendText }, null, 2));
      } else {
        try {
          const resendData = JSON.parse(resendText);
          resendMessageId = resendData.id || null;
        } catch { /* ignore parse error */ }
        resendSuccess = true;
        console.log("Resend success, email id:", resendMessageId);
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

    // Log activity event only after confirmed success/failure
    if (profile?.organization_id) {
      await logActivityEvent(supabase, {
        organization_id: profile.organization_id,
        actor_user_id: userId,
        type: resendSuccess ? "email.sent" : "email.failed",
        entity_type: "sent_email",
        entity_id: sentEmailRecord?.id,
        metadata: {
          source: "quick_outreach",
          lead_id: leadId,
          ...(resendError ? { error: resendError.substring(0, 500) } : {}),
        },
      });
    }

    if (!resendSuccess) {
      throw new Error(`Failed to send email: ${resendError}`);
    }

    return new Response(resendText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error sending quick outreach email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});