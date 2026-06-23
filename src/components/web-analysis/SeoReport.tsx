import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Search, 
  Globe, 
  FileText, 
  Link2, 
  Shield, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Target,
  Lightbulb,
  Loader2,
  RefreshCw,
  BarChart3,
  Eye,
  ArrowUp,
  Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface RankedKeyword {
  keyword: string;
  position: number;
  search_volume: number;
  traffic: number;
  traffic_cost?: number;
  cpc?: number;
  url?: string;
}

export interface SeoAnalysis {
  id: string;
  url: string;
  visibility_score: number;
  title_tag: string | null;
  meta_description: string | null;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  word_count: number;
  internal_links_count: number;
  external_links_count: number;
  images_count: number;
  images_without_alt: number;
  has_robots_txt: boolean;
  has_sitemap: boolean;
  is_https: boolean;
  has_canonical: boolean;
  has_open_graph: boolean;
  has_twitter_cards: boolean;
  mobile_friendly: boolean;
  primary_keywords: Array<{ keyword: string; count: number; density: number }>;
  estimated_keywords: Array<{ keyword: string; position?: number; search_volume?: number; traffic?: number; estimated_position?: string; opportunity?: string }>;
  ai_summary: string | null;
  ai_opportunities: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low' }>;
  created_at: string;
  raw_data?: {
    ranked_keywords?: RankedKeyword[];
    total_ranked_keywords?: number;
    total_organic_traffic?: number;
    total_traffic_cost?: number;
    top_positions?: number;
    dataforseo_enabled?: boolean;
  };
}

interface SeoReportProps {
  url: string;
  webAnalysisId?: string | null;
  leadId?: string | null;
  onSeoDataLoaded?: (data: SeoAnalysis | null) => void;
}

