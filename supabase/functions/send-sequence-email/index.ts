import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { logActivityEvent } from "../_shared/activity-logger.ts";
import { validateSendSequenceRequest, sanitizeForHtml } from "../_shared/validation.ts";
import {
  buildOutreachSystemPrompt,
  buildOutreachUserPrompt,
  parseOutreachResponse,
  appendSignature,
  type OutreachContext,
} from "../_shared/outreach-prompt.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const rawBody = await req.json();

  try {
    const validation = validateSendSequenceRequest(rawBody);

    if (!validation.success || !validation.data) {
      return new Response(
        JSON.stringify({ error: validation.error || "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { leadSequenceId, stepId, executionId, preApproved, approvedSubject, approvedBody } = validation.data;

    const RESEND_API_KEY_KODCO = Deno.env.get("RESEND_API_KEY");
    const RESEND_API_KEY_PLATFORM = Deno.env.get("RESEND_API_KEY_PLATFORM");
    if (!RESEND_API_KEY_KODCO && !RESEND_API_KEY_PLATFORM) {
      throw new Error("No RESEND_API_KEY configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authorization: allow system calls (service-role bearer) or validate user owns/belongs to the lead sequence
    const authHeader = req.headers.get("Authorization") || "";
    const bearer = authHeader.replace(/^Bearer\s+/i, "");
    const isSystemCall = bearer && bearer === supabaseKey;

    // Get the lead sequence with lead and sequence info
    const { data: leadSequence, error: lsError } = await supabase
      .from("lead_sequences")
      .select(`
        *,
        lead:leads(*),
        sequence:outreach_sequences(*)
      `)
      .eq("id", leadSequenceId)
      .single();

    if (lsError || !leadSequence) {
      throw new Error("Lead sequence not found");
    }

    if (!isSystemCall) {
      // Require a valid user JWT
      if (!bearer) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
      if (userErr || !userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userId = userData.user.id;
      // Ownership: same org as the sequence OR creator
      if (leadSequence.created_by !== userId) {
        const { data: callerProfile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", userId)
          .maybeSingle();
        if (!callerProfile || callerProfile.organization_id !== leadSequence.organization_id) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const lead = leadSequence.lead;
    if (!lead.email) {
      throw new Error("Lead has no email address");
    }

    // Get the step details
    const { data: step, error: stepError } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("id", stepId)
      .single();

    if (stepError || !step) {
      throw new Error("Step not found");
    }

    // Get total steps count
    const { count: totalSteps } = await supabase
      .from("sequence_steps")
      .select("*", { count: "exact", head: true })
      .eq("sequence_id", leadSequence.sequence_id);

    // Get user profile for signature and sender name
    const { data: profile } = await supabase
      .from("profiles")
      .select("*, sender_display_name, organization_id")
      .eq("id", leadSequence.created_by)
      .single();

    // Get organization email settings
    let orgEmail = "noreply@resend.dev";
    let orgName = profile?.sender_display_name || profile?.full_name || profile?.company_name || "CRM";
    let useCustomDomain = false;

    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("sender_email, sender_name, resend_api_key_configured, name")
        .eq("id", profile.organization_id)
        .single();

      if (org) {
        if (org.name === "Kod & Co." && org.sender_email === "hej@kodco.se") {
          orgEmail = "hej@kodco.se";
          useCustomDomain = true;
        } else if (org.sender_email && org.resend_api_key_configured) {
          orgEmail = org.sender_email;
          useCustomDomain = true;
        } else {
          orgEmail = "mail@coflow.se";
        }

        if (org.sender_name) {
          orgName = profile?.sender_display_name || org.sender_name;
        }
      }
    }

    let emailContent: { subject: string; body: string };

    // Use pre-approved content if available
    if (preApproved && approvedSubject && approvedBody) {
      emailContent = {
        subject: approvedSubject,
        body: approvedBody,
      };
    } else {
      // Get web analyses for context
      const { data: analyses } = await supabase
        .from("web_analyses")
        .select("*")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false })
        .limit(1);

      const analysis = analyses?.[0];

      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is not configured");
      }

      // Build context using shared module
      const ctx: OutreachContext = {
        companyName: lead.company_name || undefined,
        contactName: lead.contact_name || undefined,
        tone: profile?.outreach_tone || "standard",
        stepNumber: step.step_order,
        totalSteps: totalSteps || undefined,
        stepPrompt: step.email_prompt || undefined,
        senderName: profile?.full_name || undefined,
        senderCompany: profile?.company_name || undefined,
      };

      if (analysis) {
        ctx.webAnalysis = {
          performanceScore: analysis.performance_score ?? 0,
          seoScore: analysis.seo_score ?? 0,
          accessibilityScore: analysis.accessibility_score ?? 0,
          bestPracticesScore: analysis.best_practices_score ?? 0,
        };
      }

      const systemPrompt = buildOutreachSystemPrompt(ctx);
      const userPrompt = buildOutreachUserPrompt(ctx);

      const aiResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      });

      if (!aiResponse.ok) {
        const errorText = await aiResponse.text();
        console.error("AI gateway error:", aiResponse.status, errorText);
        throw new Error("Failed to generate email content");
      }

      const aiData = await aiResponse.json();
      const content = aiData.choices?.[0]?.message?.content;

      const parsed = parseOutreachResponse(content, lead.company_name || undefined);

      // Append signature from profile (localized for the sequence's market)
      const seqMarket: "SE" | "US" | "DE" =
        (leadSequence.sequence?.market as "SE" | "US" | "DE") || "SE";
      emailContent = {
        subject: parsed.subject,
        body: appendSignature(parsed.body_without_signature, profile, seqMarket),
      };
    }

    // [PAUSED] CRM reply routing – temporarily disabled
    // const replyToken = useCustomDomain ? null : crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    // const smartReplyTo = useCustomDomain ? "reply@coflow.se" : `reply+${replyToken}@coflow.se`;
    const replyToken = null;

    const fromEmail = orgEmail;
    const fromName = orgName;
    // [PAUSED] CRM reply routing
    // const replyTo: string | string[] = useCustomDomain ? [orgEmail, smartReplyTo] : smartReplyTo;

    // Build HTML email with signature and logo
    let htmlBody = sanitizeForHtml(emailContent.body).replace(/\n/g, "<br>");

    // Add clickable logo if available
    if (profile?.company_logo_url) {
      const logoAlt = sanitizeForHtml(profile.company_name || "Logo");
      const logoHtml = profile.company_website
        ? `<a href="${profile.company_website}" target="_blank" rel="noopener noreferrer" style="display:inline-block;margin-top:16px;"><img src="${profile.company_logo_url}" alt="${logoAlt}" style="max-height:48px;max-width:200px;object-fit:contain;" /></a>`
        : `<img src="${profile.company_logo_url}" alt="${logoAlt}" style="max-height:48px;max-width:200px;margin-top:16px;object-fit:contain;" />`;
      htmlBody += `<br><br>${logoHtml}`;
    }

    // Create sent_emails record first to get ID for tracking pixel
    const { data: sentEmailRecord, error: insertError } = await supabase
      .from("sent_emails")
      .insert({
        lead_id: lead.id,
        sent_by: leadSequence.created_by,
        recipient_email: lead.email,
        recipient_name: lead.contact_name,
        subject: emailContent.subject,
        body: emailContent.body,
        source: "sequence",
        sequence_execution_id: executionId,
        organization_id: profile?.organization_id || null,
        reply_token: replyToken, // null for custom domain orgs
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error creating sent_emails record:", insertError);
    }

    // Add tracking pixel
    if (sentEmailRecord?.id) {
      const trackingPixelUrl = `${supabaseUrl}/functions/v1/track-email-open?id=${sentEmailRecord.id}`;
      htmlBody += `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    }

    const emailPayload: Record<string, unknown> = {
      from: `${fromName} <${fromEmail}>`,
      to: [lead.email],
      subject: emailContent.subject,
      html: htmlBody,
    };

    // [PAUSED] CRM reply routing
    // if (replyTo) {
    //   emailPayload.reply_to = replyTo;
    // }

    // Select API key based on domain
    const activeResendKey = useCustomDomain ? RESEND_API_KEY_KODCO : RESEND_API_KEY_PLATFORM;
    if (!activeResendKey) throw new Error(`RESEND API key not configured for ${useCustomDomain ? "custom domain" : "platform"}`);

    let resendSuccess = false;
    let resendMessageId: string | null = null;
    let resendError: string | null = null;

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${activeResendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      const resendText = await resendResponse.text();

      if (!resendResponse.ok) {
        resendError = resendText;
        console.error("Resend error:", JSON.stringify({ status: resendResponse.status, body: resendText }, null, 2));
      } else {
        const emailResponse = JSON.parse(resendText);
        resendMessageId = emailResponse.id || null;
        resendSuccess = true;
        console.log("Resend success, email id:", emailResponse.id);
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
    if (profile?.organization_id) {
      await logActivityEvent(supabase, {
        organization_id: profile.organization_id,
        actor_user_id: leadSequence.created_by,
        type: resendSuccess ? "email.sent" : "email.failed",
        entity_type: "sent_email",
        entity_id: sentEmailRecord?.id,
        metadata: {
          source: "sequence",
          lead_id: lead.id,
          sequence_id: leadSequence.sequence_id,
          ...(resendError ? { error: resendError.substring(0, 500) } : {}),
        },
      });
    }

    if (!resendSuccess) {
      throw new Error(`Failed to send email: ${resendError}`);
    }

    // Update execution record
    await supabase
      .from("sequence_step_executions")
      .update({
        status: "completed",
        executed_at: new Date().toISOString(),
        generated_subject: emailContent.subject,
        generated_body: emailContent.body,
      })
      .eq("id", executionId);

    // Update lead sequence progress
    const nextStepOrder = step.step_order + 1;
    const { data: nextStep } = await supabase
      .from("sequence_steps")
      .select("*")
      .eq("sequence_id", leadSequence.sequence_id)
      .eq("step_order", nextStepOrder)
      .single();

    if (nextStep) {
      const nextStepAt = new Date();
      nextStepAt.setDate(nextStepAt.getDate() + (nextStep.delay_days || 0));

      await supabase
        .from("lead_sequences")
        .update({
          current_step: nextStepOrder,
          next_step_at: nextStepAt.toISOString(),
        })
        .eq("id", leadSequenceId);

      await supabase.from("sequence_step_executions").insert({
        lead_sequence_id: leadSequenceId,
        step_id: nextStep.id,
        status: "pending",
        scheduled_at: nextStepAt.toISOString(),
      });
    } else {
      await supabase
        .from("lead_sequences")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          next_step_at: null,
        })
        .eq("id", leadSequenceId);
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendMessageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      if (rawBody?.executionId) {
        await supabase
          .from("sequence_step_executions")
          .update({
            status: "failed",
            error_message: error instanceof Error ? error.message : "Unknown error",
          })
          .eq("id", rawBody.executionId);
      }
    } catch (updateError) {
      console.error("Failed to update execution error:", updateError);
    }

    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
