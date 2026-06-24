// TEMPORARY diagnostic endpoint: sends a test email via Resend from both the
// coflow.se and kodco.se sender domains and returns Resend's raw response for
// each, so we can see exactly which domain Resend accepts. Recipient is clamped
// to the owner's own addresses so this can't be abused to send to anyone.
// Remove this function once email delivery is confirmed.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_RECIPIENTS = ["robert@applabbet.com", "rvdv1122@gmail.com"];

const FROMS = [
  { label: "coflow.se", from: "CoFlow <mail@coflow.se>" },
  { label: "kodco.se", from: "Kod & Co <hej@kodco.se>" },
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const apiKey = Deno.env.get("RESEND_API_KEY_PLATFORM") || Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY not configured" }, 500);

  let to = "robert@applabbet.com";
  try {
    const body = await req.json();
    if (body?.to && ALLOWED_RECIPIENTS.includes(String(body.to))) to = String(body.to);
  } catch (_e) { /* default recipient */ }

  const results: Array<Record<string, unknown>> = [];
  for (const f of FROMS) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: f.from,
          to: [to],
          subject: `CoFlow testmail (avsändare: ${f.label})`,
          html: `<p>Testmail från CoFlow CRM via Resend.</p><p>Avsändardomän: <strong>${f.label}</strong></p>`,
          text: `Testmail från CoFlow CRM via Resend. Avsändardomän: ${f.label}`,
        }),
      });
      const respBody = await res.json().catch(() => ({}));
      results.push({ from: f.label, httpStatus: res.status, ok: res.ok, resend: respBody });
    } catch (e) {
      results.push({ from: f.label, error: String(e) });
    }
  }

  return json({ to, keyUsed: Deno.env.get("RESEND_API_KEY_PLATFORM") ? "PLATFORM" : "DEFAULT", results });
});
