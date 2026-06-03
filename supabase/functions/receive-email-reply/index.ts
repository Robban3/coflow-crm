import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NormalizedInboundPayload {
  from: string;
  to: string[];
  subject: string;
  text: string | null;
  html: string | null;
  headers: Record<string, string>;
  inboundEmailId: string | null;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeFrom(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const email = safeString(record.email || record.address);
    const name = safeString(record.name);
    if (name && email) return `${name} <${email}>`;
    if (email) return email;
  }
  return "";
}

function normalizeAddressList(value: unknown): string[] {
  if (!value) return [];

  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const record = item as Record<string, unknown>;
          const email = safeString(record.email || record.address);
          const name = safeString(record.name);
          if (name && email) return `${name} <${email}>`;
          return email;
        }
        return "";
      })
      .filter(Boolean);
  }

  return [];
}

function normalizeHeaders(value: unknown): Record<string, string> {
  if (!value) return {};

  if (Array.isArray(value)) {
    const output: Record<string, string> = {};
    for (const item of value) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const key = safeString(record.name || record.key || record.header);
      const val = safeString(record.value);
      if (key) output[key] = val;
    }
    return output;
  }

  if (value && typeof value === "object") {
    const output: Record<string, string> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      output[k] = safeString(v);
    }
    return output;
  }

  return {};
}

function normalizeInboundPayload(raw: unknown): NormalizedInboundPayload {
  const root = (raw && typeof raw === "object") ? (raw as Record<string, unknown>) : {};
  const data = (root.data && typeof root.data === "object") ? (root.data as Record<string, unknown>) : root;

  const from = normalizeFrom(data.from ?? root.from ?? data.from_email ?? root.from_email ?? data.sender ?? root.sender);
  const to = normalizeAddressList(data.to ?? root.to ?? data.recipients ?? root.recipients);
  const subject = safeString(data.subject ?? root.subject) || "(Inget ämne)";
  const text = safeString(data.text ?? root.text ?? data.text_body ?? root.text_body) || null;
  const html = safeString(data.html ?? root.html ?? data.html_body ?? root.html_body) || null;
  const headers = normalizeHeaders(data.headers ?? root.headers);

  const inboundEmailId =
    safeString(data.email_id ?? root.email_id) ||
    (safeString(root.type) === "email.received" ? safeString(data.id ?? root.id) : "") ||
    null;

  return {
    from,
    to,
    subject,
    text,
    html,
    headers,
    inboundEmailId,
  };
}

async function hydrateFromResendReceivingApi(inboundEmailId: string): Promise<Partial<NormalizedInboundPayload> | null> {
  const resendApiKeys = [
    Deno.env.get("RESEND_API_KEY_PLATFORM"),
    Deno.env.get("RESEND_API_KEY"),
  ].filter(Boolean) as string[];

  for (const key of resendApiKeys) {
    try {
      const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(inboundEmailId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.warn("Failed to hydrate inbound email via Resend API", {
          inboundEmailId,
          status: response.status,
          error: errorText.slice(0, 200),
        });
        continue;
      }

      const json = await response.json();
      const record = (json?.data && typeof json.data === "object") ? json.data : json;

      return {
        from: normalizeFrom((record as Record<string, unknown>)?.from),
        to: normalizeAddressList((record as Record<string, unknown>)?.to),
        subject: safeString((record as Record<string, unknown>)?.subject),
        text: safeString((record as Record<string, unknown>)?.text) || null,
        html: safeString((record as Record<string, unknown>)?.html) || null,
        headers: normalizeHeaders((record as Record<string, unknown>)?.headers),
      };
    } catch (error) {
      console.warn("Error hydrating inbound email via Resend API", {
        inboundEmailId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return null;
}

function extractReplyToken(toAddresses: string[]): string | null {
  for (const address of toAddresses) {
    const match = address.match(/reply\+([a-zA-Z0-9]+)@/i);
    if (match) return match[1];
  }
  return null;
}

function extractSenderName(from: string): { email: string; name: string | null } {
  const safeFrom = safeString(from);
  if (!safeFrom) return { email: "", name: null };

  const nameMatch = safeFrom.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);
  if (nameMatch) {
    return { name: nameMatch[1].trim(), email: nameMatch[2].trim().toLowerCase() };
  }
  return { name: null, email: safeFrom.toLowerCase() };
}

function getHeaderValue(headers: Record<string, string>, key: string): string {
  const lower = key.toLowerCase();
  for (const [k, v] of Object.entries(headers)) {
    if (k.toLowerCase() === lower) return String(v || "");
  }
  return "";
}

function extractPotentialResendIds(headers: Record<string, string>): string[] {
  const inReplyTo = getHeaderValue(headers, "in-reply-to");
  const references = getHeaderValue(headers, "references");
  const combined = `${inReplyTo} ${references}`;

  const matches = combined.match(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/gi);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.toLowerCase())));
}

