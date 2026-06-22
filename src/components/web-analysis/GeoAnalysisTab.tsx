import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { fromTable } from "@/components/documents/supabaseHelper";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { useTranslation } from "@/i18n/LanguageProvider";
import {
  Brain,
  Loader2,
  Play,
  Clock,
  AlertTriangle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  RefreshCw,
} from "lucide-react";

interface Props {
  url: string;
  leadId?: string | null;
  isRunning: boolean;
  onRun: () => void;
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
    case "quick_win": return { label: t("webAnalysis.priorityQuickWin"), icon: <Zap className="h-3 w-3" /> };
    case "medium": return { label: t("webAnalysis.priorityMedium"), icon: <Target className="h-3 w-3" /> };
    case "long_term": return { label: t("webAnalysis.priorityLongTerm"), icon: <Clock className="h-3 w-3" /> };
    default: return { label: p, icon: null };
  }
};

function getDomainHost(url: string): string {
  try {
    let u = url.trim();
    if (!u.startsWith("http")) u = `https://${u}`;
    return new URL(u).hostname;
  } catch {
    return url;
  }
}

export function GeoAnalysisTab({ url, leadId, isRunning, onRun }: Props) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const domainHost = getDomainHost(url);

  // Query by leadId if available, otherwise by domain
  const { data: geoAnalyses, refetch } = useQuery({
    queryKey: ["geo-analyses-web", leadId, domainHost],
    queryFn: async () => {
      let query = fromTable("geo_analyses")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(5);

      if (leadId) {
        query = query.eq("lead_id", leadId);
      } else {
        query = query.eq("domain", domainHost);
      }

      const { data } = await query;
      return (data || []) as any[];
    },
    enabled: !!url,
    // Keep polling while a run is in flight OR the latest row is still
    // running/queued in the DB — the `isRunning` prop flips to false as soon as
    // the edge function returns, which can be before the status row is updated.
    // Polling on the real status avoids a spinner that never resolves.
    refetchInterval: (query) => {
      if (isRunning) return 3000;
      const status = (query.state.data as any[] | undefined)?.[0]?.status;
      return status === "running" || status === "queued" ? 3000 : false;
    },
  });

  const latestGeo = geoAnalyses?.[0] || null;

  const { data: geoDetails } = useQuery({
    queryKey: ["geo-details-web", latestGeo?.id],
    queryFn: async () => {
      if (!latestGeo?.id) return null;
      const [findingsRes, actionsRes] = await Promise.all([
        fromTable("geo_findings").select("*").eq("geo_analysis_id", latestGeo.id).order("severity"),
        fromTable("geo_actions").select("*").eq("geo_analysis_id", latestGeo.id),
      ]);
      return {
        findings: (findingsRes.data || []) as any[],
        actions: (actionsRes.data || []) as any[],
      };
    },
    enabled: !!latestGeo?.id && latestGeo.status === "completed",
  });

  if (!latestGeo) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Brain className="h-10 w-10 mx-auto mb-3 opacity-50 text-muted-foreground" />
          <p className="text-sm font-medium mb-1">{t("webAnalysis.geoNoneRunTitle")}</p>
          <p className="text-xs text-muted-foreground mb-4">{t("webAnalysis.geoNoneRunDesc")}</p>
          <Button size="sm" onClick={onRun} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <Play className="mr-1 h-3 w-3" />}
            {t("webAnalysis.runGeoAnalysis")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (latestGeo.status === "running" || latestGeo.status === "queued") {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-primary" />
          <p className="text-sm font-medium">{t("webAnalysis.geoRunning")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("webAnalysis.geoRunningDesc")}</p>
        </CardContent>
      </Card>
    );
  }

  if (latestGeo.status === "failed") {
    return (
      <Card>
        <CardContent className="text-center py-12 text-destructive">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">{t("webAnalysis.geoFailed")}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={onRun} disabled={isRunning}>
            <RefreshCw className="mr-1 h-3 w-3" /> {t("webAnalysis.tryAgain")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Score + run again */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">{t("webAnalysis.geoAiVisibility")}</CardTitle>
            <CardDescription className="text-xs">
              {format(new Date(latestGeo.completed_at || latestGeo.created_at), "d MMM yyyy HH:mm", { locale: dateLocale })}
            </CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={onRun} disabled={isRunning}>
            {isRunning ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <RefreshCw className="mr-1 h-3 w-3" />}
            {t("webAnalysis.runAgain")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Score */}
          <div className={`rounded-lg border p-4 text-center ${getScoreBg(latestGeo.geo_score)}`}>
            <p className="text-xs text-muted-foreground mb-1">{t("webAnalysis.geoScore")}</p>
            <p className={`text-4xl font-bold ${getScoreColor(latestGeo.geo_score)}`}>
              {latestGeo.geo_score ?? "-"}
              <span className="text-lg text-muted-foreground">/100</span>
            </p>
          </div>

          {/* Summary */}
          {latestGeo.summary && (
            <div className="p-3 rounded-lg bg-muted/50 text-sm">
              {latestGeo.summary}
            </div>
          )}

          {/* Detailed report */}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full">
                {detailsOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                {detailsOpen ? t("webAnalysis.hideDetails") : t("webAnalysis.showDetailedReport")}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-4">
              {geoDetails?.findings && geoDetails.findings.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("webAnalysis.identifiedProblems", { count: geoDetails.findings.length })}</h4>
                  <div className="space-y-2">
                    {geoDetails.findings.map((f: any) => (
                      <div key={f.id} className="p-3 rounded-lg border bg-background">
                        <div className="flex items-start gap-2">
                          {severityIcon(f.severity)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{f.title}</p>
                            {f.description && <p className="text-xs text-muted-foreground mt-1">{f.description}</p>}
                            {f.recommendation && <p className="text-xs text-primary mt-1">💡 {f.recommendation}</p>}
                          </div>
                          <Badge variant={f.severity === "high" ? "destructive" : f.severity === "medium" ? "secondary" : "outline"} className="text-[10px] shrink-0">
                            {f.severity === "high" ? t("webAnalysis.severityHigh") : f.severity === "medium" ? t("webAnalysis.severityMedium") : t("webAnalysis.severityLow")}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {geoDetails?.actions && geoDetails.actions.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">{t("webAnalysis.recommendedActions", { count: geoDetails.actions.length })}</h4>
                  <div className="space-y-2">
                    {(["quick_win", "medium", "long_term"] as const).map((prio) => {
                      const items = geoDetails.actions.filter((a: any) => a.priority === prio);
                      if (items.length === 0) return null;
                      const p = priorityLabel(prio, t);
                      return (
                        <div key={prio}>
                          <div className="flex items-center gap-2 mb-1">
                            {p.icon}
                            <span className="text-xs font-semibold">{p.label}</span>
                          </div>
                          {items.map((a: any) => (
                            <div key={a.id} className="ml-5 p-2 rounded border bg-background mb-1">
                              <p className="text-sm font-medium">{a.title}</p>
                              {a.steps && <p className="text-xs text-muted-foreground mt-1">{a.steps}</p>}
                              <div className="flex gap-3 mt-1">
                                {a.estimated_impact && <span className="text-[10px] text-muted-foreground">{t("webAnalysis.impact", { value: a.estimated_impact })}</span>}
                                {a.estimated_effort && <span className="text-[10px] text-muted-foreground">{t("webAnalysis.effort", { value: a.estimated_effort })}</span>}
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
        </CardContent>
      </Card>
    </div>
  );
}
