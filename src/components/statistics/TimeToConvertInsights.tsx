import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertTriangle, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TimeToConvertData {
  steps: Array<{
    key: string;
    label: string;
    avg_days: number | null;
  }>;
  slowest_step: string | null;
  fastest_closer: { full_name: string; avg_days: number } | null;
}

interface Props {
  data: TimeToConvertData;
}

export function TimeToConvertInsights({ data }: Props) {
  const hasData = data.steps.some(s => s.avg_days !== null);
  if (!hasData) return null;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Konverteringstider
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          {data.steps.map((step) => (
            <div
              key={step.key}
              className={cn(
                "rounded-lg border border-border/50 p-4 text-center bg-muted/30",
                data.slowest_step === step.label && "border-amber-500/40 bg-amber-500/5"
              )}
            >
              <p className="text-2xl font-bold tabular-nums">
                {step.avg_days !== null ? `${step.avg_days}d` : "–"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">{step.label}</p>
              {data.slowest_step === step.label && (
                <div className="flex items-center justify-center gap-1 mt-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-3 w-3" />
                  <span className="text-[10px] font-medium">Långsammast</span>
                </div>
              )}
            </div>
          ))}
        </div>

        {data.fastest_closer && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground rounded-lg border border-border/50 p-3 bg-muted/20">
            <Zap className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>
              Snabbast att stänga: <strong className="text-foreground">{data.fastest_closer.full_name}</strong>{" "}
              ({data.fastest_closer.avg_days} dagar i snitt)
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
