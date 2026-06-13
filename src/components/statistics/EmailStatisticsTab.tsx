import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Mail, MailOpen, MessageSquare, TrendingUp, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { format, parseISO, startOfMonth, startOfWeek, subDays, subMonths, isAfter } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

type Period = "last_7_days" | "last_30_days" | "this_month" | "last_3_months" | "last_6_months";
type GroupBy = "day" | "week" | "month";

const PERIOD_OPTIONS: { value: Period; labelKey: string; defaultGroup: GroupBy }[] = [
  { value: "last_7_days", labelKey: "statistics.periodLast7Days", defaultGroup: "day" },
  { value: "last_30_days", labelKey: "statistics.periodLast30Days", defaultGroup: "day" },
  { value: "this_month", labelKey: "statistics.periodThisMonth", defaultGroup: "day" },
  { value: "last_3_months", labelKey: "statistics.periodLast3Months", defaultGroup: "week" },
  { value: "last_6_months", labelKey: "statistics.periodLast6Months", defaultGroup: "month" },
];

function getStartDate(period: Period): Date {
  const now = new Date();
  switch (period) {
    case "last_7_days": return subDays(now, 6);
    case "last_30_days": return subDays(now, 29);
    case "this_month": return startOfMonth(now);
    case "last_3_months": return subMonths(now, 3);
    case "last_6_months": return subMonths(now, 6);
  }
}

interface SentEmail {
  id: string;
  created_at: string;
  subject: string;
  recipient_email: string;
  recipient_name: string | null;
  opened_at: string | null;
  opened_count: number | null;
  source: string;
  status: string | null;
  send_error: string | null;
  lead_id: string | null;
  sent_by: string;
}

interface EmailReply {
  id: string;
  received_at: string;
  original_email_id: string | null;
  lead_id: string | null;
}

interface SenderProfile {
  id: string;
  full_name: string | null;
}

