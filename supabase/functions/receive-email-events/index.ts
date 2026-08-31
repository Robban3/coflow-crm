// Resend delivery-event webhook: records delivered/bounced/complained on
// sent_emails and adds hard bounces + complaints to the org suppression list so
// we never re-email them. Public endpoint (verify_jwt=false) — the Svix
// signature is the ONLY thing separating a real Resend event from a forgery, so
// it is fail-closed. Register this URL as a SECOND Resend webhook endpoint
// (subscribed to email.delivered / email.bounced / email.complained) with its
// own secret RESEND_EVENTS_WEBHOOK_SECRET.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, svix-id, svix-timestamp, svix-signature",
};

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
    const provided = svixSignature.split(" ").map((p) => p.split(",")[1] ?? p);
    return provided.some((p) => p === expected);
  } catch (e) {
    console.error("Svix verification error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const rawBody = await req.text();

    const webhookSecret = Deno.env.get("RESEND_EVENTS_WEBHOOK_SECRET") || Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("RESEND_EVENTS_WEBHOOK_SECRET missing – rejecting");
      return new Response(JSON.stringify({ error: "Webhook not configured" }), {
        status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(await verifySvixSignature(req, rawBody, webhookSecret))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(rawBody);
    const type: string = event?.type || "";
    const data = event?.data || {};
    const emailId: string | undefined = data.email_id || data.id;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Find the originating email (for org + recipient).
    let sentRow: { id: string; organization_id: string | null; recipient_email: string | null } | null = null;
    if (emailId) {
      const { data: row } = await supabase
        .from("sent_emails")
        .select("id, organization_id, recipient_email")
        .eq("resend_email_id", emailId)
        .maybeSingle();
      sentRow = row;
    }

    const recipient: string | undefined =
      sentRow?.recipient_email || (Array.isArray(data.to) ? data.to[0] : data.to) || undefined;

    const suppress = async (reason: string) => {
      if (!sentRow?.organization_id || !recipient) return;
      await supabase.from("suppressed_emails").upsert(
        { organization_id: sentRow.organization_id, email: recipient, reason },
        { onConflict: "organization_id,email", ignoreDuplicates: true },
      );
    };

    if (type === "email.delivered") {
      if (sentRow) await supabase.from("sent_emails").update({ delivered_at: new Date().toISOString() }).eq("id", sentRow.id);
    } else if (type === "email.bounced") {
      const bounceType = (data.bounce?.type || data.type || "").toString().toLowerCase();
      const hard = bounceType.includes("hard") || bounceType.includes("permanent");
      if (sentRow) {
        await supabase.from("sent_emails").update({
          bounced_at: new Date().toISOString(),
          bounce_type: hard ? "hard" : "soft",
          ...(hard ? { status: "failed" } : {}),
        }).eq("id", sentRow.id);
      }
      if (hard) await suppress("hard_bounce");
    } else if (type === "email.complained") {
      if (sentRow) await supabase.from("sent_emails").update({ bounce_type: "complaint" }).eq("id", sentRow.id);
      await suppress("complaint");
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("receive-email-events error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
