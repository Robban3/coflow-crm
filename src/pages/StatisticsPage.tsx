import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useModules } from "@/hooks/useModules";
import { useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatisticsFilters } from "@/components/statistics/StatisticsFilters";
import { StatisticsKPICards } from "@/components/statistics/StatisticsKPICards";
import { StatisticsLeaderboard } from "@/components/statistics/StatisticsLeaderboard";
import { StatisticsCharts } from "@/components/statistics/StatisticsCharts";
import { StatisticsInsights } from "@/components/statistics/StatisticsInsights";
import { StatisticsUserTable } from "@/components/statistics/StatisticsUserTable";
import { StatisticsUserDrawer } from "@/components/statistics/StatisticsUserDrawer";
import { DailyActivityTable } from "@/components/statistics/DailyActivityTable";
import { TodaySnapshot } from "@/components/statistics/TodaySnapshot";
import { CallOutcomesBreakdown, type CallOutcomeStats } from "@/components/statistics/CallOutcomesBreakdown";
import { SalesFunnel, type FunnelStage } from "@/components/statistics/SalesFunnel";
import { RevenuePerformance, type RevenueData } from "@/components/statistics/RevenuePerformance";
import { TimeToConvertInsights, type TimeToConvertData } from "@/components/statistics/TimeToConvertInsights";
import { PersonalProgress } from "@/components/statistics/PersonalProgress";
import { LeaderboardWidget } from "@/components/power-call/LeaderboardWidget";
import { EmailStatisticsTab } from "@/components/statistics/EmailStatisticsTab";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Phone, CalendarClock, Mail } from "lucide-react";
import type { UserRole } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";

export type Granularity = "day" | "week" | "month";
export type PeriodPreset = "today" | "yesterday" | "last_7_days" | "last_30_days" | "this_week" | "last_week" | "this_month" | "last_month" | "custom";

function getDateRange(preset: PeriodPreset): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  switch (preset) {
    case "today":
      return { start: fmt(today), end: fmt(today) };
    case "yesterday": {
      const yday = new Date(today);
      yday.setDate(today.getDate() - 1);
      return { start: fmt(yday), end: fmt(yday) };
    }
    case "last_7_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 6);
      return { start: fmt(start), end: fmt(today) };
    }
    case "last_30_days": {
      const start = new Date(today);
      start.setDate(today.getDate() - 29);
      return { start: fmt(start), end: fmt(today) };
    }
    case "this_week": {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      return { start: fmt(monday), end: fmt(today) };
    }
    case "last_week": {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diff);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(thisMonday);
      lastSunday.setDate(thisMonday.getDate() - 1);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case "this_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: fmt(firstDay), end: fmt(today) };
    }
    case "last_month": {
      const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: fmt(firstDay), end: fmt(lastDay) };
    }
    default:
      return { start: fmt(today), end: fmt(today) };
  }
}

export interface StatisticsData {
  totals: Record<string, number>;
  deltas: Record<string, number>;
  leaderboard: LeaderboardEntry[];
  timeSeries: TimeSeriesEntry[];
  byType: { type: string; count: number; label: string }[];
  insights: InsightEntry[];
  weights: Record<string, number>;
  callOutcomeStats?: CallOutcomeStats;
  funnelData?: { stages: FunnelStage[] };
  revenueData?: RevenueData;
  timeToConvertData?: TimeToConvertData;
  callbackBacklog?: { total_open: number; due_today: number };
  top3UserIds?: string[];
  userRole?: string;
  currentUserId?: string;
  period: { start: string; end: string; granularity: string };
}

export interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  email: string;
  emails: number;
  calls: number;
  meetings: number;
  documents: number;
  tasks: number;
  score: number;
  total: number;
  delta: number;
  active_days: number;
  last_activity_type: string | null;
  last_activity_at: string | null;
}

export interface TimeSeriesEntry {
  date: string;
  emails: number;
  calls: number;
  meetings: number;
  documents: number;
  tasks: number;
  total: number;
}

export interface InsightEntry {
  title: string;
  reason: string;
  users: string[];
  action: string;
}

