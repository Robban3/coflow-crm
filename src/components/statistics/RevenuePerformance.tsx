import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UserAvatar } from "@/components/ui/user-avatar";
import { DollarSign, TrendingUp } from "lucide-react";

export interface RevenueData {
  total_revenue: number;
  total_deals: number;
  avg_deal_size: number;
  per_user: Array<{
    user_id: string;
    full_name: string;
    avatar_url: string | null;
    deals_won: number;
    revenue: number;
    avg_deal_size: number;
    close_rate: number;
    avg_days_to_close: number;
  }>;
}

interface Props {
  data: RevenueData;
}

function formatSEK(amount: number) {
  return new Intl.NumberFormat("sv-SE", {
    style: "currency",
    currency: "SEK",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function RevenuePerformance({ data }: Props) {
  const { t } = useTranslation();
  if (!data || data.total_deals === 0) return null;

  return (
    <div className="space-y-6">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <DollarSign className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-2xl font-bold">{formatSEK(data.total_revenue)}</p>
            <p className="text-xs text-muted-foreground">{t("statistics.totalRevenue")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold">{data.total_deals}</p>
            <p className="text-xs text-muted-foreground">{t("statistics.dealsWon")}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold">{formatSEK(data.avg_deal_size)}</p>
            <p className="text-xs text-muted-foreground">{t("statistics.avgDealSize")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-user table */}
      {data.per_user.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("statistics.revenuePerUser")}</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("statistics.user")}</TableHead>
                    <TableHead className="text-right">{t("statistics.deals")}</TableHead>
                    <TableHead className="text-right">{t("statistics.revenue")}</TableHead>
                    <TableHead className="text-right">{t("statistics.avg")}</TableHead>
                    <TableHead className="text-right">{t("statistics.closePct")}</TableHead>
                    <TableHead className="text-right">{t("statistics.days")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.per_user.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <UserAvatar userId={u.user_id} size="xs" />
                          <span className="text-sm truncate max-w-[120px]">{u.full_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">{u.deals_won}</TableCell>
                      <TableCell className="text-right font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatSEK(u.revenue)}
                      </TableCell>
                      <TableCell className="text-right">{formatSEK(u.avg_deal_size)}</TableCell>
                      <TableCell className="text-right">
                        <span className={u.close_rate >= 30 ? "text-emerald-600 font-medium" : ""}>
                          {u.close_rate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {u.avg_days_to_close > 0 ? `${u.avg_days_to_close}d` : "–"}
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
