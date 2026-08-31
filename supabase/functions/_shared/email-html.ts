// Shared outbound-email HTML helpers used by every send function:
//  - A/B subject selection
//  - hidden preheader/preview text
// (Suppression + List-Unsubscribe helpers live here too once deliverability lands.)

/** Pick subject A or B 50/50. Falls back to A when B is missing/identical. */
export function pickSubjectVariant(
  a: string,
  b?: string | null,
): { subject: string; variant: "a" | "b" } {
  if (!b || b.trim() === "" || b === a) return { subject: a, variant: "a" };
  return Math.random() < 0.5 ? { subject: a, variant: "a" } : { subject: b, variant: "b" };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Hidden preheader/preview text. Inbox clients show this next to the subject.
 * The second span of zero-width characters pushes the email body out of the
 * preview so it doesn't bleed in after the preheader. Returns "" when empty.
 * Must be placed at the very TOP of the HTML body.
 */
export function preheaderSpan(preheader?: string | null): string {
  if (!preheader || !preheader.trim()) return "";
  const safe = escapeHtml(preheader.trim());
  const hide =
    "display:none!important;visibility:hidden;opacity:0;height:0;width:0;max-height:0;max-width:0;overflow:hidden;mso-hide:all;";
  const spacer = "&#847;&zwnj;&nbsp;&#8199;&#65279;".repeat(6);
  return `<span style="${hide}">${safe}</span><span style="${hide}">${spacer}</span>`;
}

// ── Deliverability: suppression + one-click unsubscribe ──────────────────

/** True if this recipient is on the org's suppression list (bounce/complaint/unsub). */
export async function isSuppressed(
  supabase: any,
  orgId: string | null | undefined,
  email: string | null | undefined,
): Promise<boolean> {
  if (!orgId || !email) return false;
  const { data } = await supabase
    .from("suppressed_emails")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("email", email)
    .maybeSingle();
  return !!data;
}

function b64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmacHex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Stateless unsubscribe token: base64url("orgId|email|HMAC(orgId|email)"). */
export async function makeUnsubToken(secret: string, orgId: string, email: string): Promise<string> {
  const sig = await hmacHex(secret, `${orgId}|${email}`);
  return b64url(`${orgId}|${email}|${sig}`);
}

/** Verify a token; returns {orgId,email} when valid, else null. */
export async function verifyUnsubToken(
  secret: string,
  token: string,
): Promise<{ orgId: string; email: string } | null> {
  try {
    const raw = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const [orgId, email, sig] = raw.split("|");
    if (!orgId || !email || !sig) return null;
    const expected = await hmacHex(secret, `${orgId}|${email}`);
    return sig === expected ? { orgId, email } : null;
  } catch {
    return null;
  }
}

export function unsubUrl(supabaseUrl: string, token: string): string {
  return `${supabaseUrl}/functions/v1/unsubscribe?token=${encodeURIComponent(token)}`;
}

export function unsubHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export function unsubFooterHtml(url: string, market = "SE"): string {
  const label =
    market === "DE" ? "Abmelden"
    : (market === "ES" || market === "MX" || market === "AR") ? "Darse de baja"
    : market === "SE" ? "Avregistrera"
    : "Unsubscribe";
  return `<div style="margin-top:18px;font-size:11px;color:#9ca3af;">` +
    `<a href="${url}" style="color:#9ca3af;text-decoration:underline;">${label}</a></div>`;
}
