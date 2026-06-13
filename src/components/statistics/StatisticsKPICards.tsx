import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, FileText, Calendar, CheckSquare, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  totals: Record<string, number>;
  deltas: Record<string, number>;
}

const KPI_CONFIGS = [
  { key: "emails_sent", labelKey: "statistics.emailsSent", icon: Mail },
  { key: "calls_logged", labelKey: "statistics.calls", icon: Phone },
  { key: "documents_sent", labelKey: "statistics.quotesSent", icon: FileText },
  { key: "meetings_booked", labelKey: "statistics.meetingsBooked", icon: Calendar },
  { key: "tasks_completed", labelKey: "statistics.tasksDone", icon: CheckSquare },
  { key: "total", labelKey: "statistics.total", icon: Activity },
];

export function StatisticsKPICards({ totals, deltas }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {KPI_CONFIGS.map(({ key, labelKey, icon: Icon }) => {
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
              <p className="text-xs text-muted-foreground mt-0.5">{t(labelKey)}</p>
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
