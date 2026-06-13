import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useToast } from "@/components/ui/use-toast";
import { buildGeoReportPayload } from "@/components/reports/buildGeoReport";
import { validateReportSchema } from "@/components/reports/reportSchema";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  BarChart3,
  Brain,
  Eye,
  Loader2,
  Play,
  Clock,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  AlertCircle,
  DollarSign,
  RefreshCw,
  FileText,
  Link2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { UserAvatar } from "@/components/ui/user-avatar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WebAnalysis {
  id: string;
  url: string;
  performance_score: number | null;
  accessibility_score: number | null;
  seo_score: number | null;
  best_practices_score: number | null;
  analyzed_by: string | null;
  created_at: string;
}

interface GeoAnalysis {
  id: string;
  domain: string;
  status: string;
  geo_score: number | null;
  summary: string | null;
  created_at: string;
  completed_at: string | null;
}

interface GeoFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  recommendation: string | null;
}

interface GeoAction {
  id: string;
  priority: string;
  title: string;
  steps: string | null;
  estimated_impact: string | null;
  estimated_effort: string | null;
}

interface SeoCache {
  domain: string;
  data: any;
  created_at: string;
  ttl_days: number;
}

interface Props {
  leadId: string;
  website: string | null;
  analyses: WebAnalysis[];
  seoData: any;
  onNavigateAnalyze: () => void;
}

const getScoreColor = (score: number | null) => {
  if (score === null) return "text-muted-foreground";
  if (score >= 80) return "text-green-600 dark:text-green-400";
  if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
};

const getScoreBg = (score: number | null) => {
  if (score === null) return "bg-muted";
  if (score >= 80) return "bg-green-500/10 border-green-500/20";
  if (score >= 50) return "bg-yellow-500/10 border-yellow-500/20";
  return "bg-red-500/10 border-red-500/20";
};

const severityIcon = (s: string) => {
  switch (s) {
    case "high": return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "medium": return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    default: return <AlertCircle className="h-4 w-4 text-blue-500" />;
  }
};

const priorityLabel = (p: string, t: (key: string) => string) => {
  switch (p) {
    case "quick_win": return { label: t("leadDetail.ac_priorityQuickWin"), variant: "default" as const, icon: <Zap className="h-3 w-3" /> };
    case "medium": return { label: t("leadDetail.ac_priorityMedium"), variant: "secondary" as const, icon: <Target className="h-3 w-3" /> };
    case "long_term": return { label: t("leadDetail.ac_priorityLongTerm"), variant: "outline" as const, icon: <Clock className="h-3 w-3" /> };
    default: return { label: p, variant: "outline" as const, icon: null };
  }
};