function normalizeSubject(subject: string | null | undefined): string {
  return (subject || "")
    .replace(/^(\s*(re|sv|fwd|fw)\s*:\s*)+/i, "")
    .trim()
    .toLowerCase();
}

// Verifierar Resend/Svix-webhook-signatur mot rå-body
async function verifySvixSignature(req: Request, body: string, secret: string): Promise<boolean> {
  try {
    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");
    if (!svixId || !svixTimestamp || !svixSignature) return false;

    const secretBytes = Uint8Array.from(
      atob(secret.startsWith("whsec_") ? secret.slice(6) : secret),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw", secretBytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const signedContent = `${svixId}.${svixTimestamp}.${body}`;
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedContent));
    const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

    // svix-signature: mellanslagsseparerade "v1,<base64>"-poster
    const provided = svixSignature.split(" ").map((p) => p.split(",")[1] ?? p);
    return provided.some((p) => p === expected);
  } catch (e) {
    console.error("Svix verification error:", e);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();

    // Verifiera webhook-signatur om hemlighet är konfigurerad (annars logga varning)
    const webhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (webhookSecret) {
      const valid = await verifySvixSignature(req, rawBody, webhookSecret);
      if (!valid) {
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      console.warn("RESEND_WEBHOOK_SECRET ej satt – inkommande webhook verifieras INTE");
    }

    const rawPayload = JSON.parse(rawBody);
    let payload = normalizeInboundPayload(rawPayload);

    if (
      payload.inboundEmailId &&
      (!payload.from || payload.to.length === 0 || (!payload.text && !payload.html))
    ) {
      const hydrated = await hydrateFromResendReceivingApi(payload.inboundEmailId);
      if (hydrated) {
        payload = {
          ...payload,
          from: hydrated.from || payload.from,
          to: hydrated.to?.length ? hydrated.to : payload.to,
          subject: hydrated.subject || payload.subject,
          text: hydrated.text ?? payload.text,
          html: hydrated.html ?? payload.html,
          headers: Object.keys(payload.headers).length ? payload.headers : (hydrated.headers || payload.headers),
        };
      }
    }

    console.log("Received inbound email webhook:", JSON.stringify({
      from: payload.from,
      to: payload.to,
      subject: payload.subject,
      inboundEmailId: payload.inboundEmailId,
    }));

    const sender = extractSenderName(payload.from);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const replyToken = extractReplyToken(payload.to);
    let originalEmail: {
      id: string;
      sent_by: string;
      lead_id: string | null;
      organization_id: string | null;
      recipient_email: string;
      subject: string;
    } | null = null;

    if (replyToken) {
      console.log("Extracted reply token:", replyToken);
      const { data } = await supabase
        .from("sent_emails")
        .select("id, sent_by, lead_id, organization_id, recipient_email, subject")
        .eq("reply_token", replyToken)
        .maybeSingle();
      originalEmail = data;
    }

    if (!originalEmail) {
      const resendIds = extractPotentialResendIds(payload.headers);
      if (resendIds.length > 0) {
        const { data } = await supabase
          .from("sent_emails")
          .select("id, sent_by, lead_id, organization_id, recipient_email, subject, resend_email_id, created_at")
          .in("resend_email_id", resendIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (data) {
          originalEmail = {
            id: data.id,
            sent_by: data.sent_by,
            lead_id: data.lead_id,
            organization_id: data.organization_id,
            recipient_email: data.recipient_email,
            subject: data.subject,
          };
          console.log("Matched original email by thread headers:", data.id);
        }
      }
    }

    if (!originalEmail && sender.email) {
      const normalizedIncomingSubject = normalizeSubject(payload.subject);
      const { data: candidates } = await supabase
        .from("sent_emails")
        .select("id, sent_by, lead_id, organization_id, recipient_email, subject, created_at")
        .eq("recipient_email", sender.email)
        .order("created_at", { ascending: false })
        .limit(20);

      if (candidates?.length) {
        const matched = candidates.find((c) => normalizeSubject(c.subject) === normalizedIncomingSubject) || candidates[0];
        originalEmail = {
          id: matched.id,
          sent_by: matched.sent_by,
          lead_id: matched.lead_id,
          organization_id: matched.organization_id,
          recipient_email: matched.recipient_email,
          subject: matched.subject,
        };
        console.log("Matched original email by sender/subject fallback:", matched.id);
      }
    }

    if (!originalEmail) {
      console.warn("No matching original email found", {
        to: payload.to,
        from: sender.email,
        subject: payload.subject,
        hasReplyToken: !!replyToken,
      });

      return new Response(JSON.stringify({
        success: false,
        reason: "no_matching_original_email",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reply, error: insertError } = await supabase
      .from("email_replies")
      .insert({
        original_email_id: originalEmail.id,
        sent_by: originalEmail.sent_by,
        lead_id: originalEmail.lead_id,
        organization_id: originalEmail.organization_id,
        from_email: sender.email || "unknown@unknown.local",
        from_name: sender.name,
        subject: payload.subject,
        body_text: payload.text,
        body_html: payload.html,
        received_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error saving reply:", insertError);
      throw insertError;
    }

    console.log("Saved reply:", reply?.id);

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", originalEmail.sent_by)
      .single();

    if (profile?.email) {
      const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
      if (RESEND_API_KEY) {
        const forwardSubject = payload.subject?.startsWith("Fwd:")
          ? payload.subject
          : `Fwd: ${payload.subject}`;

        let leadInfo = "";
        if (originalEmail.lead_id) {
          const { data: lead } = await supabase
            .from("leads")
            .select("company_name")
            .eq("id", originalEmail.lead_id)
            .single();
          if (lead?.company_name) {
            leadInfo = ` från ${lead.company_name}`;
          }
        }

        const bodyText = payload.text || "(Inget textinnehåll i webhook)";
        const bodyHtml = payload.html || bodyText.replace(/\n/g, "<br>");

        const forwardHtml = `
          <div style="padding: 16px; background: #f5f5f5; border-radius: 8px; margin-bottom: 16px;">
            <p style="margin: 0 0 8px 0; font-size: 14px; color: #666;">
              <strong>📧 Svar mottaget${leadInfo}</strong><br>
              Från: ${sender.name || sender.email || "Okänd avsändare"} &lt;${sender.email || "okänd"}&gt;<br>
              Ämne: ${payload.subject}
            </p>
            <p style="margin: 0; font-size: 12px; color: #999;">
              Detta mail vidarebefordrades automatiskt från CRM.
            </p>
          </div>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 16px 0;">
          ${bodyHtml}
        `;

        try {
          const forwardResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "CoFlow CRM <noreply@coflow.se>",
              to: [profile.email],
              subject: forwardSubject,
              html: forwardHtml,
              text: `Svar mottaget${leadInfo}\nFrån: ${sender.email || "okänd"}\n\n${bodyText}`,
            }),
          });

          if (forwardResponse.ok) {
            console.log("Email forwarded successfully to:", profile.email);
            await supabase
              .from("email_replies")
              .update({ forwarded_at: new Date().toISOString() })
              .eq("id", reply?.id);
          } else {
            const errorText = await forwardResponse.text();
            console.error("Failed to forward email:", errorText);
          }
        } catch (forwardError) {
          console.error("Error forwarding email:", forwardError);
        }
      }
    }

    await supabase.from("notifications").insert({
      user_id: originalEmail.sent_by,
      type: "email_reply",
      title: "Svar mottaget!",
      message: `${sender.name || sender.email || "En kontakt"} svarade på ditt mail`,
      link: originalEmail.lead_id ? `/leads/${originalEmail.lead_id}` : null,
      metadata: {
        reply_id: reply?.id,
        from_email: sender.email,
        from_name: sender.name,
        subject: payload.subject,
      },
    });

    console.log("Notification created for user:", originalEmail.sent_by);

    return new Response(
      JSON.stringify({
        success: true,
        reply_id: reply?.id,
        forwarded_to: profile?.email || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error processing inbound email:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});