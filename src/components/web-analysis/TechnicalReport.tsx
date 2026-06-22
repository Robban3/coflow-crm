import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSpeedResult } from "@/lib/api/webAnalysis";
import { useTranslation } from "@/i18n/LanguageProvider";
import { MetricsGrid } from "./MetricsGrid";
import { AuditList } from "./AuditList";
import { TechnicalAISummary } from "./TechnicalAISummary";
import { 
  Gauge, 
  Lightbulb,
  AlertTriangle,
  CheckCircle,
  Search
} from "lucide-react";

interface TechnicalReportProps {
  result: PageSpeedResult;
  url: string;
}

export function TechnicalReport({ result, url }: TechnicalReportProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      {/* AI Pedagogical Summary */}
      <TechnicalAISummary result={result} url={url} />

      {/* Core Web Vitals */}
      {result.metrics && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              Core Web Vitals
            </CardTitle>
            <CardDescription>
              {t("webAnalysis.coreWebVitalsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MetricsGrid metrics={result.metrics} />
          </CardContent>
        </Card>
      )}

      {/* Category Audits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("webAnalysis.detailedAnalysisPerCategory")}</CardTitle>
          <CardDescription>
            {t("webAnalysis.detailedAnalysisDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="opportunities" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
              <TabsTrigger value="opportunities" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden sm:inline">{t("webAnalysis.tabImprovements")}</span>
                <span className="sm:hidden">{t("webAnalysis.tabImprovementsShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">{t("webAnalysis.tabDiagnostics")}</span>
                <span className="sm:hidden">{t("webAnalysis.tabDiagnosticsShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="passed" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">{t("webAnalysis.tabPassed")}</span>
                <span className="sm:hidden">{t("webAnalysis.tabPassedShort")}</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">{t("webAnalysis.tabAll")}</span>
                <span className="sm:hidden">{t("webAnalysis.tabAll")}</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities" className="mt-4 space-y-4">
              <AuditList
                audits={result.opportunities || []}
                title={t("webAnalysis.auditOpportunitiesTitle")}
                emptyMessage={t("webAnalysis.auditOpportunitiesEmpty")}
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="diagnostics" className="mt-4 space-y-4">
              <AuditList
                audits={result.diagnostics || []}
                title={t("webAnalysis.auditDiagnosticsTitle")}
                emptyMessage={t("webAnalysis.auditDiagnosticsEmpty")}
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="passed" className="mt-4 space-y-4">
              <AuditList 
                audits={result.passedAudits || []} 
                title={t("webAnalysis.auditPassedTitle")} 
                emptyMessage={t("webAnalysis.auditPassedEmpty")}
                showScore={false}
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="all" className="mt-4 space-y-4">
              {result.performanceAudits && result.performanceAudits.length > 0 && (
                <AuditList 
                  audits={result.performanceAudits} 
                  title={t("webAnalysis.auditPerformanceTitle", { count: result.performanceAudits.length })}
                />
              )}
              {result.accessibilityAudits && result.accessibilityAudits.length > 0 && (
                <AuditList 
                  audits={result.accessibilityAudits} 
                  title={t("webAnalysis.auditAccessibilityTitle", { count: result.accessibilityAudits.length })}
                />
              )}
              {result.seoAudits && result.seoAudits.length > 0 && (
                <AuditList 
                  audits={result.seoAudits} 
                  title={t("webAnalysis.auditSeoTitle", { count: result.seoAudits.length })}
                />
              )}
              {result.bestPracticesAudits && result.bestPracticesAudits.length > 0 && (
                <AuditList 
                  audits={result.bestPracticesAudits} 
                  title={t("webAnalysis.auditBestPracticesTitle", { count: result.bestPracticesAudits.length })}
                />
              )}
              {result.pwaAudits && result.pwaAudits.length > 0 && (
                <AuditList 
                  audits={result.pwaAudits} 
                  title={t("webAnalysis.auditPwaTitle", { count: result.pwaAudits.length })}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