export function AnalysisCenter({ leadId, website, analyses, seoData, onNavigateAnalyze }: Props) {
  const [isRunningGeo, setIsRunningGeo] = useState(false);
  const [isRunningSeo, setIsRunningSeo] = useState(false);
  const [geoReportOpen, setGeoReportOpen] = useState(false);
  const [isCreatingReport, setIsCreatingReport] = useState(false);
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const domainHost = website ? (() => {
    try {
      let url = website.trim();
      if (!url.startsWith("http")) url = `https://${url}`;
      return new URL(url).hostname;
    } catch { return website; }
  })() : null;

  // Fetch GEO analyses
  const { data: geoAnalyses } = useQuery({
    queryKey: ["geo-analyses", leadId],
    queryFn: async () => {
      const { data } = await fromTable("geo_analyses")
        .select("*")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(5);
      return (data || []) as GeoAnalysis[];
    },
    enabled: !!leadId,
  });

  const latestGeo = geoAnalyses?.[0] || null;

  // Fetch findings + actions for latest GEO
  const { data: geoDetails } = useQuery({
    queryKey: ["geo-details", latestGeo?.id],
    queryFn: async () => {
      if (!latestGeo?.id) return null;
      const [findingsRes, actionsRes] = await Promise.all([
        fromTable("geo_findings").select("*").eq("geo_analysis_id", latestGeo.id).order("severity"),
        fromTable("geo_actions").select("*").eq("geo_analysis_id", latestGeo.id),
      ]);
      return {
        findings: (findingsRes.data || []) as GeoFinding[],
        actions: (actionsRes.data || []) as GeoAction[],
      };
    },
    enabled: !!latestGeo?.id && latestGeo.status === "completed",
  });

  // Fetch SEO cache
  const { data: seoCache } = useQuery({
    queryKey: ["seo-cache", domainHost],
    queryFn: async () => {
      if (!domainHost) return null;
      const { data } = await fromTable("seo_cache")
        .select("*")
        .eq("domain", domainHost)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as SeoCache | null;
    },
    enabled: !!domainHost,
  });

  const seoCacheValid = seoCache
    ? new Date().getTime() - new Date(seoCache.created_at).getTime() < seoCache.ttl_days * 86400000
    : false;

  // Fetch existing GEO reports for this lead
  const { data: existingReports } = useQuery({
    queryKey: ["lead-reports", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, title, report_type, created_at, data")
        .eq("lead_id", leadId)
        .eq("report_type", "geo")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!leadId,
  });

  // Fetch report shares for existing reports
  const latestReport = existingReports?.[0];
  const { data: reportShare, refetch: refetchShare } = useQuery({
    queryKey: ["report-share", latestReport?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("report_shares")
        .select("*")
        .eq("report_id", latestReport!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!latestReport?.id,
  });

  const handleRunGeo = async () => {
    setIsRunningGeo(true);
    try {
      const res = await supabase.functions.invoke("run-geo-analysis", {
        body: { leadId },
      });
      if (res.error) throw new Error(res.error.message);
      toast({ title: t("leadDetail.ac_toastGeoDoneTitle"), description: t("leadDetail.ac_toastGeoDoneDesc", { score: res.data.geo_score }) });
      queryClient.invalidateQueries({ queryKey: ["geo-analyses", leadId] });
    } catch (e) {
      toast({
        title: t("leadDetail.ac_toastGeoErrorTitle"),
        description: e instanceof Error ? e.message : t("leadDetail.ac_unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsRunningGeo(false);
    }
  };

  const handleRunSeo = async () => {
    if (!website) return;
    setIsRunningSeo(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      let organizationId: string | null = null;
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();
        organizationId = profile?.organization_id || null;
      }

      const res = await supabase.functions.invoke("analyze-seo", {
        body: { url: website, leadId, organizationId },
      });
      if (res.error) throw new Error(res.error.message);
      if (!res.data?.success) throw new Error(res.data?.error || t("leadDetail.ac_seoAnalysisFailed"));

      toast({
        title: t("leadDetail.ac_toastSeoDoneTitle"),
        description: t("leadDetail.ac_toastSeoDoneDesc", { score: res.data.data?.visibility_score ?? "–" }),
      });
      queryClient.invalidateQueries({ queryKey: ["lead-detail", leadId] });
      queryClient.invalidateQueries({ queryKey: ["seo-cache", domainHost] });
    } catch (e) {
      toast({
        title: t("leadDetail.ac_toastSeoErrorTitle"),
        description: e instanceof Error ? e.message : t("leadDetail.ac_unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsRunningSeo(false);
    }
  };

  const handleCreateReport = async () => {
    if (!latestGeo || latestGeo.status !== "completed" || !geoDetails) return;
    setIsCreatingReport(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const leadInfo = { company_name: null as string | null, website };

      // Get lead company name and organization_id
      const { data: leadData } = await supabase
        .from("leads")
        .select("company_name, organization_id")
        .eq("id", leadId)
        .single();
      leadInfo.company_name = leadData?.company_name || null;
      const organizationId = leadData?.organization_id || null;

      const payload = buildGeoReportPayload(
        leadInfo,
        latestGeo,
        geoDetails.findings,
        geoDetails.actions
      );

      if (!validateReportSchema(payload)) {
        throw new Error(t("leadDetail.ac_invalidReportSchema"));
      }

      const { data: report, error } = await supabase
        .from("reports")
        .insert({
          lead_id: leadId,
          organization_id: organizationId,
          report_type: "geo",
          title: payload.hero.title,
          data: payload as any,
          source_refs: { geo_analysis_id: latestGeo.id } as any,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create share row (disabled by default)
      await supabase.from("report_shares").insert({
        report_id: report.id,
        enabled: false,
      });

      toast({ title: t("leadDetail.ac_toastReportCreatedTitle"), description: t("leadDetail.ac_toastReportCreatedDesc") });
      queryClient.invalidateQueries({ queryKey: ["lead-reports", leadId] });
    } catch (e) {
      toast({
        title: t("leadDetail.ac_toastErrorTitle"),
        description: e instanceof Error ? e.message : t("leadDetail.ac_couldNotCreateReport"),
        variant: "destructive",
      });
    } finally {
      setIsCreatingReport(false);
    }
  };

  const latestAnalysis = analyses.length > 0 ? analyses[0] : null;
  const avgWebScore = latestAnalysis
    ? Math.round(
        ((latestAnalysis.performance_score || 0) +
          (latestAnalysis.seo_score || 0) +
          (latestAnalysis.accessibility_score || 0) +
          (latestAnalysis.best_practices_score || 0)) / 4
      )
    : null;

  return (
    <div className="space-y-4">
      <Tabs defaultValue="web" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="web" className="text-xs sm:text-sm">
            <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {t("leadDetail.ac_tabWeb")}
          </TabsTrigger>
          <TabsTrigger value="geo" className="text-xs sm:text-sm">
            <Brain className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {t("leadDetail.ac_tabGeo")}
          </TabsTrigger>
          <TabsTrigger value="seo" className="text-xs sm:text-sm">
            <Eye className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
            {t("leadDetail.ac_tabSeo")}
            <Badge variant="outline" className="ml-1 text-[9px] px-1 py-0">{t("leadDetail.ac_badgePaid")}</Badge>
          </TabsTrigger>
        </TabsList>

        {/* ───── WEBBANALYS TAB ───── */}
        <TabsContent value="web" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{t("leadDetail.ac_webTitle")}</CardTitle>
                <CardDescription className="text-xs">Lighthouse / PageSpeed</CardDescription>
              </div>
              {website && (
                <Button size="sm" onClick={onNavigateAnalyze}>
                  <Play className="mr-1 h-3 w-3" /> {t("leadDetail.ac_newAnalysis")}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!latestAnalysis ? (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("leadDetail.ac_noAnalysesYet")}</p>
                  {website && (
                    <Button size="sm" className="mt-3" onClick={onNavigateAnalyze}>
                      {t("leadDetail.ac_runAnalysis")}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {analyses.slice(0, 3).map((a) => (
                    <Link
                      key={a.id}
                      to={`/web-analysis?viewId=${a.id}`}
                      className="block p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(a.created_at), "d MMM yyyy", { locale: dateLocale })}
                        </span>
                        {a.analyzed_by && <UserAvatar userId={a.analyzed_by} size="xs" />}
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {[
                          { label: t("leadDetail.ac_metricPerformance"), score: a.performance_score },
                          { label: t("leadDetail.ac_metricAccessibility"), score: a.accessibility_score },
                          { label: t("leadDetail.ac_metricSeo"), score: a.seo_score },
                          { label: t("leadDetail.ac_metricBestPractices"), score: a.best_practices_score },
                        ].map((m) => (
                          <div key={m.label}>
                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                            <p className={`text-lg font-bold ${getScoreColor(m.score)}`}>{m.score ?? "-"}</p>
                          </div>
                        ))}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── GEO / AI TAB ───── */}
        <TabsContent value="geo" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base">{t("leadDetail.ac_geoTitle")}</CardTitle>
                <CardDescription className="text-xs">{t("leadDetail.ac_geoDescription")}</CardDescription>
              </div>
              {website && (
                <Button size="sm" onClick={handleRunGeo} disabled={isRunningGeo}>
                  {isRunningGeo ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> {t("leadDetail.ac_running")}</>
                  ) : (
                    <><Play className="mr-1 h-3 w-3" /> {t("leadDetail.ac_runGeoAnalysis")}</>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!latestGeo ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Brain className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t("leadDetail.ac_noGeoYet")}</p>
                  <p className="text-xs mt-1">{t("leadDetail.ac_geoEmptyHint")}</p>
                  {website && (
                    <Button size="sm" className="mt-3" onClick={handleRunGeo} disabled={isRunningGeo}>
                      {isRunningGeo ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Brain className="mr-1 h-3 w-3" />}
                      {t("leadDetail.ac_runGeoAnalysis")}
                    </Button>
                  )}
                </div>
              ) : latestGeo.status === "running" ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2 text-primary" />
                  <p className="text-sm">{t("leadDetail.ac_analyzing")}</p>
                </div>
              ) : latestGeo.status === "failed" ? (
                <div className="text-center py-8 text-destructive">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p className="text-sm">{t("leadDetail.ac_analysisFailed")}</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={handleRunGeo}>
                    <RefreshCw className="mr-1 h-3 w-3" /> {t("leadDetail.ac_tryAgain")}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Score */}
                  <div className={`rounded-lg border p-4 text-center ${getScoreBg(latestGeo.geo_score)}`}>
                    <p className="text-xs text-muted-foreground mb-1">GEO-poäng</p>
                    <p className={`text-4xl font-bold ${getScoreColor(latestGeo.geo_score)}`}>
                      {latestGeo.geo_score ?? "-"}
                      <span className="text-lg text-muted-foreground">/100</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(latestGeo.completed_at || latestGeo.created_at), "d MMM yyyy HH:mm", { locale: sv })}
                    </p>
                  </div>

                  {/* Summary */}
                  {latestGeo.summary && (
                    <div className="p-3 rounded-lg bg-muted/50 text-sm">
                      {latestGeo.summary}
                    </div>
                  )}

                  {/* Detailed report toggle */}
                  <Collapsible open={geoReportOpen} onOpenChange={setGeoReportOpen}>
                    <CollapsibleTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full">
                        {geoReportOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                        {geoReportOpen ? "Dölj detaljer" : "Visa detaljerad rapport"}
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-3 space-y-4">
                      {/* Findings */}
                      {geoDetails?.findings && geoDetails.findings.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Identifierade problem ({geoDetails.findings.length})</h4>
                          <div className="space-y-2">
                            {geoDetails.findings.map((f) => (
                              <div key={f.id} className="p-3 rounded-lg border bg-background">
                                <div className="flex items-start gap-2">
                                  {severityIcon(f.severity)}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium">{f.title}</p>
                                    {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                                    {f.recommendation && (
                                      <p className="text-xs text-primary mt-1">💡 {f.recommendation}</p>
                                    )}
                                  </div>
                                  <Badge variant={f.severity === "high" ? "destructive" : f.severity === "medium" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                                    {f.severity === "high" ? t("leadDetail.ldp_priorityHigh") : f.severity === "medium" ? "Medium" : t("leadDetail.ldp_priorityLow")}
                                  </Badge>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {geoDetails?.actions && geoDetails.actions.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Rekommenderade åtgärder ({geoDetails.actions.length})</h4>
                          <div className="space-y-2">
                            {(["quick_win", "medium", "long_term"] as const).map((prio) => {
                              const items = geoDetails.actions.filter((a) => a.priority === prio);
                              if (items.length === 0) return null;
                              const p = priorityLabel(prio);
                              return (
                                <div key={prio}>
                                  <div className="flex items-center gap-2 mb-1">
                                    {p.icon}
                                    <span className="text-xs font-semibold">{p.label}</span>
                                  </div>
                                  {items.map((a) => (
                                    <div key={a.id} className="ml-5 p-2 rounded border bg-background mb-1">
                                      <p className="text-sm font-medium">{a.title}</p>
                                      {a.steps && <p className="text-xs text-muted-foreground mt-1">{a.steps}</p>}
                                      <div className="flex gap-3 mt-1">
                                        {a.estimated_impact && (
                                          <span className="text-[10px] text-muted-foreground">Impact: {a.estimated_impact}</span>
                                        )}
                                        {a.estimated_effort && (
                                          <span className="text-[10px] text-muted-foreground">Effort: {a.estimated_effort}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>

                  {/* Report generation */}
                  <div className="border-t border-border/50 pt-4 space-y-3">
                    <Button
                      size="sm"
                      className="w-full"
                      onClick={handleCreateReport}
                      disabled={isCreatingReport || !geoDetails}
                    >
                      {isCreatingReport ? (
                        <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Skapar rapport...</>
                      ) : (
                        <><FileText className="mr-1 h-3 w-3" /> Skapa kundrapport</>
                      )}
                    </Button>

                    {latestReport && (
                      <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium">Senaste rapport</p>
                          <span className="text-[10px] text-muted-foreground">
                            {format(new Date(latestReport.created_at), "d MMM yyyy", { locale: sv })}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-1"
                            onClick={() => navigate(`/reports/${latestReport.id}`)}
                          >
                            <Eye className="mr-1 h-3 w-3" /> Öppna rapport
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick Scan section */}
                  <QuickScanSection leadId={leadId} website={website} />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ───── SEO INTELLIGENCE TAB ───── */}
        <TabsContent value="seo" className="mt-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  SEO Intelligence
                  <Badge variant="outline" className="text-[10px]">
                    <DollarSign className="h-3 w-3 mr-0.5" />{t("leadDetail.ac_badgePaid")}</Badge>
                </CardTitle>
                <CardDescription className="text-xs">DataForSEO – realtidsdata om Google-synlighet</CardDescription>
              </div>
              {website && (
                <Button size="sm" onClick={handleRunSeo} disabled={isRunningSeo}>
                  {isRunningSeo ? (
                    <><Loader2 className="mr-1 h-3 w-3 animate-spin" />{t("leadDetail.ac_running")}</>
                  ) : (
                    <><Play className="mr-1 h-3 w-3" /> Kör SEO-analys</>
                  )}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {/* Cache status */}
              {seoCache && (
                <div className={`p-3 rounded-lg border mb-3 ${seoCacheValid ? "bg-green-500/5 border-green-500/20" : "bg-yellow-500/5 border-yellow-500/20"}`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium flex items-center gap-1">
                        {seoCacheValid ? <CheckCircle className="h-3 w-3 text-green-500" /> : <Clock className="h-3 w-3 text-yellow-500" />}
                        {seoCacheValid ? "Cachad data tillgänglig" : "Cachad data utgången"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Senast körd: {format(new Date(seoCache.created_at), "d MMM yyyy", { locale: sv })}
                        {" · "}TTL: {seoCache.ttl_days} dagar
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Current SEO data display */}
              {seoData ? (
                <div className="space-y-3">
                  {seoData.visibility_score !== null && (
                    <div className={`rounded-lg border p-4 text-center ${getScoreBg(seoData.visibility_score)}`}>
                      <p className="text-xs text-muted-foreground mb-1">Google-synlighet</p>
                      <p className={`text-3xl font-bold ${getScoreColor(seoData.visibility_score)}`}>
                        {seoData.visibility_score}<span className="text-lg text-muted-foreground">/100</span>
                      </p>
                    </div>
                  )}
                  {seoData.ai_summary && (
                    <p className="text-sm text-muted-foreground">{seoData.ai_summary}</p>
                  )}
                  {seoData.primary_keywords && seoData.primary_keywords.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold mb-1">Toppnyckelord (Google-rankingar)</p>
                      <div className="flex flex-wrap gap-1">
                        {seoData.primary_keywords.slice(0, 8).map((kw: any, i: number) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">
                            {kw.keyword} {kw.position ? `#${kw.position}` : ''}{kw.search_volume ? ` · ${kw.search_volume} sök/mån` : ''}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Eye className="h-10 w-10 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Ingen SEO-data tillgänglig</p>
                  <p className="text-xs mt-1">Kör SEO Intelligence med knappen ovan</p>
                  {website && (
                    <Button size="sm" className="mt-3" onClick={handleRunSeo} disabled={isRunningSeo}>
                      {isRunningSeo ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Eye className="mr-1 h-3 w-3" />}
                      Kör SEO-analys
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-3 p-2 rounded bg-amber-500/10 border border-amber-500/20">
                <p className="text-[10px] text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  SEO Intelligence kostar credits per körning. Körs manuellt – aldrig automatiskt.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ──── Quick Scan Section ────

function QuickScanSection({ leadId, website }: { leadId: string; website: string | null }) {
  const [isCreating, setIsCreating] = useState(false);
  const { toast } = useToast();

  // Fetch lead info for email
  const { data: lead } = useQuery({
    queryKey: ["lead-for-quickscan", leadId],
    queryFn: async () => {
      const { data } = await supabase
        .from("leads")
        .select("email, company_name, website")
        .eq("id", leadId)
        .single();
      return data;
    },
    enabled: !!leadId,
  });

  // Fetch existing quick scans for this lead
  const { data: quickScans, refetch } = useQuery({
    queryKey: ["quick-scans", leadId],
    queryFn: async () => {
      const { data } = await fromTable("geo_quick_scans")
        .select("id, status, geo_score, public_token, domain, created_at, completed_at")
        .eq("lead_id", leadId)
        .order("created_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!leadId,
  });

  const latestQuickScan = quickScans?.[0] as any;

  const handleCreate = async () => {
    if (!lead?.email || !website) {
      toast({
        title: "Saknar information",
        description: "Leadet måste ha e-post och webbplats för att köra snabbscan.",
        variant: "destructive",
      });
      return;
    }
    setIsCreating(true);
    try {
      const res = await supabase.functions.invoke("geo-quick-scan", {
        body: {
          companyName: lead.company_name || "",
          email: lead.email,
          website: website,
          leadId,
        },
      });
      if (res.error) throw new Error(res.error.message);
      toast({
        title: "Mini-rapport skapad",
        description: `Status: ${res.data.status}`,
      });
      refetch();
    } catch (e) {
      toast({
        title: t("leadDetail.ac_toastErrorTitle"),
        description: e instanceof Error ? e.message : t("leadDetail.ac_unknownError"),
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="border-t border-border/50 pt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold">Mini-rapport (Quick Scan)</p>
      </div>

      {latestQuickScan && (
        <div className="p-3 rounded-lg border bg-muted/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant={latestQuickScan.status === "completed" ? "default" : latestQuickScan.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">
                {latestQuickScan.status === "completed" ? "Klar" : latestQuickScan.status === "running" ? t("leadDetail.ac_running") : latestQuickScan.status === "queued" ? "Köad" : "Misslyckad"}
              </Badge>
              {latestQuickScan.geo_score != null && (
                <span className={`text-sm font-bold ${latestQuickScan.geo_score >= 80 ? "text-green-600 dark:text-green-400" : latestQuickScan.geo_score >= 50 ? "text-yellow-600 dark:text-yellow-400" : "text-red-600 dark:text-red-400"}`}>
                  {latestQuickScan.geo_score}/100
                </span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">
              {latestQuickScan.created_at && format(new Date(latestQuickScan.created_at), "d MMM", { locale: sv })}
            </span>
          </div>
          {latestQuickScan.status === "completed" && (
            <a
              href={`/r/geo/${latestQuickScan.public_token}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <Link2 className="h-3 w-3" /> Öppna publik rapport
            </a>
          )}
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        className="w-full"
        onClick={handleCreate}
        disabled={isCreating || !lead?.email || !website}
      >
        {isCreating ? (
          <><Loader2 className="mr-1 h-3 w-3 animate-spin" /> Skapar...</>
        ) : (
          <><Zap className="mr-1 h-3 w-3" /> Skapa ny mini-rapport</>
        )}
      </Button>
    </div>
  );
}
