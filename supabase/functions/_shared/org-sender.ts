// Shared sender resolution for internal/transactional emails.
//
// Internal notifications used to be hardcoded to "mail@coflow.se". If that
// domain isn't verified on the Resend account — but the organisation's own
// sender domain is (the one used for customer emails) — those internal mails
// failed silently while customer mail went through. This resolves the org's
// configured, verified sender (the exact same one customer emails use) and
// sends with a fallback to mail@coflow.se, so whichever domain is verified
// actually delivers.

interface OrgSender {
  fromName: string;
  /** Sender addresses to try in order (org's verified sender first). */
  fromCandidates: string[];
}

// deno-lint-ignore no-explicit-any
export async function resolveOrgSender(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  organizationId: string | null,
  fallbackName = "CoFlow",
): Promise<OrgSender> {
  let fromName = fallbackName;
  let fromEmail = "mail@coflow.se";
  if (organizationId) {
    const { data: org } = await supabase
      .from("organizations")
      .select("name, sender_email, sender_name, resend_api_key_configured")
      .eq("id", organizationId)
      .single();
    fromName = org?.sender_name || org?.name || fallbackName;
    if (org?.resend_api_key_configured && org?.sender_email) {
      fromEmail = org.sender_email;
    }
  }
  return { fromName, fromCandidates: [...new Set([fromEmail, "mail@coflow.se"])] };
}

// Sends an email trying each candidate sender until one is accepted by Resend.
// Resend resolves with { error } (it does not throw) on a rejected sender, so
// we check that and fall through to the next candidate.
// deno-lint-ignore no-explicit-any
export async function sendWithFallback(
  // deno-lint-ignore no-explicit-any
  resend: any,
  sender: OrgSender,
  payload: { to: string[]; subject: string; html: string; replyTo?: string },
): Promise<{ id: string | null; error: unknown }> {
  let lastError: unknown = null;
  for (const addr of sender.fromCandidates) {
    const { data, error } = await resend.emails.send({
      from: `${sender.fromName} <${addr}>`,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
    });
    if (error) {
      lastError = error;
      console.error(`[org-sender] Resend error from ${addr}:`, JSON.stringify(error));
      continue;
    }
    console.log(`[org-sender] Email sent from ${addr}:`, data?.id);
    return { id: data?.id ?? null, error: null };
  }
  return { id: null, error: lastError };
}
