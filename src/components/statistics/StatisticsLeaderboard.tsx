import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Award, TrendingUp, TrendingDown, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/pages/StatisticsPage";

interface Props {
  entries: LeaderboardEntry[];
  weights: Record<string, number>;
  onUserClick: (userId: string) => void;
  top3UserIds?: string[];
}

export function StatisticsLeaderboard({ entries, weights, onUserClick, top3UserIds }: Props) {
  const sortedEntries = [...entries].sort((a, b) => b.score - a.score);

  // Determine prestige ring for a user
  const getPrestigeRing = (userId: string): string | null => {
    if (!top3UserIds) return null;
    const idx = top3UserIds.indexOf(userId);
    if (idx === 0) return "ring-2 ring-amber-400/70"; // gold
    if (idx === 1) return "ring-2 ring-slate-400/60"; // silver
    if (idx === 2) return "ring-2 ring-amber-700/50"; // bronze
    return null;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-amber-500" />
            Leaderboard
          </CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-xs">
              <p className="font-semibold mb-1">Poängmodell</p>
              <p>Mail × {weights.emails}, Samtal × {weights.calls}, Möten × {weights.meetings}, Dokument × {weights.documents}, Uppgifter × {weights.tasks}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-border/50">
          {sortedEntries.map((entry, index) => (
            <button
              key={entry.user_id}
              onClick={() => onUserClick(entry.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
            >
              <span className={cn(
                "w-6 text-center text-xs font-bold shrink-0",
                index === 0 && "text-amber-500",
                index === 1 && "text-slate-400",
                index === 2 && "text-amber-700",
                index > 2 && "text-muted-foreground"
              )}>
                {index + 1}
              </span>
              <Avatar className={cn("h-7 w-7 shrink-0 rounded-full", getPrestigeRing(entry.user_id))}>
                <AvatarImage src={entry.avatar_url || undefined} />
                <AvatarFallback className="text-xs">
                  {(entry.full_name || "?").substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{entry.full_name}</p>
                <p className="text-xs text-muted-foreground">
                  {entry.emails}m · {entry.calls}s · {entry.score}p
                </p>
              </div>
              {entry.delta !== 0 && (
                <span className={cn(
                  "text-xs font-medium shrink-0",
                  entry.delta > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                )}>
                  {entry.delta > 0 ? <TrendingUp className="h-3 w-3 inline" /> : <TrendingDown className="h-3 w-3 inline" />}
                </span>
              )}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
