import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { MARKET_FLAG, useMarket } from "@/hooks/useMarket";
import { useAllowedMarkets } from "@/hooks/useAllowedMarkets";
import { useTranslation } from "@/i18n/LanguageProvider";

interface MarketSelectorProps {
  className?: string;
}

/**
 * Segmented control for selecting active market. Only markets the current user
 * is allowed to use are shown (admin-controlled via user_markets). The selection
 * is persisted via the `useMarket` hook (localStorage).
 */
export default function MarketSelector({ className }: MarketSelectorProps) {
  const { market, setMarket } = useMarket();
  const { allowedMarkets } = useAllowedMarkets();
  const { t } = useTranslation();

  // If the currently-selected market has been disabled for this user, fall back
  // to their first allowed market so the view never sits on a hidden market.
  useEffect(() => {
    if (allowedMarkets.length > 0 && !allowedMarkets.includes(market)) {
      setMarket(allowedMarkets[0]);
    }
  }, [allowedMarkets, market, setMarket]);

  return (
    <div
      role="radiogroup"
      aria-label={t("prospecting.selectMarket")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted p-1",
        className,
      )}
    >
      {allowedMarkets.map((m) => {
        const active = market === m;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setMarket(m)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/60",
            )}
          >
            <span aria-hidden className="text-base leading-none">{MARKET_FLAG[m]}</span>
            <span>{t(`market.${m}`)}</span>
          </button>
        );
      })}
    </div>
  );
}
