import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";
import type { TimeSeriesEntry } from "@/pages/StatisticsPage";

interface Props {
  timeSeries: TimeSeriesEntry[];
}

export function DailyActivityTable({ timeSeries }: Props) {
  // Show most recent first
  const sorted = [...timeSeries].reverse();

  if (sorted.length === 0) return null;

  const maxTotal = Math.max(...sorted.map(d => d.total), 1);

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-primary" />
          Daglig aktivitet
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Datum</TableHead>
              <TableHead className="text-center">Mail</TableHead>
              <TableHead className="text-center">Samtal</TableHead>
              <TableHead className="text-center">Möten</TableHead>
              <TableHead className="text-center">Dok</TableHead>
              <TableHead className="text-center">Uppg</TableHead>
              <TableHead className="text-center">Totalt</TableHead>
              <TableHead className="pr-6 w-[120px]">Volym</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => {
              const pct = Math.round((row.total / maxTotal) * 100);
              return (
                <TableRow key={row.date}>
                  <TableCell className="pl-6 font-medium text-sm whitespace-nowrap">
                    {formatDate(row.date)}
                  </TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{row.emails || "–"}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{row.calls || "–"}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{row.meetings || "–"}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{row.documents || "–"}</TableCell>
                  <TableCell className="text-center text-sm tabular-nums">{row.tasks || "–"}</TableCell>
                  <TableCell className="text-center text-sm font-semibold tabular-nums">{row.total}</TableCell>
                  <TableCell className="pr-6">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = today.getTime() - d.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Idag";
  if (days === 1) return "Igår";

  return d.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" });
}