export function SeoReport({ url, webAnalysisId, leadId, onSeoDataLoaded }: SeoReportProps) {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [seoData, setSeoData] = useState<SeoAnalysis | null>(null);
  const { toast } = useToast();
  const organizationId = useOrganizationId();

  // Load existing SEO analysis on mount
  useEffect(() => {
    loadSeoAnalysis();
  }, [url, webAnalysisId]);

  // Notify parent when SEO data changes
  useEffect(() => {
    onSeoDataLoaded?.(seoData);
  }, [seoData, onSeoDataLoaded]);

  const loadSeoAnalysis = async () => {
    if (!url) return;
    
    setIsLoading(true);
    try {
      // Normalize URL for matching
      const normalizedUrl = url
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '')
        .toLowerCase();

      // Try to find existing analysis by web_analysis_id first, then by URL
      let query = supabase
        .from('seo_analyses')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);
      
      if (webAnalysisId) {
        query = query.eq('web_analysis_id', webAnalysisId);
      } else {
        // Match by normalized URL pattern
        query = query.or(`url.ilike.%${normalizedUrl}%`);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error loading SEO analysis:', error);
      } else if (data && data.length > 0) {
        const analysis = data[0];
        const formattedData: SeoAnalysis = {
          ...analysis,
          primary_keywords: (analysis.primary_keywords as any) || [],
          estimated_keywords: (analysis.estimated_keywords as any) || [],
          ai_opportunities: (analysis.ai_opportunities as any) || [],
          raw_data: (analysis.raw_data as any) || {},
        };
        setSeoData(formattedData);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const runSeoAnalysis = async () => {
    if (!organizationId) {
      toast({
        title: t("webAnalysis.error"),
        description: t("webAnalysis.couldNotFindOrg"),
        variant: "destructive",
      });
      return;
    }

    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-seo', {
        body: { 
          url, 
          webAnalysisId,
          leadId,
          organizationId,
        },
      });

      if (error) {
        throw error;
      }

      if (!data.success) {
        throw new Error(data.error || t("webAnalysis.seoAnalysisFailed"));
      }

      // Data is already saved by the edge function, so we can use it directly
      const formattedData: SeoAnalysis = {
        id: data.savedId || 'temp-' + Date.now(),
        url,
        created_at: new Date().toISOString(),
        ...data.data,
        primary_keywords: data.data.primary_keywords || [],
        estimated_keywords: data.data.estimated_keywords || [],
        ai_opportunities: data.data.ai_opportunities || [],
        raw_data: {
          ranked_keywords: data.data.ranked_keywords || [],
          total_ranked_keywords: data.data.total_ranked_keywords || 0,
          total_organic_traffic: data.data.total_organic_traffic || 0,
          total_traffic_cost: data.data.total_traffic_cost || 0,
          top_positions: data.data.top_positions || 0,
          dataforseo_enabled: data.dataForSeoEnabled || false,
        },
      };

      setSeoData(formattedData);

      const trafficMsg = data.data.total_organic_traffic > 0 
        ? t("webAnalysis.visitorsPerMonthSuffix", { count: data.data.total_organic_traffic }) 
        : '';

      toast({
        title: t("webAnalysis.seoDoneTitle"),
        description: `Visibility score: ${data.data.visibility_score}/100${trafficMsg}`,
      });
    } catch (error) {
      console.error('SEO analysis error:', error);
      toast({
        title: t("webAnalysis.seoAnalysisFailed"),
        description: error instanceof Error ? error.message : t("webAnalysis.anErrorOccurred"),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-600 dark:text-green-400";
    if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getPositionBadge = (position: number) => {
    if (position <= 3) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">#{position}</Badge>;
    }
    if (position <= 10) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">#{position}</Badge>;
    }
    if (position <= 30) {
      return <Badge variant="secondary">#{position}</Badge>;
    }
    return <Badge variant="outline">#{position}</Badge>;
  };

  const getPriorityBadge = (priority: 'high' | 'medium' | 'low') => {
    const styles = {
      high: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    };
    const labels = { high: t("webAnalysis.severityHigh"), medium: t("webAnalysis.priorityMedium"), low: t("webAnalysis.severityLow") };
    return <Badge className={styles[priority]}>{labels[priority]}</Badge>;
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (!seoData) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Search className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h3 className="text-lg font-semibold mb-2">SEO Intelligence</h3>
          <p className="text-muted-foreground text-center mb-4 max-w-md">{t("webAnalysis.seoEmptyDesc")}</p>
          <Button onClick={runSeoAnalysis} disabled={isAnalyzing || !organizationId}>
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("webAnalysis.analyzing")}</>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />{t("webAnalysis.runSeoAnalysis")}</>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Extract ranked keywords from raw_data or estimated_keywords
  const rankedKeywords: RankedKeyword[] = seoData.raw_data?.ranked_keywords || 
    seoData.estimated_keywords?.filter(k => k.position && k.search_volume).map(k => ({
      keyword: k.keyword,
      position: k.position!,
      search_volume: k.search_volume!,
      traffic: k.traffic || 0,
    })) || [];
  
  const hasRealKeywordData = rankedKeywords.length > 0 && rankedKeywords.some(k => k.search_volume > 0);
  const totalTraffic = seoData.raw_data?.total_organic_traffic || 0;
  const totalKeywords = seoData.raw_data?.total_ranked_keywords || rankedKeywords.length;
  const topPositions = seoData.raw_data?.top_positions || rankedKeywords.filter(k => k.position <= 10).length;
  const trafficValue = seoData.raw_data?.total_traffic_cost || 0;
  const automatedAccessBlocked = !!(
    (seoData as any).automated_access_blocked ||
    (seoData.raw_data as any)?.automated_access_blocked
  );

  return (
    <div className="space-y-6">
      {automatedAccessBlocked && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Sajten blockerar automatiserade verktyg (bot-skydd), så on-page-datan
            kan vara ofullständig. Kör Lighthouse i din webbläsare för en exakt bild.
          </span>
        </div>
      )}
      {/* Visibility Score Header with Traffic Stats */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />{t("webAnalysis.googleVisibilityScore")}
                <Badge
                  variant={hasRealKeywordData ? "default" : "secondary"}
                  className="ml-1 gap-1 font-normal"
                >
                  {hasRealKeywordData ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : (
                    <Globe className="h-3 w-3" />
                  )}
                  {hasRealKeywordData
                    ? t("webAnalysis.seoSourceRealBadge")
                    : t("webAnalysis.seoSourceOnPageBadge")}
                </Badge>
              </CardTitle>
              <CardDescription>
                {hasRealKeywordData ? t("webAnalysis.basedOnRealRankings") : t("webAnalysis.basedOnOnPage")}
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={runSeoAnalysis} disabled={isAnalyzing}>
              {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 mb-4">
            <div className={`text-5xl font-bold ${getScoreColor(seoData.visibility_score)}`}>
              {seoData.visibility_score}
            </div>
            <div className="flex-1">
              <Progress 
                value={seoData.visibility_score} 
                className="h-3"
              />
              <p className="text-sm text-muted-foreground mt-2">
                Analyserad: {new Date(seoData.created_at).toLocaleDateString('sv-SE', { 
                  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                })}
              </p>
            </div>
          </div>

          {/* Data-source note when real Google rankings are unavailable */}
          {!hasRealKeywordData && (
            <div className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-500" />
              <span>{t("webAnalysis.seoNoRankingNote")}</span>
            </div>
          )}

          {/* Traffic Stats Grid */}
          {hasRealKeywordData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <Eye className="h-5 w-5" />
                  {formatNumber(totalTraffic)}
                </div>
                <p className="text-xs text-muted-foreground">{t("webAnalysis.visitsPerMonth")}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <Search className="h-5 w-5" />
                  {formatNumber(totalKeywords)}
                </div>
                <p className="text-xs text-muted-foreground">{t("webAnalysis.rankedKeywords")}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-green-600 dark:text-green-400">
                  <ArrowUp className="h-5 w-5" />
                  {topPositions}
                </div>
                <p className="text-xs text-muted-foreground">{t("webAnalysis.inTop10")}</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-primary">
                  <Star className="h-5 w-5" />
                  ${formatNumber(trafficValue)}
                </div>
                <p className="text-xs text-muted-foreground">{t("webAnalysis.trafficValueUsd")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Summary */}
      {seoData.ai_summary && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />{t("webAnalysis.summary")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground leading-relaxed">{seoData.ai_summary}</p>
          </CardContent>
        </Card>
      )}

      {/* Ranked Keywords Table - REAL DATA */}
      {hasRealKeywordData && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />{t("webAnalysis.googleRankings")}<Badge variant="secondary" className="ml-2">DataForSEO</Badge>
            </CardTitle>
            <CardDescription>{t("webAnalysis.realRankedKeywordsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-4">{t("webAnalysis.colKeyword")}</th>
                    <th className="text-center py-2 px-2">{t("webAnalysis.colPosition")}</th>
                    <th className="text-right py-2 px-2">{t("webAnalysis.colSearchVolume")}</th>
                    <th className="text-right py-2 pl-2">{t("webAnalysis.colTraffic")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedKeywords.slice(0, 20).map((kw, index) => (
                    <tr key={index} className="border-b border-muted/50 hover:bg-muted/30">
                      <td className="py-2 pr-4">
                        <span className="font-medium">{kw.keyword}</span>
                      </td>
                      <td className="text-center py-2 px-2">
                        {getPositionBadge(kw.position)}
                      </td>
                      <td className="text-right py-2 px-2 text-muted-foreground">
                        {formatNumber(kw.search_volume)}{t("webAnalysis.perMonthShort")}
                      </td>
                      <td className="text-right py-2 pl-2">
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          {formatNumber(Math.round(kw.traffic))}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rankedKeywords.length > 20 && (
              <p className="text-sm text-muted-foreground mt-4 text-center">
                {t("webAnalysis.showingKeywords", { total: rankedKeywords.length })}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Fallback: Estimated Keywords (when no real data) */}
      {!hasRealKeywordData && seoData.estimated_keywords && seoData.estimated_keywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5" />{t("webAnalysis.estimatedKeywords")}</CardTitle>
            <CardDescription>{t("webAnalysis.estimatedKeywordsDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {seoData.estimated_keywords.map((kw, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <span className="font-medium">{kw.keyword}</span>
                    {kw.opportunity && <p className="text-sm text-muted-foreground">{kw.opportunity}</p>}
                  </div>
                  <Badge variant="outline">Position ~{kw.estimated_position || kw.position || '?'}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Two Column Layout */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Technical SEO Checklist */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Shield className="h-5 w-5" />{t("webAnalysis.technicalSeo")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChecklistItem checked={seoData.is_https} label={t("webAnalysis.checkHttps")} />
            <ChecklistItem checked={seoData.has_sitemap} label={t("webAnalysis.checkSitemap")} />
            <ChecklistItem checked={seoData.has_robots_txt} label={t("webAnalysis.checkRobots")} />
            <ChecklistItem checked={seoData.has_canonical} label={t("webAnalysis.checkCanonical")} />
            <ChecklistItem checked={seoData.has_open_graph} label={t("webAnalysis.checkOpenGraph")} />
            <ChecklistItem checked={seoData.has_twitter_cards} label={t("webAnalysis.checkTwitterCards")} />
            <ChecklistItem checked={seoData.mobile_friendly} label={t("webAnalysis.checkMobileFriendly")} />
            <ChecklistItem checked={seoData.h1_count === 1} label={`H1-tagg (${seoData.h1_count} st)`} />
          </CardContent>
        </Card>

        {/* Content Metrics */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5" />{t("webAnalysis.contentStatistics")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <MetricItem icon={FileText} label={t("webAnalysis.metricWordCount")} value={seoData.word_count.toLocaleString()} />
              <MetricItem icon={Link2} label={t("webAnalysis.metricInternalLinks")} value={seoData.internal_links_count} />
              <MetricItem icon={Globe} label={t("webAnalysis.metricExternalLinks")} value={seoData.external_links_count} />
              <MetricItem
                icon={FileText}
                label={t("webAnalysis.metricImages")}
                value={`${seoData.images_count} (${seoData.images_without_alt} utan alt)`} 
                warning={seoData.images_without_alt > 0}
              />
            </div>
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-1">Titel ({seoData.title_tag?.length || 0} tecken)</p>
              <p className="font-medium text-sm truncate">{seoData.title_tag || '—'}</p>
            </div>
            <div className="mt-3">
              <p className="text-sm text-muted-foreground mb-1">Meta-beskrivning ({seoData.meta_description?.length || 0} tecken)</p>
              <p className="text-sm text-muted-foreground line-clamp-2">{seoData.meta_description || '—'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Keywords from Content */}
      {seoData.primary_keywords && seoData.primary_keywords.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5" />{t("webAnalysis.keywordsInContent")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {seoData.primary_keywords.slice(0, 15).map((kw, index) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {kw.keyword} ({kw.count}) {kw.density}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* AI Opportunities */}
      {seoData.ai_opportunities && seoData.ai_opportunities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />{t("webAnalysis.improvementOpportunities")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {seoData.ai_opportunities.map((opp, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <AlertTriangle className={`h-5 w-5 mt-0.5 ${
                  opp.priority === 'high' ? 'text-red-500' : 
                  opp.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                }`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{opp.title}</span>
                    {getPriorityBadge(opp.priority)}
                  </div>
                  <p className="text-sm text-muted-foreground">{opp.description}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ChecklistItem({ checked, label }: { checked: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {checked ? (
        <CheckCircle className="h-4 w-4 text-green-500" />
      ) : (
        <XCircle className="h-4 w-4 text-red-500" />
      )}
      <span className={checked ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

function MetricItem({ 
  icon: Icon, 
  label, 
  value, 
  warning = false 
}: { 
  icon: React.ElementType; 
  label: string; 
  value: string | number; 
  warning?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${warning ? 'text-yellow-500' : 'text-muted-foreground'}`} />
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={`font-medium ${warning ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>{value}</p>
      </div>
    </div>
  );
}