export function EmailStatisticsTab() {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const organizationId = useOrganizationId();
  const [period, setPeriod] = useState<Period>("last_30_days");
  const groupBy = PERIOD_OPTIONS.find(p => p.value === period)?.defaultGroup ?? "day";

  const startDate = useMemo(() => getStartDate(period), [period]);

  const { data: emails, isLoading: loadingEmails } = useQuery({
    queryKey: ["email-stats-sent", organizationId, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("sent_emails")
        .select("id, created_at, subject, recipient_email, recipient_name, opened_at, opened_count, source, status, send_error, lead_id, sent_by")
        .eq("organization_id", organizationId!)
        .gte("created_at", startDate.toISOString())
        .order("created_at", { ascending: false });
      return (data ?? []) as SentEmail[];
    },
    enabled: !!organizationId,
  });

  const { data: replies } = useQuery({
    queryKey: ["email-stats-replies", organizationId, period],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_replies")
        .select("id, received_at, original_email_id, lead_id")
        .eq("organization_id", organizationId!)
        .gte("received_at", startDate.toISOString());
      return (data ?? []) as EmailReply[];
    },
    enabled: !!organizationId,
  });

  // Fetch profiles for sender names
  const senderIds = useMemo(() => {
    if (!emails) return [];
    return [...new Set(emails.map(e => e.sent_by))];
  }, [emails]);

  const { data: profiles } = useQuery({
    queryKey: ["email-stats-profiles", senderIds],
    queryFn: async () => {
      if (senderIds.length === 0) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", senderIds);
      return (data ?? []) as SenderProfile[];
    },
    enabled: senderIds.length > 0,
  });

  const profileMap = useMemo(() => {
    const map = new Map<string, string>();
    profiles?.forEach(p => map.set(p.id, p.full_name ?? t("statistics.unknown")));
    return map;
  }, [profiles, t]);

  // Compute stats
  const stats = useMemo(() => {
    if (!emails) return null;

    const total = emails.length;
    const delivered = emails.filter(e => !e.send_error).length;
    const opened = emails.filter(e => e.opened_at).length;
    const failed = emails.filter(e => e.send_error).length;

    const replySet = new Set(replies?.map(r => r.original_email_id).filter(Boolean) ?? []);
    const replied = emails.filter(e => replySet.has(e.id)).length;

    const openRate = delivered > 0 ? Math.round((opened / delivered) * 100) : 0;
    const replyRate = delivered > 0 ? Math.round((replied / delivered) * 100) : 0;

    // By source
    const bySource = new Map<string, { sent: number; opened: number; replied: number }>();
    emails.forEach(e => {
      const src = e.source || "unknown";
      const entry = bySource.get(src) || { sent: 0, opened: 0, replied: 0 };
      entry.sent++;
      if (e.opened_at) entry.opened++;
      if (replySet.has(e.id)) entry.replied++;
      bySource.set(src, entry);
    });

    // By sender
    const bySender = new Map<string, { sent: number; opened: number; replied: number }>();
    emails.forEach(e => {
      const entry = bySender.get(e.sent_by) || { sent: 0, opened: 0, replied: 0 };
      entry.sent++;
      if (e.opened_at) entry.opened++;
      if (replySet.has(e.id)) entry.replied++;
      bySender.set(e.sent_by, entry);
    });

    // Time series
    const buckets = new Map<string, { sent: number; opened: number; replied: number }>();
    emails.forEach(e => {
      const d = parseISO(e.created_at);
      let key: string;
      if (groupBy === "day") key = format(d, "yyyy-MM-dd");
      else if (groupBy === "week") key = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
      else key = format(startOfMonth(d), "yyyy-MM");

      const b = buckets.get(key) || { sent: 0, opened: 0, replied: 0 };
      b.sent++;
      if (e.opened_at) b.opened++;
      if (replySet.has(e.id)) b.replied++;
      buckets.set(key, b);
    });

    const timeSeries = Array.from(buckets.entries())
      .map(([key, val]) => ({
        date: key,
        label: groupBy === "month"
          ? format(parseISO(key + "-01"), "MMM yyyy", { locale: dateLocale })
          : groupBy === "week"
            ? `v${format(parseISO(key), "w", { locale: dateLocale })}`
            : format(parseISO(key), "d MMM", { locale: dateLocale }),
        ...val,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      total, delivered, opened, failed, replied,
      openRate, replyRate,
      bySource: Array.from(bySource.entries()).map(([source, v]) => ({ source, ...v })),
      bySender: Array.from(bySender.entries()).map(([userId, v]) => ({ userId, ...v })),
      timeSeries,
      replySet,
    };
  }, [emails, replies, groupBy, dateLocale]);

  if (loadingEmails) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (!stats || stats.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Mail className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h2 className="text-lg font-semibold mb-2">Ingen maildata ännu</h2>
        <p className="text-muted-foreground text-sm max-w-md">
          Statistik visas här när mail har skickats under den valda perioden.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period filter */}
      <div className="flex items-center gap-4">
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-[200px] h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map(o => (
              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard icon={<Mail className="h-4 w-4" />} label="Skickade" value={stats.total} />
        <KPICard icon={<MailOpen className="h-4 w-4" />} label="Öppnade" value={stats.opened} sub={`${stats.openRate}%`} />
        <KPICard icon={<MessageSquare className="h-4 w-4" />} label="Svar" value={stats.replied} sub={`${stats.replyRate}%`} />
        <KPICard icon={<Eye className="h-4 w-4" />} label="Levererade" value={stats.delivered} />
        <KPICard icon={<TrendingUp className="h-4 w-4" />} label="Misslyckade" value={stats.failed} variant={stats.failed > 0 ? "destructive" : "default"} />
      </div>

      {/* Chart: sent vs opened over time */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mail över tid</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.timeSeries} barGap={2}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                <XAxis dataKey="label" fontSize={11} tickLine={false} className="text-muted-foreground" />
                <YAxis fontSize={11} tickLine={false} className="text-muted-foreground" allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="sent" name="Skickade" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="opened" name="Öppnade" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="replied" name="Svar" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                <Legend />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Open rate trend */}
      {stats.timeSeries.length > 2 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Öppningsfrekvens över tid</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.timeSeries.map(t => ({
                  ...t,
                  openRate: t.sent > 0 ? Math.round((t.opened / t.sent) * 100) : 0,
                  replyRate: t.sent > 0 ? Math.round((t.replied / t.sent) * 100) : 0,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                  <XAxis dataKey="label" fontSize={11} tickLine={false} />
                  <YAxis fontSize={11} tickLine={false} unit="%" domain={[0, 100]} />
                  <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                  <Line type="monotone" dataKey="openRate" name="Öppningsfrekvens" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="replyRate" name="Svarsfrekvens" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3 }} />
                  <Legend />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* By source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Per källa</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Källa</TableHead>
                  <TableHead className="text-right">Skickade</TableHead>
                  <TableHead className="text-right">Öppnade</TableHead>
                  <TableHead className="text-right">Svar</TableHead>
                  <TableHead className="text-right">Öppn. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.bySource.sort((a, b) => b.sent - a.sent).map(row => (
                  <TableRow key={row.source}>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{formatSource(row.source)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">{row.sent}</TableCell>
                    <TableCell className="text-right">{row.opened}</TableCell>
                    <TableCell className="text-right">{row.replied}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.sent > 0 ? Math.round((row.opened / row.sent) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* By sender */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Per avsändare</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Avsändare</TableHead>
                  <TableHead className="text-right">Skickade</TableHead>
                  <TableHead className="text-right">Öppnade</TableHead>
                  <TableHead className="text-right">Svar</TableHead>
                  <TableHead className="text-right">Öppn. %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.bySender.sort((a, b) => b.sent - a.sent).map(row => (
                  <TableRow key={row.userId}>
                    <TableCell className="font-medium">{profileMap.get(row.userId) ?? "Okänd"}</TableCell>
                    <TableCell className="text-right">{row.sent}</TableCell>
                    <TableCell className="text-right">{row.opened}</TableCell>
                    <TableCell className="text-right">{row.replied}</TableCell>
                    <TableCell className="text-right font-medium">
                      {row.sent > 0 ? Math.round((row.opened / row.sent) * 100) : 0}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Recent emails table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Senaste mail</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Ämne</TableHead>
                  <TableHead>Mottagare</TableHead>
                  <TableHead>Avsändare</TableHead>
                  <TableHead>Källa</TableHead>
                  <TableHead className="text-center">Öppnad</TableHead>
                  <TableHead className="text-center">Svar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(emails ?? []).slice(0, 50).map(e => (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(parseISO(e.created_at), "d MMM HH:mm", { locale: sv })}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm">{e.subject}</TableCell>
                    <TableCell className="text-sm">{e.recipient_name || e.recipient_email}</TableCell>
                    <TableCell className="text-sm">{profileMap.get(e.sent_by) ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{formatSource(e.source)}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {e.opened_at ? (
                        <span className="text-primary text-xs font-medium flex items-center justify-center gap-1">
                          <MailOpen className="h-3.5 w-3.5" /> {e.opened_count ?? 1}x
                        </span>
                      ) : e.send_error ? (
                        <Badge variant="destructive" className="text-xs">Fel</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {stats.replySet.has(e.id) ? (
                        <Badge className="bg-chart-3/20 text-chart-3 text-xs border-0">Ja</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPICard({ icon, label, value, sub, variant }: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub?: string;
  variant?: "default" | "destructive";
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${variant === "destructive" && value > 0 ? "text-destructive" : ""}`}>
            {value}
          </span>
          {sub && <span className="text-sm text-muted-foreground">{sub}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function formatSource(source: string): string {
  const map: Record<string, string> = {
    outreach: "Outreach",
    sequence: "Sekvens",
    manual: "Manuell",
    auto_enrich: "Auto-enrich",
    quick_outreach: "Snabbmail",
    analysis: "Analys",
  };
  return map[source] ?? source;
}
