import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { fromTable } from "@/components/documents/supabaseHelper";
import { 
  Loader2, 
  Sparkles, 
  Send, 
  ChevronDown, 
  ChevronUp,
  Wand2,
  RotateCcw,
  Globe,
  Car,
  Phone,
  Briefcase,
  Search,
  Brain,
  AlertTriangle,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useMarket } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

interface GeoAnalysisData {
  geo_score: number | null;
  summary: string | null;
  domain: string;
}
interface WebAnalysis {
  id: string;
  url: string;
  performance_score: number | null;
  accessibility_score: number | null;
  seo_score: number | null;
  best_practices_score: number | null;
}

interface FleetData {
  vehicle_count: number | null;
  phone_subscription_count: number | null;
  phone_operator: string | null;
  leasing_company: string | null;
  vehicles: any[] | null;
  phone_numbers: any[] | null;
}

interface SeoIntelligence {
  visibility_score: number | null;
  ai_summary: string | null;
  ai_opportunities: Array<{ title: string; priority: string }> | null;
  primary_keywords: Array<{ keyword: string; position: number; volume: number }> | null;
}

interface SingleEmailGeneratorProps {
  leadId: string;
  leadEmail: string | null;
  leadName: string | null;
  contactName: string | null;
  website: string | null;
  analyses: WebAnalysis[];
  fleetData?: FleetData | null;
  seoData?: SeoIntelligence | null;
  onEmailSent?: () => void;
}

type DataSource = "service_profile" | "web_analysis" | "fleet_data" | "telephony_data" | "seo_intelligence" | "geo_analysis";

