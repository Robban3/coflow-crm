// One-click unsubscribe endpoint for the List-Unsubscribe header (RFC 8058) and
// the footer link. Public (verify_jwt=false). The token is a stateless HMAC of
// orgId|email (secret UNSUB_SECRET), so no pre-stored token is needed. On a valid
// token we add the address to the org suppression list and stamp sent_emails.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyUnsubToken } from "../_shared/email-html.ts";

const page = (msg: string) =>
  `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Avregistrering</title></head>` +
  `<body style="font-family:system-ui,sans-serif;max-width:480px;margin:64px auto;padding:0 20px;color:#111;text-align:center;">` +
  `<h2 style="font-weight:600;">${msg}</h2></body></html>`;

async function unsubscribe(token: string): Promise<boolean> {
  const secret = Deno.env.get("UNSUB_SECRET");
  if (!secret) {
    console.error("UNSUB_SECRET missing");
    return false;
  }
  const parsed = await verifyUnsubToken(secret, token);
  if (!parsed) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  await supabase.from("suppressed_emails").upsert(
    { organization_id: parsed.orgId, email: parsed.email, reason: "unsubscribe" },
    { onConflict: "organization_id,email", ignoreDuplicates: true },
  );
  await supabase
    .from("sent_emails")
    .update({ unsubscribed_at: new Date().toISOString() })
    .eq("organization_id", parsed.orgId)
    .ilike("recipient_email", parsed.email)
    .is("unsubscribed_at", null);
  return true;
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token") || "";

  // RFC 8058 one-click: email clients POST to unsubscribe.
  if (req.method === "POST") {
    const ok = token ? await unsubscribe(token) : false;
    return new Response(ok ? "Unsubscribed" : "Invalid", { status: ok ? 200 : 400 });
  }

  if (req.method === "GET") {
    const ok = token ? await unsubscribe(token) : false;
    return new Response(
      page(ok ? "Du är nu avregistrerad. Du får inga fler mail." : "Ogiltig eller utgången länk."),
      { status: ok ? 200 : 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }

  return new Response("Method not allowed", { status: 405 });
});
