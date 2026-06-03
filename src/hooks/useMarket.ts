import { useCallback, useEffect, useState } from "react";

export type Market = "SE" | "US" | "DE";

const STORAGE_KEY = "coflow_selected_market";
const DEFAULT_MARKET: Market = "SE";

function isMarket(value: unknown): value is Market {
  return value === "SE" || value === "US" || value === "DE";
}

function readStoredMarket(): Market {
  if (typeof window === "undefined") return DEFAULT_MARKET;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return isMarket(raw) ? raw : DEFAULT_MARKET;
  } catch {
    return DEFAULT_MARKET;
  }
}

/**
 * Hook for the user's currently selected market (SE/US/DE).
 * Persists the choice in localStorage and synchronises across tabs/components
 * via a custom `coflow:market-changed` event + the native `storage` event.
 */
export function useMarket(): { market: Market; setMarket: (m: Market) => void } {
  const [market, setMarketState] = useState<Market>(() => readStoredMarket());

  useEffect(() => {
    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent<Market>).detail;
      if (isMarket(detail)) setMarketState(detail);
    };
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && isMarket(e.newValue)) {
        setMarketState(e.newValue);
      }
    };
    window.addEventListener("coflow:market-changed", handleCustom as EventListener);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("coflow:market-changed", handleCustom as EventListener);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  const setMarket = useCallback((next: Market) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore storage failures (private mode etc.)
    }
    setMarketState(next);
    window.dispatchEvent(new CustomEvent<Market>("coflow:market-changed", { detail: next }));
  }, []);

  return { market, setMarket };
}

// ── Market-specific helpers ────────────────────────────────────────────────

export const MARKET_LOCATION_PLACEHOLDER: Record<Market, string> = {
  SE: "Stad eller kommun",
  US: "Stad eller zip-kod",
  DE: "Stadt oder PLZ",
};

export const MARKET_CURRENCY: Record<Market, { code: string; symbol: string; position: "prefix" | "suffix" }> = {
  SE: { code: "SEK", symbol: "kr", position: "suffix" },
  US: { code: "USD", symbol: "$", position: "prefix" },
  DE: { code: "EUR", symbol: "€", position: "suffix" },
};

export const MARKET_PHONE_PREFIX: Record<Market, string> = {
  SE: "+46",
  US: "+1",
  DE: "+49",
};

export const MARKET_AI_LANGUAGE: Record<Market, string> = {
  SE: "svenska",
  US: "amerikansk engelska",
  DE: "tyska",
};

export const MARKET_LABEL: Record<Market, string> = {
  SE: "Sverige",
  US: "USA",
  DE: "Tyskland",
};

export const MARKET_FLAG: Record<Market, string> = {
  SE: "🇸🇪",
  US: "🇺🇸",
  DE: "🇩🇪",
};

/** Format a numeric amount according to the market's currency conventions. */
export function formatMarketCurrency(amount: number, market: Market): string {
  const { symbol, position } = MARKET_CURRENCY[market];
  const rounded = Math.round(amount).toLocaleString(
    market === "SE" ? "sv-SE" : market === "DE" ? "de-DE" : "en-US",
  );
  return position === "prefix" ? `${symbol}${rounded}` : `${rounded} ${symbol}`;
}
