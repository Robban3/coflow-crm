// Shared currency options + formatting for offers, quotes and reports.
export const CURRENCIES = ["SEK", "EUR", "USD", "GBP"] as const;
export type CurrencyCode = typeof CURRENCIES[number];

// Number/locale conventions per currency (grouping + symbol placement).
const LOCALE_BY_CURRENCY: Record<string, string> = {
  SEK: "sv-SE",
  EUR: "de-DE",
  USD: "en-US",
  GBP: "en-GB",
};

/** Format an amount with its currency symbol (e.g. £1,234 / 1 234 kr). */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = "SEK",
  opts?: { decimals?: number },
): string {
  if (amount == null || Number.isNaN(amount)) return "–";
  const decimals = opts?.decimals ?? 0;
  const code = currency || "SEK";
  try {
    return new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] || "sv-SE", {
      style: "currency",
      currency: code,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount);
  } catch {
    // Unknown currency code → fall back to plain number + code suffix.
    return `${amount.toLocaleString("sv-SE")} ${code}`;
  }
}
