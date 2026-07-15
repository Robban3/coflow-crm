import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ALL_MARKETS, type Market } from "@/hooks/useMarket";

/**
 * Markets the CURRENT user is allowed to use. A missing `user_markets` row means
 * the market is enabled (default-on); an admin disables one by storing
 * `enabled=false`. Used to filter the prospecting market selector per user.
 */
export function useAllowedMarkets() {
  const { user } = useAuth();
  const [disabled, setDisabled] = useState<Set<Market>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user?.id) {
      setDisabled(new Set());
      setIsLoading(false);
      return;
    }
    const { data } = await (supabase as any)
      .from("user_markets")
      .select("market, enabled")
      .eq("user_id", user.id);
    const off = new Set<Market>();
    (data || []).forEach((r: any) => {
      if (r.enabled === false) off.add(r.market as Market);
    });
    setDisabled(off);
    setIsLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const allowedMarkets = ALL_MARKETS.filter((m) => !disabled.has(m));
  const isAllowed = useCallback((m: Market) => !disabled.has(m), [disabled]);

  return { allowedMarkets, isAllowed, isLoading, refetch: load };
}
