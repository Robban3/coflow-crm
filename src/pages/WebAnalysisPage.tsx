import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarChart3, 
  Globe, 
  Clock, 
  Gauge, 
  Loader2, 
  Smartphone,
  Monitor,
  RefreshCw,
  Eye,
  Accessibility,
  Shield,
  Search,
  FileText,
  Users,
  UserPlus,
  Link2,
  Mail,
  Building2,
  Brain,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { webAnalysisApi, PageSpeedResult, normalizeUrl } from "@/lib/api/webAnalysis";
import { supabase } from "@/integrations/supabase/client";
import { getActiveMarket } from "@/hooks/useMarket";
import { ScoreCard } from "@/components/web-analysis/ScoreCard";
import { TechnicalReport } from "@/components/web-analysis/TechnicalReport";
import { CustomerReport } from "@/components/web-analysis/CustomerReport";
import { SeoReport, SeoAnalysis } from "@/components/web-analysis/SeoReport";
import { CreateLeadDialog } from "@/components/web-analysis/CreateLeadDialog";
import { QuickOutreachDialog } from "@/components/web-analysis/QuickOutreachDialog";
import { LinkedLeadInfo } from "@/components/web-analysis/LinkedLeadInfo";
import { ServiceBusinessPlugin, RestaurantHotelPlugin } from "@/components/web-analysis/IndustryPlugins";
import { GeoAnalysisTab } from "@/components/web-analysis/GeoAnalysisTab";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Analysis {
  id: string;
  url: string;
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  created_at: string;
  raw_data: PageSpeedResult | null;
  lead_id?: string | null;
}

