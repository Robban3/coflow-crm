import { createClient } from "npm:@supabase/supabase-js@2";
import { logActivityEvent } from "../_shared/activity-logger.ts";
import { fetchWithTimeout } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate user
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { draftIds } = await req.json();
    if (!Array.isArray(draftIds) || draftIds.length === 0) {
      return new Response(JSON.stringify({ error: "draftIds array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (draftIds.length > 100) {
      return new Response(JSON.stringify({ error: "Max 100 drafts per call" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user profile + org settings
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, sender_display_name, company_name, company_website, company_logo_url, email_signature, email_footer, organization_id")
      .eq("id", userId)
      .single();

    const orgId = profile?.organization_id;
    if (!orgId) {
      return new Response(JSON.stringify({ error: "User has no organization" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch drafts with strict org ownership check
    const { data: drafts, error: draftsError } = await supabase
      .from("prospecting_drafts")
      .select("id, organization_id, lead_id, subject, body, status")
      .in("id", draftIds)
      .eq("organization_id", orgId)
      .in("status", ["draft", "approved"]);

    if (draftsError || !drafts?.length) {
      return new Response(JSON.stringify({ error: "No approved drafts found for your organization" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (drafts.length !== draftIds.length) {
      return new Response(JSON.stringify({ error: "One or more drafts are not accessible" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("sender_email, sender_name, resend_api_key_configured, name")
      .eq("id", orgId)
      .single();

    // Determine Resend key + from address
    const RESEND_API_KEY_KODCO = Deno.env.get("RESEND_API_KEY");
    const RESEND_API_KEY_PLATFORM = Deno.env.get("RESEND_API_KEY_PLATFORM");
    if (!RESEND_API_KEY_KODCO && !RESEND_API_KEY_PLATFORM) {
      console.error("FATAL: No RESEND_API_KEY configured");
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let fromEmail = "mail@coflow.se";
    let useCustomDomain = false;
    if (org?.sender_email && org?.resend_api_key_configured) {
      fromEmail = org.sender_email;
      useCustomDomain = true;
    }

    const fromName = profile?.sender_display_name || profile?.full_name || org?.sender_name || "CoFlow";
    const activeResendKey = useCustomDomain ? RESEND_API_KEY_KODCO : RESEND_API_KEY_PLATFORM;
    if (!activeResendKey) {
      return new Response(JSON.stringify({ error: "Resend key not configured for domain" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { draftId: string; status: string; error?: string }[] = [];

    for (const draft of drafts) {
      try {
        // Get lead email
        const { data: lead } = await supabase
          .from("leads")
          .select("email, contact_name, company_name")
          .eq("id", draft.lead_id)
          .eq("organization_id", orgId)
          .single();

        const leadEmail = lead?.email?.trim();
        console.log("Sending draft", draft.id, "to", leadEmail || "NO_EMAIL");

        if (!leadEmail) {
          await supabase
            .from("prospecting_drafts")
            .update({ status: "failed", send_error: "Mailadress saknas – fyll i manuellt", send_attempted_at: new Date().toISOString() })
            .eq("id", draft.id);
          console.log("Result:", draft.id, "failed", "no email");
          results.push({ draftId: draft.id, status: "failed", error: "Mailadress saknas – fyll i manuellt" });
          continue;
        }

        // Detect language of the AI-generated body so we don't bolt a
        // Swedish signature onto an English/German email.
        const bodyLower = (draft.body || "").toLowerCase();
        const bodyLooksSwedish =
          / (och|att|för|till|med|inte|är|jag|vi|ni|på|som)\b/.test(bodyLower) ||
          bodyLower.includes("hej ") ||
          bodyLower.includes("hej,");
        const bodyLooksGerman =
          / (und|der|die|das|für|mit|ist|sehr|geehrte)\b/.test(bodyLower) ||
          bodyLower.includes("guten tag");
        const bodyLooksSpanish =
          / (y|el|la|los|las|para|con|una|que|tu|su|hola)\b/.test(bodyLower) ||
          bodyLower.includes("hola ") ||
          bodyLower.includes("un saludo");
        const draftMarket: "SE" | "US" | "DE" | "ES" =
          bodyLooksSwedish ? "SE" : bodyLooksGerman ? "DE" : bodyLooksSpanish ? "ES" : "US";

        const sigLooksSwedish = (text: string) => {
          const t = text.toLowerCase();
          return (
            t.includes("med vänlig") ||
            t.includes("vänliga hälsningar") ||
            t.includes("mvh") ||
            t.includes("hälsningar")
          );
        };

        // Build HTML body
        let htmlBody = draft.body.replace(/\n/g, "<br>");

        // Append signature — localized to the email body's language.
        const sigParts: string[] = [];
        if (profile?.email_signature && (draftMarket === "SE" || !sigLooksSwedish(profile.email_signature))) {
          sigParts.push(profile.email_signature.replace(/\n/g, "<br>"));
        } else if (draftMarket !== "SE") {
          // Synthesize a localized closing when the saved signature is Swedish
          const closingByMarket = {
            SE: "Med vänlig hälsning,",
            US: "Best regards,",
            DE: "Mit freundlichen Grüßen,",
            ES: "Un saludo,",
          } as const;
          const senderName = profile?.sender_display_name || profile?.full_name || "";
          sigParts.push(`${closingByMarket[draftMarket]}<br>${senderName}`);
        }
        if (profile?.email_footer && (draftMarket === "SE" || !sigLooksSwedish(profile.email_footer))) {
          sigParts.push(profile.email_footer.replace(/\n/g, "<br>"));
        }
        if (sigParts.length) htmlBody += `<br><br>${sigParts.join("<br><br>")}`;

        if (profile?.company_logo_url) {
          const img = `<img src="${profile.company_logo_url}" alt="${profile.company_name || "Logo"}" style="max-height:48px;max-width:200px;object-fit:contain;display:block;margin-top:12px;" />`;
          htmlBody += profile.company_website
            ? `<br><a href="${profile.company_website}" target="_blank" rel="noopener noreferrer">${img}</a>`
            : `<br>${img}`;
        }

        // [PAUSED] CRM reply routing – temporarily disabled
        // const replyToken = useCustomDomain ? null : crypto.randomUUID().replace(/-/g, "").slice(0, 16);
        // const smartReplyTo: string | string[] = useCustomDomain
        //   ? [fromEmail, "reply@coflow.se"]
        //   : `reply+${replyToken}@coflow.se`;
        const replyToken = null;

        // Create sent_emails record
        const { data: sentRecord } = await supabase
          .from("sent_emails")
          .insert({
            lead_id: draft.lead_id,
            sent_by: userId,
            recipient_email: lead.email,
            recipient_name: lead.contact_name,
            subject: draft.subject,
            body: draft.body,
            source: "prospecting",
            organization_id: orgId,
            reply_token: replyToken,
            status: "draft",
          })
          .select("id")
          .single();

        // Add tracking pixel
        if (sentRecord?.id) {
          const pixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${sentRecord.id}`;
          htmlBody += `<img src="${pixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
        }

        // Send via Resend
        const resendResponse = await fetchWithTimeout("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${activeResendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
              from: `${fromName} <${fromEmail}>`,
              to: [lead.email],
              subject: draft.subject,
              html: htmlBody,
              text: draft.body,
              // [PAUSED] reply_to: smartReplyTo,
            }),
        });

        const resendText = await resendResponse.text();

        if (!resendResponse.ok) {
          console.error("Resend error:", JSON.stringify({ status: resendResponse.status, body: resendText }, null, 2));

          // Update draft + sent_emails
          await supabase.from("prospecting_drafts").update({
            status: "failed",
            send_error: resendText.substring(0, 500),
            send_attempted_at: new Date().toISOString(),
          }).eq("id", draft.id);

          if (sentRecord?.id) {
            await supabase.from("sent_emails").update({
              send_error: resendText.substring(0, 500),
              send_attempted_at: new Date().toISOString(),
              status: "failed",
            }).eq("id", sentRecord.id);
          }

          results.push({ draftId: draft.id, status: "failed", error: resendText.substring(0, 200) });
          continue;
        }

        const resendData = JSON.parse(resendText);
        const resendMessageId = resendData.id || null;
        console.log("Resend success, id:", resendMessageId);

        // Update draft
        await supabase.from("prospecting_drafts").update({
          status: "sent",
          resend_message_id: resendMessageId,
          sent_at: new Date().toISOString(),
          send_attempted_at: new Date().toISOString(),
        }).eq("id", draft.id);

        // Update sent_emails
        if (sentRecord?.id) {
          await supabase.from("sent_emails").update({
            resend_email_id: resendMessageId,
            send_attempted_at: new Date().toISOString(),
            status: "sent",
          }).eq("id", sentRecord.id);
        }

        // Log activity only after success
        if (orgId) {
          await logActivityEvent(supabase, {
            organization_id: orgId,
            actor_user_id: userId,
            type: "email.sent",
            entity_type: "sent_email",
            entity_id: sentRecord?.id,
            metadata: { source: "prospecting", lead_id: draft.lead_id },
          });
        }

        // Insert into activities table
        await supabase.from("activities").insert({
          lead_id: draft.lead_id,
          user_id: userId,
          organization_id: orgId,
          type: "email",
          title: "Prospekteringsmail skickat: " + draft.subject,
          description: "Prospekteringsmail skickat: " + draft.subject,
          completed_at: new Date().toISOString(),
        }).then(() => {});

        // Remove lead from prospecting queue after successful send
        await supabase.from("leads").update({
          enrichment_status: "sent",
        }).eq("id", draft.lead_id);

        console.log("Result:", draft.id, "sent", resendMessageId);
        results.push({ draftId: draft.id, status: "sent" });
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Draft ${draft.id} error:`, errMsg);

        await supabase.from("prospecting_drafts").update({
          status: "failed",
          send_error: errMsg.substring(0, 500),
          send_attempted_at: new Date().toISOString(),
        }).eq("id", draft.id);

        results.push({ draftId: draft.id, status: "failed", error: errMsg.substring(0, 200) });
      }

      // 300ms delay between sends (Resend rate limit protection)
      await new Promise((r) => setTimeout(r, 300));
    }

    const sent = results.filter((r) => r.status === "sent").length;
    const failed = results.filter((r) => r.status === "failed").length;

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-prospecting-batch FATAL:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
