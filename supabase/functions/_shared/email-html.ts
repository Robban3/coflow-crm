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