export function SingleEmailGenerator({
  leadId,
  leadEmail,
  leadName,
  contactName,
  website,
  analyses,
  fleetData,
  seoData,
  onEmailSent,
}: SingleEmailGeneratorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [serviceProfile, setServiceProfile] = useState<{ industry: string; description: string } | null>(null);
  const [selectedSources, setSelectedSources] = useState<DataSource[]>(["service_profile"]);
  const { toast } = useToast();
  const { market } = useMarket();
  const { t } = useTranslation();

  // Fetch latest GEO analysis
  const { data: geoData } = useQuery({
    queryKey: ["geo-latest", leadId],
    queryFn: async () => {
      const { data } = await fromTable("geo_analyses")
        .select("geo_score, summary, domain")
        .eq("lead_id", leadId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as GeoAnalysisData | null;
    },
    enabled: !!leadId,
  });

  // Get latest analysis if available
  const latestAnalysis = analyses.length > 0 ? analyses[0] : null;
  
  // Determine if this is a "no website" scenario
  const hasNoWebsite = !website || website.trim().length === 0;
  
  // Check available data sources
  const hasWebAnalysis = latestAnalysis !== null;
  const hasFleetData = fleetData && (fleetData.vehicle_count && fleetData.vehicle_count > 0);
  const hasTelephonyData = fleetData && (fleetData.phone_subscription_count && fleetData.phone_subscription_count > 0);
  const hasSeoIntelligence = seoData && seoData.visibility_score !== null;
  const hasGeoData = geoData && geoData.geo_score !== null;

  // Fetch service profile on mount
  useEffect(() => {
    async function fetchServiceProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('service_industry, service_description')
        .eq('id', user.id)
        .single();

      if (data?.service_description) {
        setServiceProfile({
          industry: data.service_industry || "",
          description: data.service_description,
        });
      }
    }
    fetchServiceProfile();
  }, []);

  const toggleSource = (source: DataSource) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: t("leadDetail.se_notLoggedInTitle"),
          description: t("leadDetail.se_notLoggedInGenerateDesc"),
          variant: "destructive",
        });
        return;
      }

      // Build request body based on selected sources
      const requestBody: Record<string, any> = {
        companyName: leadName,
        contactName: contactName,
        market,
        customPrompt: customPrompt || undefined,
        scrapeWebsite: selectedSources.includes("web_analysis"),
        // New service profile fields
        useServiceProfile: selectedSources.includes("service_profile"),
      };

      // Include web analysis data if selected
      if (selectedSources.includes("web_analysis") && !hasNoWebsite) {
        requestBody.url = website;
        requestBody.performanceScore = latestAnalysis?.performance_score ?? 0;
        requestBody.seoScore = latestAnalysis?.seo_score ?? 0;
        requestBody.accessibilityScore = latestAnalysis?.accessibility_score ?? 0;
        requestBody.bestPracticesScore = latestAnalysis?.best_practices_score ?? 0;
      } else {
        requestBody.url = "no-website";
      }

      // Include fleet data if selected
      if (selectedSources.includes("fleet_data") && hasFleetData) {
        requestBody.fleetData = {
          vehicleCount: fleetData?.vehicle_count,
          leasingCompany: fleetData?.leasing_company,
          vehicles: fleetData?.vehicles?.slice(0, 5), // Limit to 5 vehicles for context
        };
      }

      // Include telephony data if selected
      if (selectedSources.includes("telephony_data") && hasTelephonyData) {
        requestBody.telephonyData = {
          subscriptionCount: fleetData?.phone_subscription_count,
          operator: fleetData?.phone_operator,
          phoneNumbers: fleetData?.phone_numbers?.slice(0, 3), // Limit to 3 numbers
        };
      }

      // Include GEO analysis data if selected
      if (selectedSources.includes("geo_analysis") && hasGeoData && geoData) {
        requestBody.geoAnalysis = {
          geoScore: geoData.geo_score,
          summary: geoData.summary,
          domain: geoData.domain,
        };
      }

      // Include SEO Intelligence data if selected
      if (selectedSources.includes("seo_intelligence") && hasSeoIntelligence && seoData) {
        // Build opportunities string
        let opportunities: string | undefined;
        if (seoData.ai_opportunities && seoData.ai_opportunities.length > 0) {
          opportunities = seoData.ai_opportunities
            .slice(0, 3)
            .map(opp => `${opp.title} (${opp.priority})`)
            .join(", ");
        }

        requestBody.seoIntelligence = {
          visibilityScore: seoData.visibility_score,
          summary: seoData.ai_summary,
          opportunities,
          keywords: seoData.primary_keywords?.slice(0, 10), // Top 10 keywords
        };
      }

      // Use the new smart outreach function
      const response = await supabase.functions.invoke("generate-smart-outreach", {
        body: requestBody,
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSubject(response.data.subject);
      setBody(response.data.body);
      setIsGenerated(true);

      toast({
        title: t("leadDetail.se_emailGeneratedTitle"),
        description: t("leadDetail.se_emailGeneratedDesc"),
      });

      setSubject(response.data.subject);
      setBody(response.data.body);
      setIsGenerated(true);

      toast({
        title: t("leadDetail.se_emailGeneratedTitle"),
        description: t("leadDetail.se_emailGeneratedDesc"),
      });
    } catch (error) {
      console.error("Error generating email:", error);
      toast({
        title: t("leadDetail.se_generateErrorTitle"),
        description: error instanceof Error ? error.message : t("leadDetail.se_generateErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!leadEmail) {
      toast({
        title: t("leadDetail.se_emailMissingTitle"),
        description: t("leadDetail.se_emailMissingDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("leadDetail.se_notLoggedInTitle"));
      }

      const response = await supabase.functions.invoke("send-quick-outreach-email", {
        body: {
          to: leadEmail,
          subject,
          bodyText: body,
          leadId,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: t("leadDetail.se_emailSentTitle"),
        description: t("leadDetail.se_emailSentDesc", { email: leadEmail }),
      });

      // Log email activity
      await supabase.from("activities").insert({
        lead_id: leadId,
        user_id: user.id,
        type: "email",
        title: t("leadDetail.se_activitySingleEmailSent", { subject }),
        description: body.substring(0, 200) + (body.length > 200 ? "..." : ""),
        completed_at: new Date().toISOString(),
      });

      // Reset and close
      handleReset();
      onEmailSent?.();
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: t("leadDetail.se_sendErrorTitle"),
        description: error instanceof Error ? error.message : t("leadDetail.se_sendErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setSubject("");
    setBody("");
    setIsGenerated(false);
  };

  const promptExamples = hasNoWebsite
    ? [
        t("leadDetail.se_promptNoWebsite1"),
        t("leadDetail.se_promptNoWebsite2"),
        t("leadDetail.se_promptNoWebsite3"),
        t("leadDetail.se_promptNoWebsite4"),
      ]
    : [
        t("leadDetail.se_promptWebsite1"),
        t("leadDetail.se_promptWebsite2"),
        t("leadDetail.se_promptWebsite3"),
        t("leadDetail.se_promptWebsite4"),
      ];

  return (
    <Card className="mb-4 w-full max-w-full overflow-hidden">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors pb-3 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Wand2 className="h-5 w-5 text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-sm sm:text-base truncate">{t("leadDetail.se_cardTitle")}</CardTitle>
                  <CardDescription className="text-[11px] sm:text-sm truncate">
                    {t("leadDetail.se_cardDescription")}
                  </CardDescription>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 shrink-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
            {/* Mobile CTA when collapsed */}
            {!isOpen && (
              <div className="mt-2 md:hidden">
                <div className="text-xs text-primary font-medium">{t("leadDetail.se_mobileCta")}</div>
              </div>
            )}
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4 overflow-hidden px-3 sm:px-6">
            {/* AI Directive Input */}
            {!isGenerated && (
              <>
                {/* Data Source Selector - NEW! */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    {t("leadDetail.se_dataSourcesLabel")}
                  </Label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {/* Service Profile */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("service_profile") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!serviceProfile ? "opacity-50" : ""}`}
                      onClick={() => serviceProfile && toggleSource("service_profile")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("service_profile")}
                        disabled={!serviceProfile}
                        onCheckedChange={() => serviceProfile && toggleSource("service_profile")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Briefcase className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t("leadDetail.se_serviceProfileTitle")}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {serviceProfile ? t("leadDetail.se_serviceProfileConfigured") : t("leadDetail.se_serviceProfileNotConfigured")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Web Analysis */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("web_analysis") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!hasWebAnalysis && hasNoWebsite ? "opacity-50" : ""}`}
                      onClick={() => (!hasNoWebsite || hasWebAnalysis) && toggleSource("web_analysis")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("web_analysis")}
                        disabled={!hasWebAnalysis && hasNoWebsite}
                        onCheckedChange={() => (!hasNoWebsite || hasWebAnalysis) && toggleSource("web_analysis")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t("leadDetail.se_webAnalysisTitle")}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasWebAnalysis
                              ? `SEO: ${latestAnalysis?.seo_score ?? "-"}/100`
                              : hasNoWebsite ? t("leadDetail.se_noWebsite") : t("leadDetail.se_notAnalyzed")}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Fleet Data */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("fleet_data") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!hasFleetData ? "opacity-50" : ""}`}
                      onClick={() => hasFleetData && toggleSource("fleet_data")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("fleet_data")}
                        disabled={!hasFleetData}
                        onCheckedChange={() => hasFleetData && toggleSource("fleet_data")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Car className="h-4 w-4 text-green-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Fordonsdata</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasFleetData 
                              ? `${fleetData?.vehicle_count} fordon` 
                              : "Ingen data"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Telephony Data */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("telephony_data") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!hasTelephonyData ? "opacity-50" : ""}`}
                      onClick={() => hasTelephonyData && toggleSource("telephony_data")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("telephony_data")}
                        disabled={!hasTelephonyData}
                        onCheckedChange={() => hasTelephonyData && toggleSource("telephony_data")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Phone className="h-4 w-4 text-purple-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">Telefonidata</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasTelephonyData 
                              ? `${fleetData?.phone_operator || t("leadDetail.se2_unknownOperator")}` 
                              : "Ingen data"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* GEO / AI Visibility */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("geo_analysis") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!hasGeoData ? "opacity-50" : ""}`}
                      onClick={() => hasGeoData && toggleSource("geo_analysis")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("geo_analysis")}
                        disabled={!hasGeoData}
                        onCheckedChange={() => hasGeoData && toggleSource("geo_analysis")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Brain className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{t("leadDetail.ac_geoTitle")}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasGeoData 
                              ? `GEO: ${geoData?.geo_score}/100` 
                              : "Ej analyserad"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* SEO Intelligence */}
                    <div 
                      className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedSources.includes("seo_intelligence") 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      } ${!hasSeoIntelligence ? "opacity-50" : ""}`}
                      onClick={() => hasSeoIntelligence && toggleSource("seo_intelligence")}
                    >
                      <Checkbox 
                        checked={selectedSources.includes("seo_intelligence")}
                        disabled={!hasSeoIntelligence}
                        onCheckedChange={() => hasSeoIntelligence && toggleSource("seo_intelligence")}
                      />
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Search className="h-4 w-4 text-amber-500 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate flex items-center gap-1">
                            SEO Intelligence
                            <AlertTriangle className="h-3 w-3 text-amber-500" />
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {hasSeoIntelligence 
                              ? `Synlighet: ${seoData?.visibility_score}/100 (cachad)` 
                              : "Ej analyserad (betald)"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{t("leadDetail.se2_selectDataDesc")}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customPrompt" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Direktiv till AI (valfritt)
                  </Label>
                  <Textarea
                    id="customPrompt"
                    placeholder={t("leadDetail.se2_focusPlaceholder")}
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                </div>

                {/* Quick prompt suggestions - dynamic based on selected sources */}
                <div className="flex flex-wrap gap-1.5">
                  {promptExamples.slice(0, 2).map((example, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-1.5 px-2 max-w-full whitespace-normal text-left justify-start"
                      onClick={() => setCustomPrompt(example)}
                    >
                      {example.length > 40 ? example.substring(0, 40) + "..." : example}
                    </Button>
                  ))}
                </div>

                {/* Warning if no sources selected */}
                {selectedSources.length === 0 && (
                  <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-xs">
                    <p className="font-medium text-amber-700 dark:text-amber-400">
                      ⚠️ Ingen datakälla vald
                    </p>
                    <p className="text-muted-foreground">{t("leadDetail.se2_selectSource")}</p>
                  </div>
                )}

            <Button
                  onClick={handleGenerate}
                  disabled={isGenerating || !leadEmail}
                  className="w-full"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Genererar mail...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Generera mail med AI
                    </>
                  )}
                </Button>

                {!leadEmail && (
                  <p className="text-xs text-destructive text-center">{t("leadDetail.se2_noEmail")}</p>
                )}
              </>
            )}

            {/* Generated email preview/edit */}
            {isGenerated && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="subject">{t("leadDetail.pwx_subjectPlaceholder")}</Label>
                  <Input
                    id="subject"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="body">Meddelande</Label>
                  <Textarea
                    id="body"
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={10}
                    className="font-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 sm:flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleReset}
                    className="sm:flex-1"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    <span className="hidden sm:inline">{t("leadDetail.se2_restart")}</span>
                    <span className="sm:hidden">Ny</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="sm:flex-1"
                  >
                    {isGenerating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="mr-2 h-4 w-4" />
                    )}
                    <span className="hidden sm:inline">Generera om</span>
                    <span className="sm:hidden">Omgen</span>
                  </Button>
                  <Button
                    onClick={handleSend}
                    disabled={isSending || !leadEmail}
                    className="col-span-2 sm:col-span-1 sm:flex-1"
                  >
                    {isSending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Skickar...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Skicka mail
                      </>
                    )}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
