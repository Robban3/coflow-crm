import { AppLayout } from "@/components/layout/AppLayout";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { useTranslation } from "@/i18n/LanguageProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronLeft, ChevronRight, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { addDays, format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";

interface SchedRow {
  user_id: string;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  is_off: boolean;
}

function mondayOf(d: Date): Date {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = Monday
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
const iso = (d: Date) => format(d, "yyyy-MM-dd");

function hoursBetween(start?: string | null, end?: string | null): number {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  return mins > 0 ? mins / 60 : 0;
}
const fmtH = (h: number) => (Number.isInteger(h) ? `${h}` : h.toFixed(1));

export default function SchedulePage() {
  const { t, language } = useTranslation();
  const locale = language === "en" ? enUS : language === "es" ? es : sv;
  const { user } = useAuth();
  const orgId = useOrganizationId();
  const { members, getInitials } = useTeamMembers();

  // Default to the upcoming week (planning ahead).
  const [weekStart, setWeekStart] = useState<Date>(() => addDays(mondayOf(new Date()), 7));
  const [rows, setRows] = useState<SchedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingDate, setSavingDate] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);
  const weekDates = useMemo(() => days.map(iso), [days]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("work_schedules")
      .select("user_id, work_date, start_time, end_time, is_off")
      .gte("work_date", weekDates[0])
      .lte("work_date", weekDates[6]);
    setRows((data as SchedRow[]) || []);
    setLoading(false);
  }, [weekDates]);

  useEffect(() => {
    load();
  }, [load]);

  const rowMap = useMemo(() => {
    const m = new Map<string, SchedRow>();
    rows.forEach((r) => m.set(`${r.user_id}:${r.work_date}`, r));
    return m;
  }, [rows]);

  const myDay = (date: string) => {
    const r = rowMap.get(`${user?.id}:${date}`);
    return {
      start: r?.start_time?.slice(0, 5) || "",
      end: r?.end_time?.slice(0, 5) || "",
      is_off: r?.is_off || false,
    };
  };

  const upsertDay = async (
    date: string,
    patch: Partial<{ start: string; end: string; is_off: boolean }>,
  ) => {
    if (!user?.id || !orgId) return;
    const cur = myDay(date);
    const next = { ...cur, ...patch };
    const start_time = next.is_off ? null : next.start || null;
    const end_time = next.is_off ? null : next.end || null;
    setSavingDate(date);
    // Optimistic local update
    setRows((prev) => {
      const others = prev.filter((r) => !(r.user_id === user.id && r.work_date === date));
      return [...others, { user_id: user.id, work_date: date, start_time, end_time, is_off: next.is_off }];
    });
    try {
      const { error } = await (supabase as any)
        .from("work_schedules")
        .upsert(
          { user_id: user.id, organization_id: orgId, work_date: date, start_time, end_time, is_off: next.is_off },
          { onConflict: "user_id,work_date" },
        );
      if (error) throw error;
    } catch {
      toast.error(t("schedule.saveError"));
    } finally {
      setSavingDate(null);
    }
  };

  const copyLastWeek = async () => {
    if (!user?.id || !orgId) return;
    const prevDates = Array.from({ length: 7 }, (_, i) => iso(addDays(weekStart, -7 + i)));
    const { data } = await (supabase as any)
      .from("work_schedules")
      .select("work_date, start_time, end_time, is_off")
      .eq("user_id", user.id)
      .gte("work_date", prevDates[0])
      .lte("work_date", prevDates[6]);
    const prev = (data as any[]) || [];
    if (prev.length === 0) {
      toast.info(t("schedule.nothingToCopy"));
      return;
    }
    const upserts = prev.map((r: any) => {
      const offset = prevDates.indexOf(r.work_date);
      return {
        user_id: user.id,
        organization_id: orgId,
        work_date: weekDates[offset],
        start_time: r.is_off ? null : r.start_time,
        end_time: r.is_off ? null : r.end_time,
        is_off: r.is_off,
      };
    });
    await (supabase as any).from("work_schedules").upsert(upserts, { onConflict: "user_id,work_date" });
    toast.success(t("schedule.copiedToast"));
    load();
  };

  const myWeekTotal = weekDates.reduce((s, d) => {
    const r = myDay(d);
    return s + (r.is_off ? 0 : hoursBetween(r.start, r.end));
  }, 0);

  const memberWeekTotal = (uid: string) =>
    weekDates.reduce((s, d) => {
      const r = rowMap.get(`${uid}:${d}`);
      return s + (r && !r.is_off ? hoursBetween(r.start_time, r.end_time) : 0);
    }, 0);
  const teamTotal = members.reduce((s, m) => s + memberWeekTotal(m.id), 0);

  const weekRange = `${format(days[0], "d MMM", { locale })} – ${format(days[6], "d MMM yyyy", { locale })}`;

  return (
    <AppLayout title={t("schedule.title")}>
      <div className="space-y-6">
        {/* Header + week switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("schedule.title")}</h2>
            <p className="text-muted-foreground text-sm">{t("schedule.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-sm font-medium min-w-[150px] text-center">{weekRange}</div>
            <Button variant="outline" size="sm" onClick={() => setWeekStart((w) => addDays(w, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setWeekStart(mondayOf(new Date()))}>
              {t("schedule.thisWeek")}
            </Button>
          </div>
        </div>

        {/* My week */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">{t("schedule.myWeek")}</CardTitle>
              <CardDescription>
                {t("schedule.weekTotal")}: <span className="font-semibold text-foreground">{fmtH(myWeekTotal)} {t("schedule.hoursShort")}</span>
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={copyLastWeek}>
              <Copy className="h-4 w-4 mr-2" />
              {t("schedule.copyLastWeek")}
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {days.map((d) => {
              const date = iso(d);
              const md = myDay(date);
              const h = md.is_off ? 0 : hoursBetween(md.start, md.end);
              return (
                <div key={date} className="flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2">
                  <div className="w-28 shrink-0">
                    <p className="text-sm font-medium capitalize">{format(d, "EEEE", { locale })}</p>
                    <p className="text-xs text-muted-foreground">{format(d, "d MMM", { locale })}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={!md.is_off} onCheckedChange={(v) => upsertDay(date, { is_off: !v })} />
                    <span className="text-xs text-muted-foreground w-14">{md.is_off ? t("schedule.off") : t("schedule.working")}</span>
                  </div>
                  {!md.is_off && (
                    <div className="flex items-center gap-2">
                      <Input
                        type="time"
                        value={md.start}
                        onChange={(e) => upsertDay(date, { start: e.target.value })}
                        className="w-[110px]"
                        aria-label={t("schedule.start")}
                      />
                      <span className="text-muted-foreground">–</span>
                      <Input
                        type="time"
                        value={md.end}
                        onChange={(e) => upsertDay(date, { end: e.target.value })}
                        className="w-[110px]"
                        aria-label={t("schedule.end")}
                      />
                    </div>
                  )}
                  <div className="ml-auto text-sm tabular-nums text-muted-foreground min-w-[48px] text-right">
                    {savingDate === date ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin inline" />
                    ) : (
                      md.is_off ? "–" : `${fmtH(h)} ${t("schedule.hoursShort")}`
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Team overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("schedule.teamOverview")}</CardTitle>
            <CardDescription>
              {t("schedule.teamTotal")}: <span className="font-semibold text-foreground">{fmtH(teamTotal)} {t("schedule.hoursShort")}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left font-medium py-2 pr-4 sticky left-0 bg-card">{t("schedule.user")}</th>
                      {days.map((d) => (
                        <th key={iso(d)} className="px-2 py-2 text-center font-medium whitespace-nowrap capitalize">
                          {format(d, "EEE d/M", { locale })}
                        </th>
                      ))}
                      <th className="px-2 py-2 text-right font-medium whitespace-nowrap">{t("schedule.weekTotal")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((m) => (
                      <tr key={m.id} className="border-b last:border-0">
                        <td className="py-2 pr-4 sticky left-0 bg-card">
                          <div className="flex items-center gap-2 min-w-[160px]">
                            <Avatar className="h-7 w-7">
                              <AvatarImage src={m.avatar_url || undefined} />
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary">{getInitials(m)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate font-medium">{m.full_name || m.email}</span>
                          </div>
                        </td>
                        {days.map((d) => {
                          const date = iso(d);
                          const r = rowMap.get(`${m.id}:${date}`);
                          const h = r && !r.is_off ? hoursBetween(r.start_time, r.end_time) : 0;
                          return (
                            <td
                              key={date}
                              className="px-2 py-2 text-center whitespace-nowrap"
                              style={h > 0 ? { backgroundColor: `rgba(37,99,235,${Math.min(h / 10, 1) * 0.18})` } : undefined}
                            >
                              {!r ? (
                                <span className="text-muted-foreground/50">–</span>
                              ) : r.is_off ? (
                                <span className="text-xs text-muted-foreground">{t("schedule.off")}</span>
                              ) : r.start_time && r.end_time ? (
                                <div className="leading-tight">
                                  <div>{r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}</div>
                                  <div className="text-[10px] text-muted-foreground">{fmtH(h)} {t("schedule.hoursShort")}</div>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/50">–</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-right font-semibold tabular-nums">{fmtH(memberWeekTotal(m.id))} {t("schedule.hoursShort")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