export default function WebAnalysisPage() {
  const [url, setUrl] = useState("");
  const [strategy, setStrategy] = useState<"mobile" | "desktop">("desktop");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<PageSpeedResult | null>(null);
  const [currentUrl, setCurrentUrl] = useState("");
  const [summary, setSummary] = useState<string | null>(null);
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  // Tracks the viewId we've already loaded, so the loader effect doesn't re-run
  // on every `analyses` change and clobber a freshly-run analysis.
  const handledViewIdRef = useRef<string | null>(null);
   const [activeReportTab, setActiveReportTab] = useState<"customer" | "technical" | "seo" | "geo">("customer");
  const [isRunningGeo, setIsRunningGeo] = useState(false);
  const [savedAnalysisId, setSavedAnalysisId] = useState<string | null>(null);
  const [linkedLead, setLinkedLead] = useState<{ id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null } | null>(null);
  const [showCreateLeadDialog, setShowCreateLeadDialog] = useState(false);
  const [showOutreachDialog, setShowOutreachDialog] = useState(false);
  const [seoData, setSeoData] = useState<SeoAnalysis | null>(null);
  const [runSeoAnalysis, setRunSeoAnalysis] = useState(false);
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const { t, language } = useTranslation();
  const dateStringLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";

  const [searchParams] = useSearchParams();

  // Check for URL parameter from leads page
  useEffect(() => {
    const urlParam = searchParams.get('url');
    if (urlParam) {
      setUrl(urlParam);
    }
  }, [searchParams]);

  // Fetch analysis history
  useEffect(() => {
    fetchAnalyses();
  }, []);

  // Handle viewId parameter to directly load a specific analysis
  useEffect(() => {
    const loadAnalysisById = async () => {
      const viewId = searchParams.get('viewId');
      if (!viewId) return;
      // Load a given viewId only once. Without this, the effect re-fires on
      // every `analyses` change — e.g. right after running and saving a new
      // analysis (fetchAnalyses updates `analyses` ~2s later) — and re-applies
      // the stale viewId, reverting the fresh result to an old, often
      // scoreless/red analysis. That was the "scores turn red after 2s" bug.
      if (handledViewIdRef.current === viewId) return;

      // First check if it's in the already loaded analyses
      const existingAnalysis = analyses.find(a => a.id === viewId);
      if (existingAnalysis) {
        handledViewIdRef.current = viewId;
        setSelectedAnalysis(existingAnalysis);
        setCurrentResult(existingAnalysis.raw_data);
        setCurrentUrl(existingAnalysis.url);
        setSummary(null);
        
        // Check if URL is linked to a lead
        const leadMatch = await webAnalysisApi.findLeadByUrl(existingAnalysis.url);
        setLinkedLead(leadMatch);
        return;
      }
      
      // If analyses have loaded but viewId not found, fetch it directly
      if (analyses.length > 0) {
        const { data, error } = await supabase
          .from('web_analyses')
          .select('*')
          .eq('id', viewId)
          .maybeSingle();
        
        if (!error && data) {
          handledViewIdRef.current = viewId;
          const analysis: Analysis = {
            ...data,
            raw_data: data.raw_data as unknown as PageSpeedResult | null,
          };
          setSelectedAnalysis(analysis);
          setCurrentResult(analysis.raw_data);
          setCurrentUrl(analysis.url);
          setSummary(null);
          
          // Check if URL is linked to a lead
          const leadMatch = await webAnalysisApi.findLeadByUrl(analysis.url);
          setLinkedLead(leadMatch);
        }
      }
    };
    
    loadAnalysisById();
  }, [searchParams, analyses]);

  const fetchAnalyses = async () => {
    const { data, error } = await supabase
      .from('web_analyses')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (!error && data) {
      const transformed: Analysis[] = data.map(item => ({
        ...item,
        raw_data: item.raw_data as unknown as PageSpeedResult | null,
      }));
      setAnalyses(transformed);
    }
  };

  const handleAnalyze = async () => {
    if (!url) return;
    
    setIsAnalyzing(true);
    setCurrentResult(null);
    setSummary(null);
    setSelectedAnalysis(null);
    setSavedAnalysisId(null);
    setLinkedLead(null);
    setSeoData(null);
    setRunSeoAnalysis(false);

    try {
      // Check for recent analysis of same URL + strategy (within 3 days)
      const recentCheck = await webAnalysisApi.findRecentAnalysis(url, strategy);
      
      if (recentCheck.found && recentCheck.analysis) {
        // Use existing analysis instead of running a new one
        const existing = recentCheck.analysis;
        setCurrentResult(existing.raw_data);
        setCurrentUrl(existing.url);
        setSelectedAnalysis(existing);
        setSavedAnalysisId(existing.id);
        
        // Check if URL is linked to a lead
        const leadMatch = await webAnalysisApi.findLeadByUrl(existing.url);
        setLinkedLead(leadMatch);
        
        const analysisDate = new Date(existing.created_at).toLocaleDateString(dateStringLocale);
        toast({
          title: t("webAnalysis.existingFoundTitle"),
          description: t("webAnalysis.existingFoundDesc", { date: analysisDate }),
        });
        setIsAnalyzing(false);
        return;
      }

      // Run new analysis
      const response = await webAnalysisApi.analyzeUrl(url, strategy);

      if (response.success && response.data) {
        setCurrentResult(response.data);
        setCurrentUrl(url);
        
        // Auto-save the analysis (tagged with strategy for dedup/history)
        const saveResponse = await webAnalysisApi.saveAnalysis(url, { ...response.data, strategy });
        if (saveResponse.success && saveResponse.id) {
          setSavedAnalysisId(saveResponse.id);
          fetchAnalyses(); // Refresh the list
          // Note: SEO analysis is NOT auto-run anymore - user must click manually
        }
        
        // Check if URL is linked to a lead
        const leadMatch = await webAnalysisApi.findLeadByUrl(url);
        setLinkedLead(leadMatch);
        
        toast({
          title: t("webAnalysis.doneSavedTitle"),
          description: t("webAnalysis.doneSavedDesc", { url }),
        });
      } else {
        toast({
          title: t("webAnalysis.analysisErrorTitle"),
          description: response.error || t("webAnalysis.couldNotAnalyze"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Force a new analysis even if a recent one exists
  const handleForceNewAnalysis = async () => {
    if (!currentUrl) return;
    
    setIsAnalyzing(true);
    setCurrentResult(null);
    setSummary(null);
    setSelectedAnalysis(null);
    setSavedAnalysisId(null);
    setLinkedLead(null);

    try {
      // Force a truly fresh run: bypass the frontend dedup (we're already here)
      // AND the server-side 24h PSI cache, so "Kör om" always re-measures.
      const response = await webAnalysisApi.analyzeUrl(currentUrl, strategy, true);

      if (response.success && response.data) {
        setCurrentResult(response.data);

        // Auto-save the new analysis (tagged with strategy)
        const saveResponse = await webAnalysisApi.saveAnalysis(currentUrl, { ...response.data, strategy });
        if (saveResponse.success && saveResponse.id) {
          setSavedAnalysisId(saveResponse.id);
          fetchAnalyses();
        }
        
        // Check if URL is linked to a lead
        const leadMatch = await webAnalysisApi.findLeadByUrl(currentUrl);
        setLinkedLead(leadMatch);
        
        toast({
          title: t("webAnalysis.reanalysisDoneTitle"),
          description: t("webAnalysis.reanalysisDoneDesc", { url: currentUrl }),
        });
      } else {
        toast({
          title: t("webAnalysis.analysisErrorTitle"),
          description: response.error || t("webAnalysis.couldNotAnalyze"),
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: t("common.error"),
        description: t("common.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleLeadCreated = async (leadId: string) => {
    toast({
      title: t("webAnalysis.leadCreatedTitle"),
      description: t("webAnalysis.leadLinkedDesc"),
    });
    fetchAnalyses();
    // Refresh linked lead
    if (currentUrl) {
      const leadMatch = await webAnalysisApi.findLeadByUrl(currentUrl);
      setLinkedLead(leadMatch);
    }
  };

  const viewAnalysis = async (analysis: Analysis) => {
    setSelectedAnalysis(analysis);
    setCurrentResult(analysis.raw_data);
    setCurrentUrl(analysis.url);
    setSummary(null);

    // Scroll the result into view so you don't have to scroll up manually after
    // clicking a history row. Wait a frame so the result has rendered.
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // Check if URL is linked to a lead
    const leadMatch = await webAnalysisApi.findLeadByUrl(analysis.url);
    setLinkedLead(leadMatch);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 dark:text-green-400";
    if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  return (
    <AppLayout title={t("webAnalysis.title")}>
      <div className="space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-foreground">{t("webAnalysis.title")}</h2>
            <p className="text-sm md:text-base text-muted-foreground">
              {t("webAnalysis.subtitle")}
            </p>
          </div>
        </div>

        {/* URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Gauge className="h-5 w-5" />
              {t("webAnalysis.runNew")}
            </CardTitle>
            <CardDescription>
              {t("webAnalysis.runNewDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder={t("webAnalysis.urlPlaceholder")}
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="pl-9"
                    onKeyDown={(e) => e.key === 'Enter' && handleAnalyze()}
                  />
                </div>
                <div className="flex gap-2">
                  <Select value={strategy} onValueChange={(v) => setStrategy(v as 'mobile' | 'desktop')}>
                    <SelectTrigger className="w-full sm:w-32">
                      {strategy === 'mobile' ? (
                        <Smartphone className="mr-2 h-4 w-4" />
                      ) : (
                        <Monitor className="mr-2 h-4 w-4" />
                      )}
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mobile">{t("webAnalysis.mobile")}</SelectItem>
                      <SelectItem value="desktop">{t("webAnalysis.desktop")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAnalyze} disabled={isAnalyzing || !url} className="flex-1 sm:flex-none">
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        <span className="hidden sm:inline">{t("webAnalysis.analyzing")}</span>
                        <span className="sm:hidden">...</span>
                      </>
                    ) : (
                      <>
                        <BarChart3 className="mr-2 h-4 w-4" />
                        <span className="hidden sm:inline">{t("webAnalysis.analyze")}</span>
                        <span className="sm:hidden">{t("webAnalysis.run")}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>
              {isAnalyzing && (
                <p className="text-sm text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin mr-1" />
                  {t("webAnalysis.analyzeHint")}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        {currentResult && (
          <div className="space-y-6 scroll-mt-4" ref={resultRef}>
            {/* URL and Strategy info */}
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-xs sm:text-sm max-w-full">
                  <Globe className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">{currentResult.finalUrl || currentUrl}</span>
                </Badge>
                <Badge variant="secondary" className="text-xs sm:text-sm">
                  {strategy === 'mobile' ? <Smartphone className="h-3 w-3 mr-1" /> : <Monitor className="h-3 w-3 mr-1" />}
                  {strategy === 'mobile' ? t("webAnalysis.mobile") : t("webAnalysis.desktop")}
                </Badge>
                {selectedAnalysis && (
                  <Badge variant="outline" className="text-xs sm:text-sm">
                    <Clock className="h-3 w-3 mr-1" />
                    {t("webAnalysis.savedOn", { date: new Date(selectedAnalysis.created_at).toLocaleDateString(dateStringLocale) })}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setShowOutreachDialog(true)} variant="outline" size="sm" className="text-xs sm:text-sm">
                  <Mail className="mr-1 sm:mr-2 h-4 w-4" />
                  <span className="hidden sm:inline">{t("webAnalysis.sendMail")}</span>
                  <span className="sm:hidden">{t("webAnalysis.mail")}</span>
                </Button>
                {selectedAnalysis && (
                  <Button 
                    onClick={handleForceNewAnalysis} 
                    variant="outline" 
                    size="sm"
                    disabled={isAnalyzing}
                    className="text-xs sm:text-sm"
                  >
                    <RefreshCw className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t("webAnalysis.runNew")}</span>
                    <span className="sm:hidden">{t("webAnalysis.reanalyze")}</span>
                  </Button>
                )}
                {(savedAnalysisId || selectedAnalysis) && !linkedLead && (
                  <Button onClick={() => setShowCreateLeadDialog(true)} variant="default" size="sm" className="text-xs sm:text-sm">
                    <UserPlus className="mr-1 sm:mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t("webAnalysis.createLead")}</span>
                    <span className="sm:hidden">{t("webAnalysis.lead")}</span>
                  </Button>
                )}
                {savedAnalysisId && !selectedAnalysis && (
                  <Badge variant="secondary" className="flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {t("webAnalysis.saved")}
                  </Badge>
                )}
              </div>
            </div>

            {/* Linked Lead Info - shown when URL is linked to a lead */}
            {linkedLead && (
              <LinkedLeadInfo leadId={linkedLead.id} url={currentUrl} />
            )}

            {/* Score Cards */}
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              <ScoreCard
                label={t("webAnalysis.colPerformance")}
                score={currentResult.performance_score}
                icon={Gauge}
              />
              <ScoreCard
                label={t("webAnalysis.colAccessibility")}
                score={currentResult.accessibility_score}
                icon={Accessibility}
              />
              <ScoreCard
                label="Best Practices"
                score={currentResult.best_practices_score}
                icon={Shield}
              />
              <ScoreCard
                label={t("webAnalysis.colSeo")}
                score={currentResult.seo_score}
                icon={Search}
              />
            </div>

            {/* Report Tabs */}
             <Tabs value={activeReportTab} onValueChange={(v) => setActiveReportTab(v as "customer" | "technical" | "seo" | "geo")}>
               <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="customer" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t("webAnalysis.customerReport")}</span>
                  <span className="sm:hidden">{t("webAnalysis.customer")}</span>
                </TabsTrigger>
                <TabsTrigger value="technical" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t("webAnalysis.technical")}</span>
                  <span className="sm:hidden">{t("webAnalysis.technicalShort")}</span>
                </TabsTrigger>
                <TabsTrigger value="geo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                  <Brain className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span className="hidden sm:inline">{t("webAnalysis.geoAi")}</span>
                  <span className="sm:hidden">{t("webAnalysis.geo")}</span>
                </TabsTrigger>
                 <TabsTrigger value="seo" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                   <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                   <span className="hidden sm:inline">{t("webAnalysis.seoIntel")}</span>
                   <span className="sm:hidden">{t("webAnalysis.seo")}</span>
                 </TabsTrigger>
              </TabsList>

              <TabsContent value="customer" className="mt-6">
                <CustomerReport 
                  result={currentResult} 
                  url={currentUrl}
                  summary={summary}
                  onSummaryGenerated={setSummary}
                />
              </TabsContent>

              <TabsContent value="technical" className="mt-6">
                <TechnicalReport result={currentResult} url={url} />
              </TabsContent>

              <TabsContent value="geo" className="mt-6">
                <GeoAnalysisTab 
                  url={currentUrl}
                  leadId={linkedLead?.id}
                  isRunning={isRunningGeo}
                  onRun={async () => {
                    setIsRunningGeo(true);
                    try {
                      const body = linkedLead?.id 
                        ? { leadId: linkedLead.id }
                        : { domain: currentUrl };
                      const res = await supabase.functions.invoke("run-geo-analysis", {
                        body: { ...body, market: getActiveMarket(), language },
                      });
                      if (res.error) throw new Error(res.error.message);
                      toast({ title: t("webAnalysis.geoDoneTitle"), description: t("webAnalysis.geoScoreDesc", { score: res.data.geo_score }) });
                    } catch (e) {
                      toast({
                        title: t("webAnalysis.geoErrorTitle"),
                        description: e instanceof Error ? e.message : t("webAnalysis.unknownError"),
                        variant: "destructive",
                      });
                    } finally {
                      setIsRunningGeo(false);
                    }
                  }}
                />
              </TabsContent>

               <TabsContent value="seo" className="mt-6">
                 <SeoReport 
                   url={currentUrl} 
                   webAnalysisId={savedAnalysisId || selectedAnalysis?.id}
                   leadId={linkedLead?.id}
                   onSeoDataLoaded={setSeoData}
                 />
               </TabsContent>
            </Tabs>

            {/* Industry-specific Analysis Plugins — hidden for now (not used). */}
            {/* <div className="space-y-4">
              <div className="flex items-center gap-2 text-lg font-semibold">
                <Building2 className="h-5 w-5" />
                {t("webAnalysis.industryTitle")}
              </div>
              <p className="text-sm text-muted-foreground">
                {t("webAnalysis.industryDesc")}
              </p>
              <div className="grid gap-4 lg:grid-cols-2">
                <ServiceBusinessPlugin url={currentUrl} rawData={currentResult} />
                <RestaurantHotelPlugin url={currentUrl} rawData={currentResult} />
              </div>
            </div> */}
          </div>
        )}

        {/* Analysis History */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Clock className="h-4 w-4 sm:h-5 sm:w-5" />
              {t("webAnalysis.historyTitle")}
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">{t("webAnalysis.pastAnalyses")}</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {analyses.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 sm:py-16 text-center px-4">
                <BarChart3 className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-1">
                  {t("webAnalysis.emptyTitle")}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {t("webAnalysis.emptyDesc")}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile card view */}
                <div className="flex flex-col gap-2 p-4 md:hidden">
                  {analyses.map((analysis) => (
                    <div 
                      key={analysis.id}
                      onClick={() => viewAnalysis(analysis)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedAnalysis?.id === analysis.id ? 'bg-muted border-primary' : 'bg-card hover:bg-muted/50'}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="font-medium text-sm truncate flex-1">{analysis.url}</p>
                        <span className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(analysis.created_at).toLocaleDateString(dateStringLocale)}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className={`font-semibold ${getScoreColor(analysis.performance_score)}`}>
                          P: {analysis.performance_score}
                        </span>
                        <span className={`font-semibold ${getScoreColor(analysis.accessibility_score)}`}>
                          A: {analysis.accessibility_score}
                        </span>
                        <span className={`font-semibold ${getScoreColor(analysis.seo_score)}`}>
                          S: {analysis.seo_score}
                        </span>
                        <span className={`font-semibold ${getScoreColor(analysis.best_practices_score)}`}>
                          B: {analysis.best_practices_score}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop table view */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("webAnalysis.colUrl")}</TableHead>
                        <TableHead className="text-center">{t("webAnalysis.colPerformance")}</TableHead>
                        <TableHead className="text-center">{t("webAnalysis.colAccessibility")}</TableHead>
                        <TableHead className="text-center">{t("webAnalysis.colSeo")}</TableHead>
                        <TableHead className="text-center">{t("webAnalysis.colBestPractices")}</TableHead>
                        <TableHead>{t("webAnalysis.colDate")}</TableHead>
                        <TableHead className="w-20"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analyses.map((analysis) => (
                        <TableRow 
                          key={analysis.id} 
                          className={`cursor-pointer hover:bg-muted/50 ${selectedAnalysis?.id === analysis.id ? 'bg-muted/50' : ''}`}
                          onClick={() => viewAnalysis(analysis)}
                        >
                          <TableCell className="font-medium max-w-xs truncate">
                            {analysis.url}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold ${getScoreColor(analysis.performance_score)}`}>
                              {analysis.performance_score}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold ${getScoreColor(analysis.accessibility_score)}`}>
                              {analysis.accessibility_score}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold ${getScoreColor(analysis.seo_score)}`}>
                              {analysis.seo_score}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <span className={`font-semibold ${getScoreColor(analysis.best_practices_score)}`}>
                              {analysis.best_practices_score}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {new Date(analysis.created_at).toLocaleDateString(dateStringLocale)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => viewAnalysis(analysis)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Create Lead Dialog */}
        <CreateLeadDialog
          open={showCreateLeadDialog}
          onOpenChange={setShowCreateLeadDialog}
          url={currentUrl}
          analysisId={savedAnalysisId || selectedAnalysis?.id}
          onLeadCreated={handleLeadCreated}
        />

        {/* Quick Outreach Dialog */}
        {currentResult && (
          <QuickOutreachDialog
            open={showOutreachDialog}
            onOpenChange={setShowOutreachDialog}
            analysisResult={currentResult}
            url={currentUrl}
            seoData={seoData}
          />
        )}
      </div>
    </AppLayout>
  );
}
