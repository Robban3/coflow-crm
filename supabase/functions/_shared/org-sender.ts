// Shared sender resolution for internal/transactional emails.
//
// The org has two Resend accounts: the platform key (RESEND_API_KEY_PLATFORM,
// which DKIM-signs mail@coflow.se) and the org's own key (RESEND_API_KEY_KODCO,
// which DKIM-signs the org's configured sender domain). To pass DKIM at Gmail,
// the signing KEY must match the From domain — exactly like the customer-outreach
// functions (send-sequence-email). So each From candidate carries its own key
// env; we try the org's verified sender first, then fall back to coflow.se.

import { Resend } from "npm:resend@2.0.0";

interface FromCandidate {
  addr: string;
  keyEnv: string;
}

interface OrgSender {
  fromName: string;
  /** From addresses to try in order, each paired with its Resend key env. */
  fromCandidates: FromCandidate[];
}

// deno-lint-ignore no-explicit-any
export async function resolveOrgSender(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string | null,
  fallbackName = "CoFlow",
): Promise<OrgSender> {
  let fromName = fallbackName;
  const platform: FromCandidate = { addr: "mail@coflow.se", keyEnv: "RESEND_API_KEY_PLATFORM" };
  const candidates: FromCandidate[] = [];
  if (organizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, sender_email, sender_name, resend_api_key_configured")
      .eq("id", organizationId)
      .single();
    fromName = org?.sender_name || org?.name || fallbackName;
    if (org?.resend_api_key_configured && org?.sender_email) {
      // Org's own verified domain → sign with the org's Resend key.
      candidates.push({ addr: org.sender_email, keyEnv: "RESEND_API_KEY_KODCO" });
    }
  }
  // Always keep coflow.se (platform key) as the last-resort candidate.
  if (!candidates.some((c) => c.addr === platform.addr)) candidates.push(platform);
  return { fromName, fromCandidates: candidates };
}

// Sends an email trying each candidate From address with the Resend key that
// matches its domain (so DKIM signs with the right account). Resend resolves
// with { error } (it does not throw) on a rejected sender, so we check that —
// and skip candidates whose key env isn't configured — and fall through.
export async function sendWithFallback(
  sender: OrgSender,
  payload: { to: string[]; subject: string; html: string; replyTo?: string },
): Promise<{ id: string | null; error: unknown }> {
  let lastError: unknown = null;
  for (const cand of sender.fromCandidates) {
    const key = Deno.env.get(cand.keyEnv)
      || Deno.env.get("RESEND_API_KEY_PLATFORM")
      || Deno.env.get("RESEND_API_KEY");
    if (!key) {
      console.warn(`[org-sender] No Resend key for ${cand.addr} (${cand.keyEnv}); skipping`);
      continue;
    }
    const resend = new Resend(key);
    const { data, error } = await resend.emails.send({
      from: `${sender.fromName} <${cand.addr}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    });
    if (error) {
      lastError = error;
      console.error(`[org-sender] Resend error from ${cand.addr}:`, JSON.stringify(error));
      continue;
    }
    console.log(`[org-sender] Email sent from ${cand.addr} (${cand.keyEnv}):`, data?.id);
    return { id: data?.id ?? null, error: null };
  }
  return { id: null, error: lastError };
}
