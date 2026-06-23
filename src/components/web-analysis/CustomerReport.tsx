import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageSpeedResult, webAnalysisApi } from "@/lib/api/webAnalysis";
import { Sparkles, Loader2, ThumbsUp, ThumbsDown, AlertCircle, Zap, Target } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import ReactMarkdown from "react-markdown";

interface CustomerReportProps {
  result: PageSpeedResult;
  url: string;
  summary: string | null;
  onSummaryGenerated: (summary: string) => void;
}

export function CustomerReport({ result, url, summary, onSummaryGenerated }: CustomerReportProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const handleGenerateSummary = async () => {
    setIsGenerating(true);

    try {
      const response = await webAnalysisApi.generateSummary({
        ...result,
        url,
      });

      if (response.success && response.summary) {
        onSummaryGenerated(response.summary);
        toast({
          title: t("webAnalysis.summaryGeneratedTitle"),
          description: t("webAnalysis.summaryGeneratedDesc"),
        });
      } else {
        toast({
          title: t("webAnalysis.error"),
          description: response.error || t("webAnalysis.couldNotGenerateSummary"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("webAnalysis.error"),
        description: t("webAnalysis.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const num = (v: number | null | undefined) => (typeof v === "number" ? v : 0);

  const getOverallRating = () => {
    const avgScore = (num(result.performance_score) + num(result.accessibility_score) + num(result.seo_score) + num(result.best_practices_score)) / 4;
    if (avgScore >= 90) return { label: t("webAnalysis.ratingExcellent"), color: "bg-green-500", icon: ThumbsUp };
    if (avgScore >= 70) return { label: t("webAnalysis.ratingGood"), color: "bg-green-400", icon: ThumbsUp };
    if (avgScore >= 50) return { label: t("webAnalysis.ratingNeedsImprovement"), color: "bg-yellow-500", icon: AlertCircle };
    return { label: t("webAnalysis.ratingCritical"), color: "bg-red-500", icon: ThumbsDown };
  };

  const rating = getOverallRating();
  const RatingIcon = rating.icon;

  const lcp = result.metrics?.largestContentfulPaint ?? 0;

  const quickInsights = [
    {
      icon: Zap,
      title: t("webAnalysis.insightLoadTime"),
      value: result.metrics ? webAnalysisApi.formatTime(lcp) : "N/A",
      status: lcp <= 2500 ? "good" : lcp <= 4000 ? "warning" : "bad",
      description: lcp <= 2500
        ? t("webAnalysis.insightLoadTimeGood")
        : lcp <= 4000
        ? t("webAnalysis.insightLoadTimeWarning")
        : t("webAnalysis.insightLoadTimeBad"),
    },
    {
      icon: Target,
      title: t("webAnalysis.insightGoogleVisibility"),
      value: typeof result.seo_score === "number" ? `${result.seo_score}/100` : "N/A",
      status: result.seo_score >= 90 ? "good" : result.seo_score >= 50 ? "warning" : "bad",
      description: result.seo_score >= 90
        ? t("webAnalysis.insightGoogleVisibilityGood")
        : result.seo_score >= 50
        ? t("webAnalysis.insightGoogleVisibilityWarning")
        : t("webAnalysis.insightGoogleVisibilityBad"),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Quick Overview */}
      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="text-lg">{t("webAnalysis.quickSummary")}</CardTitle>
              <CardDescription>{t("webAnalysis.quickSummaryDesc")}</CardDescription>
            </div>
            <Badge className={`${rating.color} text-white text-sm px-3 py-1`}>
              <RatingIcon className="h-4 w-4 mr-1" />
              {rating.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            {quickInsights.map((insight) => {
              const Icon = insight.icon;
              return (
                <div 
                  key={insight.title}
                  className={`p-4 rounded-lg border-2 ${
                    insight.status === "good" 
                      ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800" 
                      : insight.status === "warning"
                      ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                      : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <span className="font-medium">{insight.title}</span>
                  </div>
                  <div className="text-2xl font-bold mb-1">{insight.value}</div>
                  <p className="text-sm text-muted-foreground">{insight.description}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("webAnalysis.aiAnalysisSwedish")}
          </CardTitle>
          <CardDescription>
            {t("webAnalysis.aiAnalysisSubtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {summary ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          ) : (
            <div className="text-center py-8">
              <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                {t("webAnalysis.aiAnalysisPrompt")}
              </p>
              <Button onClick={handleGenerateSummary} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t("webAnalysis.generating")}
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    {t("webAnalysis.generateAiSummary")}
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Key Improvements */}
      {(result.opportunities?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{t("webAnalysis.topImprovements")}</CardTitle>
            <CardDescription>
              {t("webAnalysis.topImprovementsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {result.opportunities.slice(0, 5).map((opp, index) => (
                <div 
                  key={opp.id} 
                  className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold shrink-0">
                    {index + 1}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{opp.title}</p>
                    {opp.savings && (
                      <Badge variant="secondary" className="mt-1 text-xs">
                        {t("webAnalysis.canSave", { value: opp.savings })}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
