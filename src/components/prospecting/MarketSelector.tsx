import { cn } from "@/lib/utils";
import { MARKET_FLAG, useMarket, type Market } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

const MARKETS: Market[] = ["SE", "US", "DE", "ES", "UK", "KR", "CA", "AU", "IE"];

interface MarketSelectorProps {
  className?: string;
}

/**
 * Segmented control for selecting active market (SE/US/DE).
 * The selection is persisted via the `useMarket` hook (localStorage).
 */
export default function MarketSelector({ className }: MarketSelectorProps) {
  const { market, setMarket } = useMarket();
  const { t } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label={t("prospecting.selectMarket")}
      className={cn(
        "inline-flex items-center gap-1 rounded-lg bg-muted p-1",
        className,
      )}
    >
      {MARKETS.map((m) => {
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
