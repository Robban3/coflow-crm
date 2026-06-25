import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  FileText, 
  Download, 
  Loader2, 
  BarChart3,
  Search,
  Eye,
  Trash2
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

interface Report {
  id: string;
  title: string;
  report_type: string;
  pdf_url: string | null;
  created_at: string;
  lead_id: string | null;
  leads?: { company_name: string | null } | null;
}

interface WebAnalysis {
  id: string;
  url: string;
  performance_score: number | null;
  seo_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  created_at: string;
  leads?: { id: string; company_name: string | null } | null;
}

export function ReportGenerator() {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const { toast } = useToast();
  
  const [reports, setReports] = useState<Report[]>([]);
  const [analyses, setAnalyses] = useState<WebAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [reportType, setReportType] = useState<string>('web_analysis');
  const [selectedAnalysisId, setSelectedAnalysisId] = useState<string>('');
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [reportsRes, analysesRes] = await Promise.all([
        supabase
          .from('reports')
          .select('*, leads(company_name)')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('web_analyses')
          .select('*, leads(id, company_name)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      if (reportsRes.data) {
        setReports(reportsRes.data as Report[]);
      }
      if (analysesRes.data) {
        setAnalyses(analysesRes.data as WebAnalysis[]);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = async () => {
    if (!selectedAnalysisId || !organization?.id) return;

    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      // Fetch the selected analysis
      const analysis = analyses.find(a => a.id === selectedAnalysisId);
      if (!analysis) throw new Error(t("reports.generator.analysisNotFound"));

      // Generate HTML content
      const htmlContent = generateWebAnalysisHtml(analysis, organization, t);
      
      // Save to database
      const { data, error } = await supabase.from('reports').insert({
        organization_id: organization.id,
        lead_id: analysis.leads?.id || null,
        web_analysis_id: analysis.id,
        report_type: reportType,
        title: `Webbanalys - ${analysis.leads?.company_name || analysis.url}`,
        content_html: htmlContent,
        created_by: user?.id,
      }).select().single();

      if (error) throw error;

      toast({
        title: t("reports.generator.created"),
        description: t("reports.generator.createdDesc"),
      });

      setShowDialog(false);
      setSelectedAnalysisId('');
      fetchData();
      
      // Show preview
      setPreviewHtml(htmlContent);
      setShowPreview(true);

    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: t("reports.generator.error"),
        description: t("reports.generator.generateError"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload = (report: Report) => {
    if (report.pdf_url) {
      window.open(report.pdf_url, '_blank');
    } else {
      // Generate downloadable HTML
      const blob = new Blob([previewHtml || ''], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.title.replace(/\s+/g, '-')}.html`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('reports').delete().eq('id', id);
      if (error) throw error;
      
      toast({
        title: t("reports.generator.deleted"),
      });
      
      fetchData();
    } catch (error) {
      toast({
        title: t("reports.generator.error"),
        description: t("reports.generator.deleteError"),
        variant: "destructive",
      });
    }
  };

  const handlePreview = async (report: Report) => {
    // Fetch full report content
    const { data } = await supabase
      .from('reports')
      .select('content_html')
      .eq('id', report.id)
      .single();
    
    if (data?.content_html) {
      setPreviewHtml(data.content_html);
      setShowPreview(true);
    }
  };

  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(previewHtml);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'web_analysis': return t("reports.generator.typeWebAnalysis");
      case 'seo': return t("reports.generator.typeSeo");
      case 'competitor': return t("reports.generator.typeCompetitor");
      default: return type;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => {
          setReportType('web_analysis');
          setShowDialog(true);
        }}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />{t("reports.generator.webCardTitle")}</CardTitle>
            <CardDescription>{t("reports.generator.webCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">
              <FileText className="mr-2 h-4 w-4" />{t("reports.generator.createReport")}</Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" />{t("reports.generator.seoCardTitle")}</CardTitle>
            <CardDescription>{t("reports.generator.seoCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>{t("reports.generator.comingSoon")}</Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer opacity-60">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />{t("reports.generator.competitorCardTitle")}</CardTitle>
            <CardDescription>{t("reports.generator.competitorCardDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" disabled>{t("reports.generator.comingSoon")}</Button>
          </CardContent>
        </Card>
      </div>

      {/* Saved Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t("reports.generator.savedReports")}</CardTitle>
          <CardDescription>{t("reports.generator.savedReportsDesc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-semibold text-foreground mb-1">{t("reports.generator.noReports")}</h3>
              <p className="text-sm text-muted-foreground">{t("reports.generator.noReportsDesc")}</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {reports.map((report) => (
                <div key={report.id} className="flex items-center justify-between py-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{report.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="secondary" className="text-[10px]">
                        {getReportTypeLabel(report.report_type)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(report.created_at), "d MMM yyyy", { locale: sv })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handlePreview(report)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDelete(report.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Report Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("reports.generator.dialogTitle")}</DialogTitle>
            <DialogDescription>{t("reports.generator.dialogDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("reports.generator.selectAnalysis")}</label>
              <Select value={selectedAnalysisId} onValueChange={setSelectedAnalysisId}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.generator.selectAnalysisPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {analyses.map((analysis) => (
                    <SelectItem key={analysis.id} value={analysis.id}>
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[200px]">
                          {analysis.leads?.company_name || analysis.url}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({format(new Date(analysis.created_at), "d/M", { locale: sv })})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>{t("reports.generator.cancel")}</Button>
            <Button onClick={generateReport} disabled={!selectedAnalysisId || isGenerating}>
              {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("reports.generator.generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("reports.generator.preview")}</DialogTitle>
          </DialogHeader>
          <div 
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: previewHtml }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPreview(false)}>{t("reports.generator.close")}</Button>
            <Button onClick={printReport}>
              <Download className="mr-2 h-4 w-4" />{t("reports.generator.printSave")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function escapeHtml(unsafe: string | null | undefined): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeUrl(url: string | null | undefined): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return escapeHtml(trimmed);
  }
  return '';
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

function generateWebAnalysisHtml(analysis: WebAnalysis, organization: { name: string; logo_url?: string | null }, t: TranslateFn) {
  const getScoreClass = (score: number | null) => {
    if (score === null) return 'gray';
    if (score >= 90) return 'green';
    if (score >= 50) return 'yellow';
    return 'red';
  };

  const scores = [
    { label: t("reports.growth.performance"), value: analysis.performance_score },
    { label: t("reports.growth.accessibility"), value: analysis.accessibility_score },
    { label: t("reports.generator.typeSeo"), value: analysis.seo_score },
    { label: t("reports.growth.bestPractices"), value: analysis.best_practices_score },
  ];

  const avgScore = scores
    .filter(s => s.value !== null)
    .reduce((acc, s) => acc + (s.value || 0), 0) / scores.filter(s => s.value !== null).length;

  return `
<!DOCTYPE html>
<html lang="sv">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Webbanalysrapport - ${escapeHtml(analysis.leads?.company_name || analysis.url)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; padding: 40px; max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
    .logo { max-height: 50px; }
    .title { font-size: 24px; font-weight: bold; color: #1a1a1a; }
    .subtitle { color: #666; font-size: 14px; margin-top: 5px; }
    .section { margin-bottom: 30px; }
    .section-title { font-size: 18px; font-weight: 600; margin-bottom: 15px; color: #1a1a1a; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .scores { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; }
    .score-card { background: #f9f9f9; border-radius: 8px; padding: 20px; text-align: center; }
    .score-value { font-size: 36px; font-weight: bold; }
    .score-value.green { color: #22c55e; }
    .score-value.yellow { color: #eab308; }
    .score-value.red { color: #ef4444; }
    .score-value.gray { color: #9ca3af; }
    .score-label { color: #666; font-size: 14px; margin-top: 5px; }
    .summary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border-radius: 12px; padding: 25px; text-align: center; }
    .summary-score { font-size: 48px; font-weight: bold; }
    .summary-label { font-size: 14px; opacity: 0.9; }
    .recommendations { list-style: none; }
    .recommendations li { padding: 12px 0; border-bottom: 1px solid #eee; }
    .recommendations li:last-child { border-bottom: none; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #999; font-size: 12px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">{t("reports.generator.webCardTitle")}</div>
      <div class="subtitle">${escapeHtml(analysis.leads?.company_name)} - ${escapeHtml(analysis.url)}</div>
    </div>
    ${organization.logo_url ? `<img src="${sanitizeUrl(organization.logo_url)}" alt="${escapeHtml(organization.name)}" class="logo">` : `<div style="font-weight:600">${escapeHtml(organization.name)}</div>`}
  </div>

  <div class="section">
    <div class="summary">
      <div class="summary-score">${Math.round(avgScore)}</div>
      <div class="summary-label">${t("reports.generator.avgScoreLabel")}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">${t("reports.generator.scoreSummaryTitle")}</div>
    <div class="scores">
      ${scores.map(s => `
        <div class="score-card">
          <div class="score-value ${getScoreClass(s.value)}">${s.value ?? '-'}</div>
          <div class="score-label">${s.label}</div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Rekommendationer</div>
    <ul class="recommendations">
      ${(analysis.performance_score ?? 100) < 50 ? `<li>${t("reports.generator.improvePerf")}</li>` : ''}
      ${(analysis.seo_score ?? 100) < 50 ? `<li>${t("reports.generator.improveSeo")}</li>` : ''}
      ${(analysis.accessibility_score ?? 100) < 50 ? `<li>${t("reports.generator.improveA11y")}</li>` : ''}
      ${(analysis.best_practices_score ?? 100) < 50 ? `<li>${t("reports.generator.improveBp")}</li>` : ''}
      ${avgScore >= 80 ? `<li>${t("reports.generator.greatJob")}</li>` : ''}
    </ul>
  </div>

  <div class="footer">
    <p>Rapport genererad ${format(new Date(), "d MMMM yyyy", { locale: sv })} av ${escapeHtml(organization.name)}</p>
  </div>
</body>
</html>
  `.trim();
}
