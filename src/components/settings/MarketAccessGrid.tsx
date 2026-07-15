import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Loader2 } from "lucide-react";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { ALL_MARKETS, MARKET_FLAG } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

/**
 * Admin-only grid to enable/disable markets per user. A disabled market is
 * hidden from that user's prospecting market selector. Missing row = enabled.
 */
export function MarketAccessGrid() {
  const { members, getInitials, isLoading: membersLoading } = useTeamMembers();
  const { t } = useTranslation();
  // Keys of disabled cells: `${userId}:${market}`
  const [disabled, setDisabled] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any)
        .from("user_markets")
        .select("user_id, market, enabled");
      const off = new Set<string>();
      (data || []).forEach((r: any) => {
        if (r.enabled === false) off.add(`${r.user_id}:${r.market}`);
      });
      setDisabled(off);
      setLoading(false);
    })();
  }, []);

  const isEnabled = (userId: string, market: string) => !disabled.has(`${userId}:${market}`);

  const toggle = async (userId: string, market: string, enabled: boolean) => {
    const key = `${userId}:${market}`;
    setSaving(key);
    try {
      const { data: existing } = await (supabase as any)
        .from("user_markets")
        .select("id")
        .eq("user_id", userId)
        .eq("market", market)
        .maybeSingle();
      if (existing) {
        await (supabase as any).from("user_markets").update({ enabled }).eq("id", existing.id);
      } else {
        await (supabase as any).from("user_markets").insert({ user_id: userId, market, enabled });
      }
      setDisabled((prev) => {
        const next = new Set(prev);
        if (enabled) next.delete(key);
        else next.add(key);
        return next;
      });
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("settings.marketAccessTitle")}</CardTitle>
        <CardDescription>{t("settings.marketAccessDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading || membersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium py-2 pr-4 sticky left-0 bg-card">{t("settings.marketAccessUser")}</th>
                  {ALL_MARKETS.map((m) => (
                    <th key={m} className="px-2 py-2 text-center font-medium whitespace-nowrap">
                      <span className="mr-1">{MARKET_FLAG[m]}</span>
                      <span className="text-xs text-muted-foreground">{m}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 sticky left-0 bg-card">
                      <div className="flex items-center gap-2 min-w-[180px]">
                        <Avatar className="h-7 w-7">
                          <AvatarImage src={member.avatar_url || undefined} />
                          <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(member)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-medium truncate">{member.full_name || member.email}</p>
                          {member.full_name && <p className="text-xs text-muted-foreground truncate">{member.email}</p>}
                        </div>
                      </div>
                    </td>
                    {ALL_MARKETS.map((m) => (
                      <td key={m} className="px-2 py-2 text-center">
                        <div className="flex justify-center">
                          {saving === `${member.id}:${m}` ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Switch
                              checked={isEnabled(member.id, m)}
                              onCheckedChange={(checked) => toggle(member.id, m, checked)}
                            />
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
