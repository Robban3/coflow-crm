import { useTranslation } from "@/i18n/LanguageProvider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, FileText, Calendar, CheckSquare, Activity, CalendarDays } from "lucide-react";
import type { LeaderboardEntry } from "@/pages/StatisticsPage";

interface Props {
  user: LeaderboardEntry | null;
  open: boolean;
  onClose: () => void;
}

export function StatisticsUserDrawer({ user, open, onClose }: Props) {
  const { t } = useTranslation();
  if (!user) return null;

  const metrics = [
    { label: t("statistics.emailsSent"), value: user.emails, icon: Mail },
    { label: t("statistics.calls"), value: user.calls, icon: Phone },
    { label: t("statistics.quotes"), value: user.documents, icon: FileText },
    { label: t("statistics.meetings"), value: user.meetings, icon: Calendar },
    { label: t("statistics.tasks"), value: user.tasks, icon: CheckSquare },
    { label: t("statistics.total"), value: user.total, icon: Activity },
  ];

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.avatar_url || undefined} />
              <AvatarFallback>
                {(user.full_name || "?").substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <SheetTitle className="text-left">{user.full_name}</SheetTitle>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-4">
          {/* Score + active days */}
          <div className="flex gap-3">
            <Card className="flex-1 border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{user.score}</p>
                <p className="text-xs text-muted-foreground">{t("statistics.score")}</p>
              </CardContent>
            </Card>
            <Card className="flex-1 border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">{user.active_days}</p>
                <p className="text-xs text-muted-foreground">{t("statistics.activeDays")}</p>
              </CardContent>
            </Card>
            <Card className="flex-1 border-border/50">
              <CardContent className="p-3 text-center">
                <p className="text-2xl font-bold">
                  {user.delta > 0 ? "+" : ""}{user.delta}%
                </p>
                <p className="text-xs text-muted-foreground">{t("statistics.trend")}</p>
              </CardContent>
            </Card>
          </div>

          {/* Metrics breakdown */}
          <Card className="border-border/50">
            <CardContent className="p-0 divide-y divide-border/50">
              {metrics.map(({ label, value, icon: Icon }) => (
                <div key={label} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{label}</span>
                  </div>
                  <Badge variant="secondary" className="font-mono">{value}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Last activity */}
          {user.last_activity_at && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("statistics.lastActivity", { value: new Date(user.last_activity_at).toLocaleString("sv-SE") })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
