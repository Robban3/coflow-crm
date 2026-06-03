import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Lightbulb, Users } from "lucide-react";
import type { InsightEntry } from "@/pages/StatisticsPage";

interface Props {
  insights: InsightEntry[];
}

export function StatisticsInsights({ insights }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          Coaching-insikter
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="rounded-lg border border-border/50 p-4 space-y-2 bg-muted/30"
            >
              <h4 className="font-semibold text-sm">{insight.title}</h4>
              <p className="text-xs text-muted-foreground">{insight.reason}</p>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                {insight.users.join(", ")}
              </div>
              <p className="text-xs font-medium text-primary">💡 {insight.action}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
