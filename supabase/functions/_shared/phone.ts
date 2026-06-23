// Shared phone-number normalisation for edge functions.
//
// Produces canonical E.164 (e.g. "+46701234567") from the raw, loosely
// formatted numbers stored across the CRM (e.g. "070-123 45 67",
// "+46 70 123 45 67", "0701234567"). Defaults to the Swedish numbering plan
// but accepts already-international numbers for any country.
//
// Returns null for input that cannot be turned into a plausible E.164 number,
// so callers can simply skip those entries.

const REGION_DIAL_CODE: Record<string, string> = {
  SE: "46",
  NO: "47",
  DK: "45",
  FI: "358",
};

export function toE164(raw: string | null | undefined, region = "SE"): string | null {
  if (!raw) return null;

  let s = String(raw).trim();
  let international = false;

  if (s.startsWith("+")) {
    international = true;
    s = s.slice(1);
  } else if (s.startsWith("00")) {
    // "00" is the international call prefix in most of Europe.
    international = true;
    s = s.slice(2);
  }

  const digits = s.replace(/\D/g, "");
  if (!digits) return null;

  const dial = REGION_DIAL_CODE[region] ?? "46";

  let full: string;
  if (international) {
    // Digits already include the country code.
    full = digits;
  } else if (digits.startsWith("0")) {
    // National format with a trunk "0" — replace it with the country code.
    full = dial + digits.slice(1);
  } else if (digits.startsWith(dial)) {
    // Country code present but without the leading "+".
    full = digits;
  } else {
    // Bare national number without the trunk "0".
    full = dial + digits;
  }

  // E.164 allows at most 15 digits; require a sane minimum to drop junk.
  if (full.length < 8 || full.length > 15) return null;

  return "+" + full;
}

// Convenience: E.164 without the leading "+", e.g. "46701234567".
// iOS Call Directory entries are Int64, so the "+" must be dropped.
export function toE164Digits(raw: string | null | undefined, region = "SE"): string | null {
  const e164 = toE164(raw, region);
  return e164 ? e164.slice(1) : null;
}
