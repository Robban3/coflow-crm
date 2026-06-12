import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Award, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFrameClasses } from "@/hooks/useAvatarFrame";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/use-toast";
import { format, subMonths } from "date-fns";
import { useTranslation } from "@/i18n/LanguageProvider";

interface SnapshotEntry {
  userId: string | null;
  meetings: number;
  name: string;
  avatar: string | null;
  frame: "gold" | "silver" | "bronze";
}

export function LeaderboardWidget() {
  const organizationId = useOrganizationId();
  const { isAdmin, user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isGenerating, setIsGenerating] = useState(false);

  const { data: snapshot, isLoading } = useQuery({
    queryKey: ["leaderboard-snapshot", organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data } = await supabase
        .from("leaderboard_snapshots")
        .select("top1_user_id, top2_user_id, top3_user_id, top1_meetings, top2_meetings, top3_meetings, month")
        .eq("organization_id", organizationId)
        .order("month", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
  });

  const userIds = snapshot
    ? [snapshot.top1_user_id, snapshot.top2_user_id, snapshot.top3_user_id].filter(Boolean)
    : [];

  const { data: profiles } = useQuery({
    queryKey: ["profiles-snapshot", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .in("id", userIds);
      return data || [];
    },
    enabled: userIds.length > 0,
  });

  const profileMap = new Map((profiles || []).map(p => [p.id, p]));

  const entries: SnapshotEntry[] = snapshot
    ? [
        { userId: snapshot.top1_user_id, meetings: snapshot.top1_meetings || 0, frame: "gold" },
        { userId: snapshot.top2_user_id, meetings: snapshot.top2_meetings || 0, frame: "silver" },
        { userId: snapshot.top3_user_id, meetings: snapshot.top3_meetings || 0, frame: "bronze" },
      ]
        .filter(e => e.userId)
        .map(e => {
          const p = profileMap.get(e.userId!);
          return {
            userId: e.userId,
            meetings: e.meetings,
            frame: e.frame as "gold" | "silver" | "bronze",
            name: p?.full_name || p?.email || t("powerCall.leaderboard.unknown"),
            avatar: p?.avatar_url || null,
          };
        })
    : [];

  const handleGenerateSnapshot = async () => {
    if (!organizationId || !user) return;
    setIsGenerating(true);
    try {
      const prevMonth = subMonths(new Date(), 1);
      const monthStr = format(prevMonth, "yyyy-MM");
      const startISO = new Date(prevMonth.getFullYear(), prevMonth.getMonth(), 1).toISOString();
      const endISO = new Date(prevMonth.getFullYear(), prevMonth.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();

      // Count meeting_booked events per user
      const { data: events } = await supabase
        .from("activity_events")
        .select("actor_user_id")
        .eq("organization_id", organizationId)
        .eq("type", "meeting.booked")
        .gte("occurred_at", startISO)
        .lte("occurred_at", endISO);

      const counts: Record<string, number> = {};
      for (const e of events || []) {
        counts[e.actor_user_id] = (counts[e.actor_user_id] || 0) + 1;
      }

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

      const payload = {
        organization_id: organizationId,
        month: monthStr,
        top1_user_id: sorted[0]?.[0] || null,
        top2_user_id: sorted[1]?.[0] || null,
        top3_user_id: sorted[2]?.[0] || null,
        top1_meetings: sorted[0]?.[1] || 0,
        top2_meetings: sorted[1]?.[1] || 0,
        top3_meetings: sorted[2]?.[1] || 0,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("leaderboard_snapshots")
        .upsert(payload, { onConflict: "organization_id,month" });

      if (error) throw error;

      toast({ title: t("powerCall.leaderboard.toastUpdated"), description: t("powerCall.leaderboard.toastUpdatedDesc", { month: monthStr }) });
      queryClient.invalidateQueries({ queryKey: ["leaderboard-snapshot"] });
    } catch {
      toast({ title: t("powerCall.leaderboard.toastError"), description: t("powerCall.leaderboard.toastFailed"), variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const RANK_LABEL = ["🥇", "🥈", "🥉"];

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Leaderboard — förra månaden
          </CardTitle>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground"
              onClick={handleGenerateSnapshot}
              disabled={isGenerating}
            >
              {isGenerating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
              Generera
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex flex-col items-center py-6 text-center px-4">
            <Star className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">
              {isAdmin ? 'Klicka "Generera" för att skapa månadens leaderboard.' : "Inget leaderboard för förra månaden."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {entries.map((entry, i) => (
              <div key={entry.userId} className="flex items-center gap-3 px-4 py-3">
                <span className="text-base shrink-0 w-6 text-center">{RANK_LABEL[i]}</span>
                <Avatar className={cn("h-8 w-8 shrink-0 rounded-full", getFrameClasses(entry.frame))}>
                  <AvatarImage src={entry.avatar || undefined} />
                  <AvatarFallback className="text-xs">
                    {(entry.name || "?").substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.name}</p>
                  <p className="text-xs text-muted-foreground">{entry.meetings} möten</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
