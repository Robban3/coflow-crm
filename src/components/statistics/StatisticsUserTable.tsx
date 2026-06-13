import { useTranslation } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/pages/StatisticsPage";
import { formatDistanceToNow } from "date-fns";
import { sv } from "date-fns/locale";

interface Props {
  entries: LeaderboardEntry[];
  onUserClick: (userId: string) => void;
}

type SortKey = "score" | "emails" | "calls" | "meetings" | "active_days" | "total";

export function StatisticsUserTable({ entries, onUserClick }: Props) {
  const { t } = useTranslation();
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [sortDesc, setSortDesc] = useState(true);

  const sorted = [...entries].sort((a, b) => {
    const diff = (a[sortKey] || 0) - (b[sortKey] || 0);
    return sortDesc ? -diff : diff;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDesc(!sortDesc);
    else { setSortKey(key); setSortDesc(true); }
  };

  const SortButton = ({ k, label }: { k: SortKey; label: string }) => (
    <Button
      variant="ghost"
      size="sm"
      className={cn("h-auto p-0 font-medium text-xs", sortKey === k && "text-primary")}
      onClick={() => toggleSort(k)}
    >
      {label}
      <ArrowUpDown className="ml-1 h-3 w-3" />
    </Button>
  );

  const typeLabel = (type: string | null) => {
    if (!type) return "–";
    const labels: Record<string, string> = {
      "email.sent": t("statistics.typeEmail"),
      "call.logged": t("statistics.typeCall"),
      "document.sent": t("statistics.typeQuote"),
      "meeting.booked": t("statistics.typeMeeting"),
      "task.completed": t("statistics.typeTask"),
    };
    return labels[type] || type;
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t("statistics.userOverview")}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">{t("statistics.user")}</TableHead>
                <TableHead><SortButton k="emails" label={t("statistics.typeEmail")} /></TableHead>
                <TableHead><SortButton k="calls" label={t("statistics.typeCall")} /></TableHead>
                <TableHead><SortButton k="meetings" label={t("statistics.meetings")} /></TableHead>
                <TableHead><SortButton k="score" label={t("statistics.score")} /></TableHead>
                <TableHead><SortButton k="active_days" label={t("statistics.activeDays")} /></TableHead>
                <TableHead>{t("statistics.latest")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((entry) => (
                <TableRow
                  key={entry.user_id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onUserClick(entry.user_id)}
                >
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={entry.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {(entry.full_name || "?").substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm font-medium truncate max-w-[140px]">{entry.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{entry.emails}</TableCell>
                  <TableCell className="text-sm">{entry.calls}</TableCell>
                  <TableCell className="text-sm">{entry.meetings}</TableCell>
                  <TableCell className="text-sm font-semibold">{entry.score}</TableCell>
                  <TableCell className="text-sm">{entry.active_days}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {entry.last_activity_at ? (
                      <span>
                        {typeLabel(entry.last_activity_type)} ·{" "}
                        {formatDistanceToNow(new Date(entry.last_activity_at), { addSuffix: true, locale: sv })}
                      </span>
                    ) : (
                      "–"
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