export default function StatisticsPage() {
  const { t } = useTranslation();
  const { hasModuleAccess } = useModules();
  const { userRole: authRole } = useAuth();
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>("last_7_days");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("activity");

  const dateRange = useMemo(() => getDateRange(periodPreset), [periodPreset]);

  const { data, isLoading } = useQuery<StatisticsData>({
    queryKey: ["statistics-overview", granularity, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/statistics-overview?granularity=${granularity}&start=${dateRange.start}&end=${dateRange.end}`;
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch statistics");
      }

      return response.json();
    },
    enabled: hasModuleAccess("statistics"),
  });

  if (!hasModuleAccess("statistics")) {
    return <Navigate to="/dashboard" replace />;
  }

  const selectedUser = data?.leaderboard.find(u => u.user_id === selectedUserId) || null;
  const role: UserRole = (data?.userRole as UserRole) || authRole;
  const isLeaderOrAdmin = role === "admin" || role === "moderator";
  const isUser = role === "user";
  const currentUserEntry = data?.leaderboard.find(u => u.user_id === data?.currentUserId);

  return (
    <AppLayout>
      <div className="p-4 md:p-6 max-w-[1400px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-1">
            <BarChart3 className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">{t("statistics.title")}</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            {isUser ? t("statistics.subtitleUser") : t("statistics.subtitleTeam")}
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="activity" className="gap-1.5">
              <BarChart3 className="h-4 w-4" /> {t("statistics.tabActivity")}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-4 w-4" /> {t("statistics.tabEmail")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="mt-4 space-y-6">
            {/* Filters */}
            <StatisticsFilters
              granularity={granularity}
              onGranularityChange={setGranularity}
              periodPreset={periodPreset}
              onPeriodPresetChange={setPeriodPreset}
            />

            {isLoading ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
                <Skeleton className="h-80 rounded-xl" />
                <Skeleton className="h-64 rounded-xl" />
              </div>
            ) : !data || data.leaderboard.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <BarChart3 className="h-12 w-12 text-muted-foreground/40 mb-4" />
                <h2 className="text-lg font-semibold text-foreground mb-2">{t("statistics.emptyTitle")}</h2>
                <p className="text-muted-foreground text-sm max-w-md">
                  {t("statistics.emptyDesc")}
                </p>
              </div>
            ) : (
              <>
                <StatisticsKPICards totals={data.totals} deltas={data.deltas} />
                <TodaySnapshot timeSeries={data.timeSeries} />

                {isUser && currentUserEntry && (
                  <PersonalProgress
                    meetings={currentUserEntry.meetings}
                    calls={currentUserEntry.calls}
                    emails={currentUserEntry.emails}
                  />
                )}

                {(data.callOutcomeStats?.summary.total ?? 0) > 0 || (data.callbackBacklog?.total_open ?? 0) > 0 ? (
                  <div>
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                      <Phone className="h-4 w-4" /> Power Call
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold">{data.callOutcomeStats?.summary.total ?? 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("statistics.callsTotal")}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-primary">{data.callOutcomeStats?.summary.answer_rate ?? 0}%</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("statistics.answerRate")}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <p className="text-2xl font-bold text-primary">{data.callOutcomeStats?.summary.booked ?? 0}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{t("statistics.meetingsBooked")}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/50">
                        <CardContent className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <p className="text-2xl font-bold">{data.callbackBacklog?.total_open ?? 0}</p>
                            {(data.callbackBacklog?.due_today ?? 0) > 0 && (
                              <Badge variant="destructive" className="text-xs px-1.5 py-0">
                                {t("statistics.dueToday", { count: data.callbackBacklog!.due_today })}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                            <CalendarClock className="h-3 w-3" /> {t("statistics.openCallbacks")}
                          </p>
                        </CardContent>
                      </Card>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2">
                    <StatisticsCharts timeSeries={data.timeSeries} byType={data.byType} granularity={granularity} />
                  </div>
                  <div className="space-y-6">
                    <StatisticsLeaderboard
                      entries={data.leaderboard}
                      weights={data.weights}
                      onUserClick={setSelectedUserId}
                      top3UserIds={data.top3UserIds}
                    />
                    <LeaderboardWidget />
                    {data.funnelData && data.funnelData.stages.some(s => s.count > 0) && (
                      <SalesFunnel stages={data.funnelData.stages} />
                    )}
                  </div>
                </div>

                {granularity === "day" && data.timeSeries.length > 0 && (
                  <DailyActivityTable timeSeries={data.timeSeries} />
                )}

                {isLeaderOrAdmin && data.insights.length > 0 && (
                  <StatisticsInsights insights={data.insights} />
                )}

                {isLeaderOrAdmin && (
                  <StatisticsUserTable
                    entries={data.leaderboard}
                    onUserClick={setSelectedUserId}
                  />
                )}

                {data.callOutcomeStats && data.callOutcomeStats.summary.total > 0 && (
                  <CallOutcomesBreakdown data={isLeaderOrAdmin ? data.callOutcomeStats : {
                    ...data.callOutcomeStats,
                    per_user: [],
                    trend: data.callOutcomeStats.trend,
                  }} />
                )}

                {isLeaderOrAdmin && data.revenueData && (
                  <RevenuePerformance data={data.revenueData} />
                )}

                {isLeaderOrAdmin && data.timeToConvertData && (
                  <TimeToConvertInsights data={data.timeToConvertData} />
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <EmailStatisticsTab />
          </TabsContent>
        </Tabs>
      </div>

      <StatisticsUserDrawer
        user={selectedUser}
        open={!!selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </AppLayout>
  );
}
