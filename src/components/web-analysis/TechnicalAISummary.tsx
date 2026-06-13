import { useTranslation } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import { PageSpeedResult } from "@/lib/api/webAnalysis";

interface TechnicalAISummaryProps {
  result: PageSpeedResult;
  url: string;
}

export function TechnicalAISummary({ result, url }: TechnicalAISummaryProps) {
  const { t } = useTranslation();
  const [summary, setSummary] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      const analysisData = {
        url,
        performance_score: result.performance_score,
        accessibility_score: result.accessibility_score,
        best_practices_score: result.best_practices_score,
        seo_score: result.seo_score,
        pwa_score: result.pwa_score,
        metrics: result.metrics,
        opportunities: result.opportunities || [],
        diagnostics: result.diagnostics || [],
        performanceAudits: result.performanceAudits || [],
        accessibilityAudits: result.accessibilityAudits || [],
        seoAudits: result.seoAudits || [],
        bestPracticesAudits: result.bestPracticesAudits || [],
      };

      const { data, error } = await supabase.functions.invoke("generate-technical-summary", {
        body: { analysisData },
      });

      if (error) {
        console.error("Error generating technical summary:", error);
        toast.error(t("webAnalysis.couldNotGenerateSummary"));
        return;
      }

      if (data?.success && data?.summary) {
        setSummary(data.summary);
      } else {
        toast.error(data?.error || t("webAnalysis.couldNotGenerateSummary"));
      }
    } catch (error) {
      console.error("Error:", error);
      toast.error(t("webAnalysis.summaryGenError"));
    } finally {
      setIsLoading(false);
    }
  };

  if (summary) {
    return (
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            Pedagogisk AI-förklaring
          </CardTitle>
          <CardDescription>
            Förstå varför resultatet blev som det blev
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown>{summary}</ReactMarkdown>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={generateSummary}
            disabled={isLoading}
            className="mt-4"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Genererar...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generera ny förklaring
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <GraduationCap className="h-5 w-5" />
          Pedagogisk AI-förklaring
        </CardTitle>
        <CardDescription>
          Förstå varför hemsidan fick dessa resultat – på ett enkelt och lärorikt sätt
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-4">
          En sida kan se fantastisk ut visuellt men ändå få låga poäng på prestanda. 
          Låt AI förklara vad som händer "under huven" och varför det spelar roll.
        </p>
        <Button
          onClick={generateSummary}
          disabled={isLoading}
          className="w-full sm:w-auto"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analyserar tekniska detaljer...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generera pedagogisk förklaring
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
