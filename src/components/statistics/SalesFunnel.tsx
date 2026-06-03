import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, Users, MessageSquare, Calendar, FileText, Award } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FunnelStage {
  key: string;
  label: string;
  count: number;
  pct: number;
}

interface Props {
  stages: FunnelStage[];
}

const STAGE_ICONS = [Users, MessageSquare, Calendar, FileText, Award];
const STAGE_COLORS = [
  "text-muted-foreground",
  "text-blue-500",
  "text-amber-500",
  "text-violet-500",
  "text-emerald-500",
];

export function SalesFunnel({ stages }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Säljtratt</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {stages.map((stage, i) => {
            const Icon = STAGE_ICONS[i] || Users;
            const color = STAGE_COLORS[i] || "text-muted-foreground";
            const widthPct = Math.max(
              20,
              stages[0].count > 0
                ? Math.round((stage.count / stages[0].count) * 100)
                : 100
            );

            return (
              <div key={stage.key}>
                <div className="flex items-center gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0", color)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between mb-1">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tabular-nums">{stage.count}</span>
                        {i > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {stage.pct}% konv.
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          i === 0 && "bg-muted-foreground/40",
                          i === 1 && "bg-blue-500/60",
                          i === 2 && "bg-amber-500/60",
                          i === 3 && "bg-violet-500/60",
                          i === 4 && "bg-emerald-500/60"
                        )}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                </div>
                {i < stages.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
