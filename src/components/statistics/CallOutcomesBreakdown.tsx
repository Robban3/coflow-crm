import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface CallOutcomeStats {
  summary: {
    total: number;
    answered: number;
    no_answer: number;
    callback: number;
    not_interested: number;
    booked: number;
    wrong_number: number;
    answer_rate: number;
    booked_rate: number;
  };
  per_user: Array<{
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    total: number;
    answered: number;
    no_answer: number;
    callback: number;
    not_interested: number;
    booked: number;
    wrong_number: number;
    answer_rate: number;
    booked_rate: number;
  }>;
  trend: Array<{
    date: string;
    answered: number;
    no_answer: number;
    callback: number;
    not_interested: number;
    booked: number;
  }>;
}

const OUTCOME_COLORS: Record<string, string> = {
  answered: "hsl(var(--chart-2, 160 60% 45%))",
  no_answer: "hsl(var(--muted-foreground))",
  callback: "hsl(40 80% 55%)",
  not_interested: "hsl(0 70% 55%)",
  booked: "hsl(var(--primary))",
  wrong_number: "hsl(0 40% 70%)",
};

interface Props {
  data: CallOutcomeStats;
}

export function CallOutcomesBreakdown({ data }: Props) {
  const { t } = useTranslation();
  const { summary, per_user, trend } = data;

  return (
    <div className="space-y-6">
      {/* Summary KPIs */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{t("statistics.callOverview")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground">{t("statistics.total")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{summary.answered}</p>
              <p className="text-xs text-muted-foreground">{t("statistics.answered")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{summary.answer_rate}%</p>
              <p className="text-xs text-muted-foreground">{t("statistics.answerPct")}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{summary.booked_rate}%</p>
              <p className="text-xs text-muted-foreground">{t("statistics.bookedPct")}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-4 justify-center">
            <Badge variant="outline" className="text-xs">{t("statistics.noAnswerLabel", { count: summary.no_answer })}</Badge>
            <Badge variant="outline" className="text-xs">{t("statistics.callbackLabel", { count: summary.callback })}</Badge>
            <Badge variant="outline" className="text-xs">{t("statistics.notInterestedLabel", { count: summary.not_interested })}</Badge>
            <Badge variant="outline" className="text-xs">{t("statistics.bookedLabel", { count: summary.booked })}</Badge>
            <Badge variant="outline" className="text-xs">{t("statistics.wrongNumberLabel", { count: summary.wrong_number })}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Trend chart */}
      {trend.length > 1 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("statistics.callOutcomesOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "8px",
                    fontSize: "12px",
                    border: "1px solid hsl(var(--border))",
                    backgroundColor: "hsl(var(--background))",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="answered" stackId="a" fill={OUTCOME_COLORS.answered} name="Svar" />
                <Bar dataKey="no_answer" stackId="a" fill={OUTCOME_COLORS.no_answer} name="Ej svar" />
                <Bar dataKey="callback" stackId="a" fill={OUTCOME_COLORS.callback} name="Återkoppling" />
                <Bar dataKey="booked" stackId="a" fill={OUTCOME_COLORS.booked} name="Bokad" />
                <Bar dataKey="not_interested" stackId="a" fill={OUTCOME_COLORS.not_interested} name="Ej intresserad" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Per-user table */}
      {per_user.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Samtal per användare</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Användare</TableHead>
                    <TableHead className="text-right">Samtal</TableHead>
                    <TableHead className="text-right">Svar</TableHead>
                    <TableHead className="text-right">Ej svar</TableHead>
                    <TableHead className="text-right">Återk.</TableHead>
                    <TableHead className="text-right">Ej intr.</TableHead>
                    <TableHead className="text-right">Bokad</TableHead>
                    <TableHead className="text-right">Svar%</TableHead>
                    <TableHead className="text-right">Bokad%</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {per_user.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar userId={u.user_id} size="xs" />
                          <span className="text-sm truncate max-w-[120px]">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{u.total}</TableCell>
                      <TableCell className="text-right">{u.answered}</TableCell>
                      <TableCell className="text-right">{u.no_answer}</TableCell>
                      <TableCell className="text-right">{u.callback}</TableCell>
                      <TableCell className="text-right">{u.not_interested}</TableCell>
                      <TableCell className="text-right">{u.booked}</TableCell>
                      <TableCell className="text-right">
                        <span className={u.answer_rate >= 50 ? "text-green-600 font-medium" : ""}>
                          {u.answer_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={u.booked_rate > 0 ? "text-primary font-medium" : ""}>
                          {u.booked_rate}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
