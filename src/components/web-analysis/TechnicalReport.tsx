import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageSpeedResult } from "@/lib/api/webAnalysis";
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
  return (
    <div className="space-y-6">
      {/* AI Pedagogical Summary */}
      <TechnicalAISummary result={result} url={url} />

      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Core Web Vitals
          </CardTitle>
          <CardDescription>
            Googles viktigaste mätvärden för användarupplevelse
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MetricsGrid metrics={result.metrics} />
        </CardContent>
      </Card>

      {/* Category Audits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Detaljerad analys per kategori</CardTitle>
          <CardDescription>
            Klicka på varje kategori för att se specifika problem och förbättringar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="opportunities" className="w-full">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4 h-auto">
              <TabsTrigger value="opportunities" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <Lightbulb className="h-4 w-4" />
                <span className="hidden sm:inline">Förbättringar</span>
                <span className="sm:hidden">Förb.</span>
              </TabsTrigger>
              <TabsTrigger value="diagnostics" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <AlertTriangle className="h-4 w-4" />
                <span className="hidden sm:inline">Diagnostik</span>
                <span className="sm:hidden">Diag.</span>
              </TabsTrigger>
              <TabsTrigger value="passed" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <CheckCircle className="h-4 w-4" />
                <span className="hidden sm:inline">Godkänt</span>
                <span className="sm:hidden">OK</span>
              </TabsTrigger>
              <TabsTrigger value="all" className="flex items-center gap-1 text-xs sm:text-sm py-2">
                <Search className="h-4 w-4" />
                <span className="hidden sm:inline">Alla</span>
                <span className="sm:hidden">Alla</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="opportunities" className="mt-4 space-y-4">
              <AuditList 
                audits={result.opportunities} 
                title="Förbättringsmöjligheter" 
                emptyMessage="Inga uppenbara förbättringsmöjligheter hittades"
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="diagnostics" className="mt-4 space-y-4">
              <AuditList 
                audits={result.diagnostics} 
                title="Diagnostiska problem" 
                emptyMessage="Inga diagnostiska problem hittades"
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="passed" className="mt-4 space-y-4">
              <AuditList 
                audits={result.passedAudits || []} 
                title="Godkända tester" 
                emptyMessage="Inga godkända tester att visa"
                showScore={false}
                defaultOpen={true}
              />
            </TabsContent>

            <TabsContent value="all" className="mt-4 space-y-4">
              {result.performanceAudits && result.performanceAudits.length > 0 && (
                <AuditList 
                  audits={result.performanceAudits} 
                  title={`Prestanda (${result.performanceAudits.length} problem)`}
                />
              )}
              {result.accessibilityAudits && result.accessibilityAudits.length > 0 && (
                <AuditList 
                  audits={result.accessibilityAudits} 
                  title={`Tillgänglighet (${result.accessibilityAudits.length} problem)`}
                />
              )}
              {result.seoAudits && result.seoAudits.length > 0 && (
                <AuditList 
                  audits={result.seoAudits} 
                  title={`SEO (${result.seoAudits.length} problem)`}
                />
              )}
              {result.bestPracticesAudits && result.bestPracticesAudits.length > 0 && (
                <AuditList 
                  audits={result.bestPracticesAudits} 
                  title={`Best Practices (${result.bestPracticesAudits.length} problem)`}
                />
              )}
              {result.pwaAudits && result.pwaAudits.length > 0 && (
                <AuditList 
                  audits={result.pwaAudits} 
                  title={`PWA (${result.pwaAudits.length} problem)`}
                />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
