import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useModules } from "@/hooks/useModules";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { 
  Users, 
  CheckSquare, 
  BarChart3, 
  Search, 
  Plus,
  ArrowRight,
  TrendingUp,
  Clock,
  Mail,
  MailOpen,
  CalendarDays,
  Target,
  Activity,
  UserCheck,
  AlertTriangle,
  Phone,
  FileText,
  Calendar
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { format, startOfDay, startOfWeek, isToday, isThisWeek } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function DashboardPage() {
  const { user, isAdmin } = useAuth();
  const { hasModuleAccess } = useModules();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;

  // Fetch sent emails stats
  const { data: emailStats } = useQuery({
    queryKey: ['dashboard-email-stats', user?.id, isAdmin],
    queryFn: async () => {
      const today = startOfDay(new Date()).toISOString();
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const userId = user?.id;

      const buildQuery = (extra?: (q: any) => any) => {
        let q = supabase.from('sent_emails').select('id', { count: 'exact', head: true }) as any;
        if (!isAdmin && userId) q = q.eq('sent_by', userId);
        if (extra) q = extra(q);
        return q as Promise<{ count: number | null; error: any }>;
      };

      const [todayRes, weekRes, totalRes, openedRes] = await Promise.all([
        buildQuery(q => q.gte('created_at', today)),
        buildQuery(q => q.gte('created_at', weekStart)),
        buildQuery(),
        buildQuery(q => q.not('opened_at', 'is', null)),
      ]);

      const totalCount = totalRes.count || 0;
      const openedCount = openedRes.count || 0;
      const openRate = totalCount ? Math.round((openedCount / totalCount) * 100) : 0;

      return {
        todayCount: todayRes.count || 0,
        weekCount: weekRes.count || 0,
        totalCount,
        openRate,
      };
    },
    enabled: !!user?.id,
  });

  // Fetch leads stats
  const { data: leadsStats } = useQuery({
    queryKey: ['dashboard-leads-stats', user?.id, isAdmin],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const userId = user?.id;

      const addUserFilter = (q: any) => {
        if (!isAdmin && userId) return q.or(`created_by.eq.${userId},assigned_to.eq.${userId}`);
        return q;
      };

      const [totalRes, weekRes] = await Promise.all([
        addUserFilter(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_test', false)),
        addUserFilter(supabase.from('leads').select('id', { count: 'exact', head: true }).eq('is_test', false).gte('created_at', weekStart)),
      ]);

      return { total: totalRes.count || 0, thisWeek: weekRes.count || 0 };
    },
    enabled: !!user?.id,
  });

  // Fetch tasks stats
  const { data: tasksStats } = useQuery({
    queryKey: ['dashboard-tasks-stats', user?.id, isAdmin],
    queryFn: async () => {
      const now = new Date().toISOString();
      const userId = user?.id;

      const addUserFilter = (q: any) => {
        if (!isAdmin && userId) return q.or(`assigned_to.eq.${userId},created_by.eq.${userId}`);
        return q;
      };

      const [openRes, overdueRes] = await Promise.all([
        addUserFilter(
          supabase.from('tasks').select('id', { count: 'exact', head: true }).in('status', ['todo', 'in_progress'])
        ),
        addUserFilter(
          supabase.from('tasks').select('id', { count: 'exact', head: true })
            .in('status', ['todo', 'in_progress'])
            .not('due_date', 'is', null)
            .lt('due_date', now)
        ),
      ]);

      return { openTasks: openRes.count || 0, overdue: overdueRes.count || 0, total: openRes.count || 0 };
    },
    enabled: !!user?.id,
  });

  // Fetch web analyses stats
  const { data: analysesStats } = useQuery({
    queryKey: ['dashboard-analyses-stats', user?.id, isAdmin],
    queryFn: async () => {
      const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString();
      const userId = user?.id;

      const addUserFilter = (q: any) => {
        if (!isAdmin && userId) return q.eq('analyzed_by', userId);
        return q;
      };

      const [totalRes, weekRes] = await Promise.all([
        addUserFilter(supabase.from('web_analyses').select('id', { count: 'exact', head: true })),
        addUserFilter(supabase.from('web_analyses').select('id', { count: 'exact', head: true }).gte('created_at', weekStart)),
      ]);

      return { total: totalRes.count || 0, thisWeek: weekRes.count || 0 };
    },
    enabled: !!user?.id,
  });

  // === TODAY SECTION DATA ===

  // Overdue tasks
  const { data: overdueTasks = [] } = useQuery({
    queryKey: ['dashboard-overdue-tasks', user?.id, isAdmin],
    queryFn: async () => {
      const now = new Date().toISOString();
      let query = supabase
        .from('tasks')
        .select('id, title, due_date, priority')
        .in('status', ['todo', 'in_progress'])
        .not('due_date', 'is', null)
        .lt('due_date', now)
        .order('due_date', { ascending: true })
        .limit(5);

      if (!isAdmin && user?.id) {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Leads needing follow-up (last call > 3 days ago, still active)
  const { data: followUpLeads = [] } = useQuery({
    queryKey: ['dashboard-followup-leads', user?.id, isAdmin],
    queryFn: async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      let query = supabase
        .from('leads')
        .select('id, company_name, contact_name, last_call_at, lead_status')
        .eq('lead_status', 'contacted')
        .eq('is_test', false)
        .not('last_call_at', 'is', null)
        .lt('last_call_at', threeDaysAgo)
        .order('last_call_at', { ascending: true })
        .limit(5);

      if (!isAdmin && user?.id) {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Today's meetings
  const { data: todayMeetings = [] } = useQuery({
    queryKey: ['dashboard-today-meetings', user?.id],
    queryFn: async () => {
      const todayStart = startOfDay(new Date()).toISOString();
      const tomorrowStart = startOfDay(new Date(Date.now() + 86400000)).toISOString();

      let query = supabase
        .from('meetings')
        .select('id, title, start_time, guest_name, guest_email')
        .gte('start_time', todayStart)
        .lt('start_time', tomorrowStart)
        .order('start_time', { ascending: true })
        .limit(5);

      if (!isAdmin && user?.id) {
        query = query.eq('host_user_id', user.id);
      }

      const { data } = await query;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Pending outreach approvals
  const { data: pendingApprovals = [] } = useQuery({
    queryKey: ['dashboard-pending-approvals', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('sequence_step_executions')
        .select('id, generated_subject, scheduled_at')
        .eq('status', 'pending')
        .order('scheduled_at', { ascending: true })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.id,
  });

  const hasTodayItems = overdueTasks.length > 0 || followUpLeads.length > 0 || todayMeetings.length > 0 || pendingApprovals.length > 0;

  // Upcoming tasks
  const { data: upcomingTasks } = useQuery({
    queryKey: ['dashboard-upcoming-tasks', user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase
        .from('tasks')
        .select('id, title, due_date, priority, status')
        .in('status', ['todo', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(5);
      
      if (!isAdmin) {
        query = query.or(`assigned_to.eq.${user?.id},created_by.eq.${user?.id}`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ['dashboard-recent-activity', user?.id, isAdmin, language],
    queryFn: async () => {
      const activities: Array<{
        id: string;
        type: 'email' | 'analysis' | 'lead';
        title: string;
        subtitle: string;
        timestamp: string;
      }> = [];
      
      let emailQuery = supabase
        .from('sent_emails')
        .select('id, subject, recipient_name, recipient_email, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (!isAdmin) {
        emailQuery = emailQuery.eq('sent_by', user?.id);
      }
      
      const { data: emails } = await emailQuery;
      emails?.forEach(e => {
        activities.push({
          id: e.id,
          type: 'email',
          title: t("dashboard.mailSentTo", { name: e.recipient_name || e.recipient_email }),
          subtitle: e.subject,
          timestamp: e.created_at,
        });
      });
      
      let analysisQuery = supabase
        .from('web_analyses')
        .select('id, url, created_at')
        .order('created_at', { ascending: false })
        .limit(3);
      
      if (!isAdmin) {
        analysisQuery = analysisQuery.eq('analyzed_by', user?.id);
      }
      
      const { data: analyses } = await analysisQuery;
      analyses?.forEach(a => {
        const domain = new URL(a.url).hostname.replace('www.', '');
        activities.push({
          id: a.id,
          type: 'analysis',
          title: t("dashboard.webAnalysisDone"),
          subtitle: domain,
          timestamp: a.created_at,
        });
      });
      
      return activities
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5);
    },
    enabled: !!user?.id,
  });

  // Admin team stats
  const { data: teamStats } = useQuery({
    queryKey: ['dashboard-team-stats'],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');
      if (error) throw error;
      return { totalUsers: profiles?.length || 0 };
    },
    enabled: isAdmin,
  });

  const baseStats: Array<{
    label: string;
    value: string;
    change: string;
    icon: typeof Mail;
    moduleId: 'leads' | 'outreach' | 'tasks' | 'web_analysis';
    path: string;
    highlight: boolean;
    highlightType?: 'warning';
  }> = [
    {
      label: t("dashboard.statMailToday"),
      value: emailStats?.todayCount?.toString() || "0",
      change: t("dashboard.statThisWeekCount", { count: emailStats?.weekCount || 0 }),
      icon: Mail,
      moduleId: 'outreach',
      path: '/mail',
      highlight: (emailStats?.todayCount || 0) > 0,
    },
    {
      label: t("dashboard.statOpenTasks"),
      value: tasksStats?.openTasks?.toString() || "0",
      change: t("dashboard.statOverdue", { count: tasksStats?.overdue || 0 }),
      icon: CheckSquare,
      moduleId: 'tasks',
      path: '/tasks',
      highlight: (tasksStats?.overdue || 0) > 0,
      highlightType: 'warning',
    },
    {
      label: t("dashboard.statLeads"),
      value: leadsStats?.total?.toString() || "0",
      change: t("dashboard.statPlusThisWeek", { count: leadsStats?.thisWeek || 0 }),
      icon: Target,
      moduleId: 'leads',
      path: '/leads',
      highlight: (leadsStats?.thisWeek || 0) > 0,
    },
    {
      label: t("dashboard.statAnalyses"),
      value: analysesStats?.total?.toString() || "0",
      change: t("dashboard.statPlusThisWeek", { count: analysesStats?.thisWeek || 0 }),
      icon: BarChart3,
      moduleId: 'web_analysis',
      path: '/web-analysis',
      highlight: (analysesStats?.thisWeek || 0) > 0,
    },
  ];

  const quickActions = [
    { label: t("dashboard.quickSearchLeads"), icon: Search, path: "/leads", moduleId: 'leads' as const },
    { label: t("dashboard.quickNewAnalysis"), icon: BarChart3, path: "/web-analysis", moduleId: 'web_analysis' as const },
    { label: t("dashboard.quickMail"), icon: Mail, path: "/mail", moduleId: 'outreach' as const },
    { label: t("dashboard.quickNewTask"), icon: CheckSquare, path: "/tasks", moduleId: 'tasks' as const },
  ];

  const firstName = user?.user_metadata?.full_name?.split(' ')[0] || t("userMenu.defaultName");

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <Badge variant="destructive" className="text-xs">{t("dashboard.priorityUrgent")}</Badge>;
      case 'high':
        return <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">{t("dashboard.priorityHigh")}</Badge>;
      default:
        return null;
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return t("dashboard.relativeToday", { time: format(date, 'HH:mm') });
    }
    if (isThisWeek(date, { weekStartsOn: 1 })) {
      return format(date, 'EEEE HH:mm', { locale: dateLocale });
    }
    return format(date, 'd MMM HH:mm', { locale: dateLocale });
  };

  return (
    <AppLayout title={t("dashboard.title")}>
      <div className="space-y-6 md:space-y-8">
        {/* Welcome */}
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight">
              {t("dashboard.welcome", { name: firstName })}
            </h2>
            {isAdmin && (
              <Badge variant="outline" className="text-xs font-medium">
                {t("userMenu.admin")}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {isAdmin ? t("dashboard.overviewAdmin") : t("dashboard.overviewUser")}
          </p>
        </div>

        {/* === TODAY SECTION === */}
        {hasTodayItems && (
          <Card className="border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-primary" />
                {t("dashboard.today")}
              </CardTitle>
              <CardDescription>{t("dashboard.todayDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Overdue tasks */}
              {overdueTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm font-medium text-destructive">{t("dashboard.overdueTasks")}</span>
                  </div>
                  <div className="space-y-1.5">
                    {overdueTasks.map((task) => (
                      <Link
                        key={task.id}
                        to="/tasks"
                        className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5 hover:bg-destructive/10 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <CheckSquare className="h-3.5 w-3.5 text-destructive shrink-0" />
                          <span className="text-sm truncate">{task.title}</span>
                        </div>
                        <span className="text-xs text-destructive shrink-0 ml-2">
                          {format(new Date(task.due_date!), 'd MMM', { locale: dateLocale })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Today's meetings */}
              {todayMeetings.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{t("dashboard.todayMeetings")}</span>
                  </div>
                  <div className="space-y-1.5">
                    {todayMeetings.map((meeting) => (
                      <Link
                        key={meeting.id}
                        to="/meetings"
                        className="flex items-center justify-between p-2.5 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Calendar className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-sm truncate">{meeting.title}</span>
                          {meeting.guest_name && (
                            <span className="text-xs text-muted-foreground">{t("dashboard.meetingWith", { name: meeting.guest_name })}</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {format(new Date(meeting.start_time), 'HH:mm')}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up leads */}
              {followUpLeads.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-800 dark:text-amber-300">{t("dashboard.needsFollowUp")}</span>
                  </div>
                  <div className="space-y-1.5">
                    {followUpLeads.map((lead) => (
                      <Link
                        key={lead.id}
                        to={`/leads/${lead.id}`}
                        className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Target className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
                          <span className="text-sm truncate">{lead.company_name || lead.contact_name}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0 ml-2">
                          {t("dashboard.lastContact", { date: format(new Date(lead.last_call_at!), 'd MMM', { locale: dateLocale }) })}
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {/* Pending approvals */}
              {pendingApprovals.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <span className="text-sm font-medium">{t("dashboard.outreachToReview")}</span>
                    <Badge variant="secondary" className="text-xs">{pendingApprovals.length}</Badge>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/mail">
                      {t("dashboard.reviewDrafts")}
                      <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid gap-4 md:gap-5 grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {baseStats.filter(stat => hasModuleAccess(stat.moduleId)).map((stat, index) => {
            const Icon = stat.icon;
            return (
              <Link 
                key={stat.label} 
                to={stat.path}
                className="group block"
              >
                <Card className={cn(
                  "h-full hover-lift cursor-pointer transition-all",
                  stat.highlight && stat.highlightType === 'warning' && "border-amber-200 dark:border-amber-800/50",
                  stat.highlight && !stat.highlightType && "border-primary/20"
                )}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      {stat.label}
                    </CardTitle>
                    <div className={cn(
                      "p-2 rounded-lg transition-colors",
                      stat.highlight && stat.highlightType === 'warning' 
                        ? "bg-amber-100 dark:bg-amber-900/30" 
                        : "bg-muted/50 group-hover:bg-muted"
                    )}>
                      <Icon className={cn(
                        "h-4 w-4",
                        stat.highlight && stat.highlightType === 'warning' 
                          ? "text-amber-600 dark:text-amber-400" 
                          : "text-muted-foreground/70"
                      )} />
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-semibold tracking-tight">{stat.value}</div>
                    <p className={cn(
                      "text-xs flex items-center gap-1.5 mt-1",
                      stat.highlight && !stat.highlightType && "text-primary",
                      stat.highlight && stat.highlightType === 'warning' && "text-amber-600 dark:text-amber-400",
                      !stat.highlight && "text-muted-foreground"
                    )}>
                      {stat.highlight && !stat.highlightType && <TrendingUp className="h-3 w-3" />}
                      {stat.change}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
          
          {/* Admin team stat */}
          {isAdmin && teamStats && (
            <Link to="/settings" className="group block">
              <Card className="h-full hover-lift cursor-pointer transition-all">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {t("dashboard.teamMembers")}
                  </CardTitle>
                  <div className="p-2 rounded-lg bg-muted/50 group-hover:bg-muted transition-colors">
                    <UserCheck className="h-4 w-4 text-muted-foreground/70" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-semibold tracking-tight">{teamStats.totalUsers}</div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                    {t("dashboard.inOrganization")}
                  </p>
                </CardContent>
              </Card>
            </Link>
          )}
        </div>

        {/* Email Performance */}
        {hasModuleAccess('outreach') && emailStats && emailStats.totalCount > 0 && (
          <Card>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <MailOpen className="h-5 w-5 text-muted-foreground" />
                    {t("dashboard.emailPerformance")}
                  </CardTitle>
                  <CardDescription>{t("dashboard.emailPerformanceDesc")}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/mail">
                    {t("dashboard.viewAll")}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-3 sm:gap-6">
                <div className="text-center">
                  <div className="text-3xl font-semibold text-foreground">{emailStats.totalCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t("dashboard.totalSent")}</div>
                </div>
                <div className="text-center border-x border-border">
                  <div className="text-3xl font-semibold text-foreground">{emailStats.openRate}%</div>
                  <div className="text-sm text-muted-foreground mt-1">{t("dashboard.openRate")}</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-semibold text-foreground">{emailStats.weekCount}</div>
                  <div className="text-sm text-muted-foreground mt-1">{t("dashboard.thisWeek")}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-5 md:gap-6 md:grid-cols-2">
          {/* Quick Actions */}
          <Card className="overflow-hidden w-full max-w-full">
            <CardHeader className="pb-4">
              <CardTitle>{t("dashboard.quickActions")}</CardTitle>
              <CardDescription>{t("dashboard.quickActionsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:gap-3 p-4 sm:p-5 pt-0 w-full max-w-full overflow-hidden">
              {quickActions.filter(action => hasModuleAccess(action.moduleId)).map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.label}
                    variant="outline"
                    className="w-full max-w-full h-auto py-4 sm:py-5 flex flex-col items-center justify-center text-center gap-2 sm:gap-2.5 hover:bg-accent/50 hover:border-border min-w-0 overflow-hidden whitespace-normal"
                    asChild
                  >
                    <Link to={action.path} className="min-w-0 w-full max-w-full flex flex-col items-center justify-center overflow-hidden whitespace-normal">
                      <div className="p-1.5 sm:p-2 rounded-lg bg-muted/50 shrink-0">
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-muted-foreground" />
                      </div>
                      <span className="text-xs sm:text-sm font-medium text-center break-words">{action.label}</span>
                    </Link>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* Upcoming Tasks */}
          {hasModuleAccess('tasks') && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle>{t("dashboard.upcomingTasks")}</CardTitle>
                  <CardDescription>{t("dashboard.upcomingTasksDesc")}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                  <Link to="/tasks">
                    {t("dashboard.viewAll")}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {upcomingTasks && upcomingTasks.length > 0 ? (
                  <div className="space-y-3">
                    {upcomingTasks.map((task) => (
                      <Link 
                        key={task.id} 
                        to="/tasks"
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckSquare className="h-4 w-4 text-muted-foreground shrink-0" />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            {task.due_date && (
                              <p className={cn(
                                "text-xs",
                                new Date(task.due_date) < new Date() 
                                  ? "text-destructive" 
                                  : "text-muted-foreground"
                              )}>
                                {format(new Date(task.due_date), 'd MMM', { locale: dateLocale })}
                              </p>
                            )}
                          </div>
                        </div>
                        {getPriorityBadge(task.priority)}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="p-3 rounded-xl bg-muted/50 mb-3">
                      <Clock className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-muted-foreground font-medium">{t("dashboard.noTasksScheduled")}</p>
                    <Button variant="link" size="sm" className="mt-2 text-muted-foreground" asChild>
                      <Link to="/tasks">
                        <Plus className="mr-1.5 h-4 w-4" />
                        {t("dashboard.createFirstTask")}
                      </Link>
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-muted-foreground" />
              {t("dashboard.recentActivity")}
            </CardTitle>
            <CardDescription>
              {isAdmin ? t("dashboard.recentActivityAdmin") : t("dashboard.recentActivityUser")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {recentActivity && recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.map((activity) => (
                  <div 
                    key={activity.id} 
                    className="flex items-start gap-4 p-3 rounded-lg bg-muted/30"
                  >
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      activity.type === 'email' && "bg-blue-100 dark:bg-blue-900/30",
                      activity.type === 'analysis' && "bg-purple-100 dark:bg-purple-900/30",
                      activity.type === 'lead' && "bg-green-100 dark:bg-green-900/30"
                    )}>
                      {activity.type === 'email' && <Mail className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
                      {activity.type === 'analysis' && <BarChart3 className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
                      {activity.type === 'lead' && <Target className="h-4 w-4 text-green-600 dark:text-green-400" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{activity.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{activity.subtitle}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(activity.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-3 rounded-xl bg-muted/50 mb-3">
                  <Clock className="h-6 w-6 text-muted-foreground/50" />
                </div>
                <p className="text-muted-foreground font-medium">{t("dashboard.noActivity")}</p>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  {t("dashboard.noActivityDesc")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
