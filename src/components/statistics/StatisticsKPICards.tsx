import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, FileText, Calendar, CheckSquare, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  totals: Record<string, number>;
  deltas: Record<string, number>;
}

const KPI_CONFIGS = [
  { key: "emails_sent", label: "Mail skickade", icon: Mail },
  { key: "calls_logged", label: "Samtal", icon: Phone },
  { key: "documents_sent", label: "Offerter skickade", icon: FileText },
  { key: "meetings_booked", label: "Möten bokade", icon: Calendar },
  { key: "tasks_completed", label: "Uppgifter klara", icon: CheckSquare },
  { key: "total", label: "Totalt", icon: Activity },
];

export function StatisticsKPICards({ totals, deltas }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {KPI_CONFIGS.map(({ key, label, icon: Icon }) => {
        const value = totals[key] || 0;
        const delta = deltas[key] || 0;

        return (
          <Card key={key} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <DeltaBadge delta={delta} />
              </div>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
        <Minus className="h-3 w-3" />0%
      </span>
    );
  }

  const isPositive = delta > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-xs font-medium",
      isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"
    )}>
      {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {isPositive ? "+" : ""}{delta}%
    </span>
  );
}
