import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, Calendar, FileText, CheckSquare, TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { TimeSeriesEntry } from "@/pages/StatisticsPage";

interface Props {
  timeSeries: TimeSeriesEntry[];
}

interface Metric {
  label: string;
  key: keyof Omit<TimeSeriesEntry, "date">;
  icon: React.ElementType;
}

const METRICS: Metric[] = [
  { label: "Mail", key: "emails", icon: Mail },
  { label: "Samtal", key: "calls", icon: Phone },
  { label: "Möten", key: "meetings", icon: Calendar },
  { label: "Dokument", key: "documents", icon: FileText },
  { label: "Uppgifter", key: "tasks", icon: CheckSquare },
];

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function TodaySnapshot({ timeSeries }: Props) {
  const now = new Date();
  const todayStr = localDateStr(now);
  const today = timeSeries.find(d => d.date === todayStr);

  // Find same weekday last week
  const lastWeekDate = new Date(now);
  lastWeekDate.setDate(now.getDate() - 7);
  const lastWeekStr = localDateStr(lastWeekDate);
  const lastWeek = timeSeries.find(d => d.date === lastWeekStr);

  if (!today) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {METRICS.map(({ label, key, icon: Icon }) => {
        const current = today[key] as number;
        const prev = lastWeek ? (lastWeek[key] as number) : null;
        const diff = prev !== null ? current - prev : null;

        return (
          <Card key={key} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground font-medium">{label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-bold tabular-nums">{current}</span>
                {diff !== null && (
                  <span className={`text-xs font-medium flex items-center gap-0.5 ${
                    diff > 0 ? "text-green-600" : diff < 0 ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {diff > 0 ? <TrendingUp className="h-3 w-3" /> : diff < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {diff > 0 ? "+" : ""}{diff}
                  </span>
                )}
              </div>
              {prev !== null && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  vs förra {getDayName()} ({prev})
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function getDayName(): string {
  return new Date().toLocaleDateString("sv-SE", { weekday: "long" }).replace(/^\w/, c => c.toLowerCase());
}
