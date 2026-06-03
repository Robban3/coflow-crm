import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import type { TimeSeriesEntry, Granularity } from "@/pages/StatisticsPage";

interface Props {
  timeSeries: TimeSeriesEntry[];
  byType: { type: string; count: number; label: string }[];
  granularity?: Granularity;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
];

const DATA_KEYS = [
  { key: "emails", name: "Mail" },
  { key: "calls", name: "Samtal" },
  { key: "meetings", name: "Möten" },
  { key: "documents", name: "Dokument" },
  { key: "tasks", name: "Uppgifter" },
];

const tooltipStyle = {
  borderRadius: "8px",
  fontSize: "12px",
  border: "1px solid hsl(var(--border))",
  backgroundColor: "hsl(var(--background))",
};

export function StatisticsCharts({ timeSeries, byType, granularity = "week" }: Props) {
  const useBarChart = granularity === "day";

  return (
    <div className="space-y-6">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Aktivitet över tid</CardTitle>
        </CardHeader>
        <CardContent>
          {timeSeries.length === 0 ? (
            <div className="h-64 flex items-center justify-center text-sm text-muted-foreground">
              Ingen data för vald period
            </div>
          ) : useBarChart ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={timeSeries} barGap={1} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" tickFormatter={formatDateLabel} />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={formatDateLabel} />
                {DATA_KEYS.map((dk, i) => (
                  <Bar key={dk.key} dataKey={dk.key} name={dk.name} fill={CHART_COLORS[i]} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
                <Tooltip contentStyle={tooltipStyle} />
                {DATA_KEYS.map((dk, i) => (
                  <Area key={dk.key} type="monotone" dataKey={dk.key} stackId="1" stroke={CHART_COLORS[i]} fill={CHART_COLORS[i]} fillOpacity={0.3} name={dk.name} />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {byType.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Fördelning per typ</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={byType} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
                  {byType.map((_, index) => (
                    <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Legend wrapperStyle={{ fontSize: "12px" }} />
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("sv-SE", { day: "numeric", month: "short" });
}
