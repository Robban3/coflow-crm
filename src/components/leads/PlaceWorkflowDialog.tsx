import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  BarChart3,
  Globe,
  Loader2,
  Mail,
  Plus,
  Send,
  Sparkles,
  Building2,
  User,
  Phone,
  CheckCircle2,
  AlertCircle,
  Star,
  MapPin,
  ArrowRight,
  ExternalLink,
  Zap,
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { PageSpeedResult } from "@/lib/api/webAnalysis";
import { firecrawlApi } from "@/lib/api/firecrawl";
import { useMarket } from "@/hooks/useMarket";

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
}

interface PlaceWorkflowDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  place: PlaceResult | null;
  existingAnalysisId?: string;
  onLeadCreated: () => void;
  onAnalysisComplete?: (analysisId: string) => void;
}

type WorkflowStep = "overview" | "analysis" | "email" | "lead";

export function PlaceWorkflowDialog({
  open,
  onOpenChange,
  place,
  existingAnalysisId,
  onLeadCreated,
  onAnalysisComplete,
}: PlaceWorkflowDialogProps) {
  const [activeTab, setActiveTab] = useState<WorkflowStep>("overview");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<PageSpeedResult | null>(null);
  const [analysisId, setAnalysisId] = useState<string | undefined>(existingAnalysisId);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [leadCreated, setLeadCreated] = useState(false);
  
  // Email state
  const [recipientEmail, setRecipientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [isGeneratingEmail, setIsGeneratingEmail] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [emailGenerated, setEmailGenerated] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  // Firecrawl extraction state
  const [isExtractingContact, setIsExtractingContact] = useState(false);
  const [contactExtracted, setContactExtracted] = useState(false);
  const [extractedContactData, setExtractedContactData] = useState<{
    email?: string;
    phone?: string;
    contactName?: string;
  } | null>(null);

  // Lead creation state
  const [isExtractingData, setIsExtractingData] = useState(false);
  const [isSavingLead, setIsSavingLead] = useState(false);
  const [leadFormData, setLeadFormData] = useState({
    companyName: "",
    contactName: "",
    email: "",
    phone: "",
  });

  const { toast } = useToast();
  const { market } = useMarket();

  // Reset state when dialog opens/closes or place changes
  useEffect(() => {
    if (open && place) {
      setActiveTab("overview");
      setAnalysisResult(null);
      setAnalysisId(existingAnalysisId);
      setLeadId(null);
      setLeadCreated(false);
      setRecipientEmail("");
      setCompanyName(place.name);
      setContactName("");
      setEmailSubject("");
      setEmailBody("");
      setEmailGenerated(false);
      setEmailSent(false);
      setContactExtracted(false);
      setExtractedContactData(null);
      setLeadFormData({
        companyName: place.name,
        contactName: "",
        email: "",
        phone: place.phone || "",
      });

      // Check if lead already exists
      checkExistingLead();
      
      // Load existing analysis if provided
      if (existingAnalysisId) {
        loadExistingAnalysis(existingAnalysisId);
      }
    }
  }, [open, place, existingAnalysisId]);

  const checkExistingLead = async () => {
    if (!place?.website) return;
    
    const normalizedWebsite = place.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
    
    const { data } = await supabase
      .from("leads")
      .select("id, company_name, contact_name, email, phone")
      .ilike("website", `%${normalizedWebsite}%`)
      .limit(1)
      .maybeSingle();
    
    if (data) {
      setLeadId(data.id);
      setLeadCreated(true);
      setLeadFormData({
        companyName: data.company_name || place?.name || "",
        contactName: data.contact_name || "",
        email: data.email || "",
        phone: data.phone || place?.phone || "",
      });
      if (data.email) setRecipientEmail(data.email);
      if (data.contact_name) setContactName(data.contact_name);
    }
  };

  const loadExistingAnalysis = async (id: string) => {
    const { data } = await supabase
      .from("web_analyses")
      .select("raw_data")
      .eq("id", id)
      .single();
    
    if (data?.raw_data) {
      setAnalysisResult(data.raw_data as unknown as PageSpeedResult);
    }
  };

  const handleAnalyze = async () => {
    if (!place?.website) return;
    
    setIsAnalyzing(true);
    setActiveTab("analysis");
    
    try {
      const { data, error } = await supabase.functions.invoke("pagespeed-analyze", {
        body: { url: place.website, strategy: "mobile" },
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      setAnalysisResult(data.data);

      // Save analysis
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      const { data: savedAnalysis, error: saveError } = await supabase
        .from("web_analyses")
        .insert({
          url: place.website,
          lead_id: leadId,
          analyzed_by: user.id,
          performance_score: data.data.performance_score,
          accessibility_score: data.data.accessibility_score,
          best_practices_score: data.data.best_practices_score,
          seo_score: data.data.seo_score,
          raw_data: data.data,
        })
        .select()
        .single();

      if (saveError) throw saveError;

      setAnalysisId(savedAnalysis.id);
      onAnalysisComplete?.(savedAnalysis.id);

      toast({
        title: "Analys klar!",
        description: `${place.name} har analyserats`,
      });
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        title: "Analys misslyckades",
        description: error instanceof Error ? error.message : "Kunde inte analysera",
        variant: "destructive",
      });
      setActiveTab("overview");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateEmail = async () => {
    if (!analysisResult || !place?.website) return;

    setIsGeneratingEmail(true);
    try {
      const response = await supabase.functions.invoke("generate-analysis-outreach", {
        body: {
          url: place.website,
          market,
          performanceScore: analysisResult.performance_score,
          seoScore: analysisResult.seo_score,
          accessibilityScore: analysisResult.accessibility_score,
          bestPracticesScore: analysisResult.best_practices_score,
          pwaScore: analysisResult.pwa_score,
          recipientEmail,
          companyName: companyName || place.name,
          contactName,
        },
      });

      if (response.error) throw new Error(response.error.message);

      setEmailSubject(response.data.subject);
      setEmailBody(response.data.body);
      setEmailGenerated(true);

      toast({
        title: "Mail genererat!",
        description: "Granska och redigera innan du skickar",
      });
    } catch (error) {
      toast({
        title: "Fel vid generering",
        description: error instanceof Error ? error.message : "Kunde inte generera",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingEmail(false);
    }
  };

  const handleSendEmail = async () => {
    if (!recipientEmail) {
      toast({ title: "Ange e-postadress", variant: "destructive" });
      return;
    }

    setIsSendingEmail(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      // Auto-create lead if it doesn't exist yet
      let currentLeadId = leadId;
      
      console.log("[PlaceWorkflow] handleSendEmail - leadCreated:", leadCreated, "leadId:", leadId, "place:", place?.placeId);
      
      if (!leadCreated && place) {
        console.log("[PlaceWorkflow] Creating new lead for:", place.name);
        
        const { data: newLead, error: leadError } = await supabase
          .from("leads")
          .insert({
            company_name: companyName || place.name,
            contact_name: contactName || null,
            email: recipientEmail,
            phone: place.phone || null,
            website: place.website || null,
            source: "google_places",
            source_data: {
              place_id: place.placeId,
              address: place.address,
              rating: place.rating,
              user_ratings_total: place.userRatingsTotal,
              types: place.types,
            },
            created_by: user.id,
          })
          .select()
          .single();

        if (leadError) {
          console.error("[PlaceWorkflow] Lead creation failed:", leadError);
          throw leadError;
        }

        console.log("[PlaceWorkflow] Lead created successfully:", newLead.id);

        currentLeadId = newLead.id;
        setLeadId(newLead.id);
        setLeadCreated(true);
        onLeadCreated();

        // Link analysis to lead if exists
        if (analysisId) {
          await supabase
            .from("web_analyses")
            .update({ lead_id: newLead.id })
            .eq("id", analysisId);
        }

        toast({
          title: "Lead skapad automatiskt",
          description: `${companyName || place.name} har lagts till som lead`,
        });
      } else if (leadCreated && !currentLeadId) {
        // Edge case: leadCreated is true but we don't have the ID - try to find it
        console.log("[PlaceWorkflow] leadCreated is true but no ID, searching...");
        
        if (place?.website) {
          const normalizedWebsite = place.website.replace(/^https?:\/\//, "").replace(/\/$/, "");
          const { data: existingLead } = await supabase
            .from("leads")
            .select("id")
            .ilike("website", `%${normalizedWebsite}%`)
            .limit(1)
            .maybeSingle();
          
          if (existingLead) {
            currentLeadId = existingLead.id;
            setLeadId(existingLead.id);
            console.log("[PlaceWorkflow] Found existing lead:", existingLead.id);
          }
        }
      }

      console.log("[PlaceWorkflow] Sending email with leadId:", currentLeadId);

      const response = await supabase.functions.invoke("send-quick-outreach-email", {
        body: {
          to: recipientEmail,
          subject: emailSubject,
          bodyText: emailBody,
          leadId: currentLeadId,
        },
      });

      if (response.error) throw new Error(response.error.message);

      setEmailSent(true);
      toast({
        title: "Mail skickat!",
        description: `Mailet har skickats till ${recipientEmail}`,
      });
    } catch (error) {
      console.error("[PlaceWorkflow] Email send error:", error);
      toast({
        title: "Fel vid skickning",
        description: error instanceof Error ? error.message : "Kunde inte skicka",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Extract contact info via Firecrawl (for Overview tab)
  const handleExtractContact = async () => {
    if (!place?.website) return;
    
    setIsExtractingContact(true);
    try {
      const response = await firecrawlApi.extractCompanyData(place.website);
      
      if (response.success && response.data) {
        const extracted = {
          email: response.data.email,
          phone: response.data.phone || place.phone,
          contactName: response.data.contactName,
        };
        
        setExtractedContactData(extracted);
        setContactExtracted(true);
        
        // Update email fields for mail tab
        if (response.data.email) setRecipientEmail(response.data.email);
        if (response.data.contactName) setContactName(response.data.contactName);
        
        // Update lead form data
        setLeadFormData(prev => ({
          ...prev,
          contactName: response.data.contactName || prev.contactName,
          email: response.data.email || prev.email,
          phone: response.data.phone || prev.phone,
        }));

        const hasContact = response.data.email || response.data.phone || response.data.contactName;
        
        toast({
          title: hasContact ? "Kontaktinfo hittad!" : "Begränsad data",
          description: hasContact 
            ? "E-post och kontaktuppgifter har hämtats" 
            : "Inga direkta kontaktuppgifter på webbplatsen",
        });
      } else {
        toast({
          title: "Kunde inte hämta",
          description: "Prova att fylla i manuellt",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Extract contact error:", error);
      toast({ title: "Fel", description: "Kunde inte hämta kontaktinfo", variant: "destructive" });
    } finally {
      setIsExtractingContact(false);
    }
  };

  const handleExtractLeadData = async () => {
    if (!place?.website) return;
    
    setIsExtractingData(true);
    try {
      const response = await firecrawlApi.extractCompanyData(place.website);
      
      if (response.success && response.data) {
        setLeadFormData({
          companyName: response.data.companyName || place.name,
          contactName: response.data.contactName || "",
          email: response.data.email || "",
          phone: response.data.phone || place.phone || "",
        });
        if (response.data.email) setRecipientEmail(response.data.email);
        if (response.data.contactName) setContactName(response.data.contactName);
        
        toast({ title: "Data extraherad!", description: "Granska informationen" });
      } else {
        toast({
          title: "Kunde inte extrahera",
          description: "Fyll i manuellt",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({ title: "Fel", description: "Kunde inte hämta data", variant: "destructive" });
    } finally {
      setIsExtractingData(false);
    }
  };

  const handleSaveLead = async () => {
    if (!leadFormData.companyName) {
      toast({ title: "Företagsnamn krävs", variant: "destructive" });
      return;
    }

    setIsSavingLead(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Ej inloggad");

      const { data: lead, error } = await supabase
        .from("leads")
        .insert({
          company_name: leadFormData.companyName,
          contact_name: leadFormData.contactName || null,
          email: leadFormData.email || null,
          phone: leadFormData.phone || null,
          website: place?.website || null,
          source: "google_places",
          source_data: {
            place_id: place?.placeId,
            address: place?.address,
            rating: place?.rating,
            user_ratings_total: place?.userRatingsTotal,
            types: place?.types,
          },
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Link analysis to lead if exists
      if (analysisId && lead) {
        await supabase
          .from("web_analyses")
          .update({ lead_id: lead.id })
          .eq("id", analysisId);
      }

      setLeadId(lead.id);
      setLeadCreated(true);
      onLeadCreated();

      toast({
        title: "Lead skapad!",
        description: `${leadFormData.companyName} har lagts till`,
      });
    } catch (error) {
      toast({
        title: "Fel",
        description: "Kunde inte skapa lead",
        variant: "destructive",
      });
    } finally {
      setIsSavingLead(false);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  const getScoreBg = (score: number) => {
    if (score >= 90) return "bg-emerald-500/10 border-emerald-500/20";
    if (score >= 50) return "bg-amber-500/10 border-amber-500/20";
    return "bg-red-500/10 border-red-500/20";
  };

  if (!place) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl !max-h-[min(85vh,calc(100vh-2rem))] p-0 gap-0 flex flex-col">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/30 shrink-0">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-xl font-semibold truncate">
                {place.name}
              </DialogTitle>
              <DialogDescription className="flex items-center gap-2 mt-1">
                <MapPin className="h-3.5 w-3.5" />
                <span className="truncate">{place.address}</span>
              </DialogDescription>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {place.rating && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    {place.rating.toFixed(1)}
                  </Badge>
                )}
                {place.website && (
                  <Badge variant="outline" className="gap-1">
                    <Globe className="h-3 w-3" />
                    Webbplats
                  </Badge>
                )}
                {leadCreated && (
                  <Badge className="gap-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" />
                    Lead
                  </Badge>
                )}
                {analysisResult && (
                  <Badge className="gap-1 bg-primary/10 text-primary border-primary/20">
                    <BarChart3 className="h-3 w-3" />
                    Analyserad
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as WorkflowStep)} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0 shrink-0">
            <TabsTrigger
              value="overview"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Översikt
            </TabsTrigger>
            <TabsTrigger
              value="analysis"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              disabled={!place.website}
            >
              Analys
            </TabsTrigger>
            <TabsTrigger
              value="email"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
              disabled={!analysisResult}
            >
              Mail
            </TabsTrigger>
            <TabsTrigger
              value="lead"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 py-3"
            >
              Lead
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 overflow-auto">
            {/* Overview Tab */}
            <TabsContent value="overview" className="p-6 mt-0 space-y-6">
              {/* Quick Info */}
              <div className="grid grid-cols-2 gap-4">
                {place.phone && (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{place.phone}</span>
                  </div>
                )}
                {place.website && (
                  <a
                    href={place.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm truncate flex-1">
                      {place.website.replace(/^https?:\/\//, "")}
                    </span>
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </a>
                )}
              </div>

              {/* Extracted Contact Info */}
              {contactExtracted && extractedContactData && (
                <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Kontaktinfo från webbplatsen
                  </div>
                  <div className="grid gap-2">
                    {extractedContactData.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{extractedContactData.email}</span>
                      </div>
                    )}
                    {extractedContactData.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{extractedContactData.phone}</span>
                      </div>
                    )}
                    {extractedContactData.contactName && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{extractedContactData.contactName}</span>
                      </div>
                    )}
                    {!extractedContactData.email && !extractedContactData.contactName && !extractedContactData.phone && (
                      <p className="text-sm text-muted-foreground">
                        Inga kontaktuppgifter hittades på webbplatsen
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-muted-foreground">Snabbåtgärder</h4>
                <div className="grid gap-3">
                  {/* Firecrawl Extract Contact */}
                  {place.website && !contactExtracted && (
                    <Button
                      variant="outline"
                      onClick={handleExtractContact}
                      disabled={isExtractingContact}
                      className="w-full justify-between h-auto py-4"
                    >
                      <span className="flex items-center gap-3">
                        <Zap className="h-5 w-5" />
                        <span className="text-left">
                          <span className="block font-medium">Hämta kontaktinfo</span>
                          <span className="block text-xs opacity-70">
                            Sök e-post och telefon på webbplatsen
                          </span>
                        </span>
                      </span>
                      {isExtractingContact ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Analyze Website */}
                  {place.website && !analysisResult && (
                    <Button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="w-full justify-between h-auto py-4"
                    >
                      <span className="flex items-center gap-3">
                        <BarChart3 className="h-5 w-5" />
                        <span className="text-left">
                          <span className="block font-medium">Analysera webbplats</span>
                          <span className="block text-xs opacity-70">
                            Kör PageSpeed-analys
                          </span>
                        </span>
                      </span>
                      {isAnalyzing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowRight className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                  
                  {analysisResult && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("email")}
                      className="w-full justify-between h-auto py-4"
                    >
                      <span className="flex items-center gap-3">
                        <Mail className="h-5 w-5" />
                        <span className="text-left">
                          <span className="block font-medium">Skicka outreach-mail</span>
                          <span className="block text-xs opacity-70">
                            Generera AI-mail baserat på analys
                          </span>
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}

                  {!leadCreated && (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("lead")}
                      className="w-full justify-between h-auto py-4"
                    >
                      <span className="flex items-center gap-3">
                        <Plus className="h-5 w-5" />
                        <span className="text-left">
                          <span className="block font-medium">Skapa lead</span>
                          <span className="block text-xs opacity-70">
                            Spara som lead i systemet
                          </span>
                        </span>
                      </span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* Status Summary */}
              {(analysisResult || leadCreated || emailSent || contactExtracted) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                  <div className="space-y-2">
                    {contactExtracted && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Kontaktinfo hämtad
                      </div>
                    )}
                    {leadCreated && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Lead skapad
                      </div>
                    )}
                    {analysisResult && (
                      <div className="flex items-center gap-2 text-sm text-primary">
                        <CheckCircle2 className="h-4 w-4" />
                        Webbplats analyserad
                      </div>
                    )}
                    {emailSent && (
                      <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="h-4 w-4" />
                        Mail skickat
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* Analysis Tab */}
            <TabsContent value="analysis" className="p-6 mt-0 space-y-6">
              {isAnalyzing ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-muted-foreground">Analyserar {place.name}...</p>
                  <Progress value={45} className="w-48" />
                </div>
              ) : analysisResult ? (
                <>
                  {/* Score Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Prestanda", score: analysisResult.performance_score },
                      { label: "Tillgänglighet", score: analysisResult.accessibility_score },
                      { label: "SEO", score: analysisResult.seo_score },
                      { label: "Best Practice", score: analysisResult.best_practices_score },
                    ].map(({ label, score }) => (
                      <div
                        key={label}
                        className={`p-4 rounded-xl border ${getScoreBg(score)} text-center`}
                      >
                        <div className={`text-2xl font-bold ${getScoreColor(score)}`}>
                          {score}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Quick Insights */}
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium">Snabbinsikter</h4>
                    <div className="space-y-2">
                      {analysisResult.performance_score < 50 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
                          <span className="text-sm">
                            Webbplatsen har stora prestandaproblem som påverkar användarupplevelsen
                          </span>
                        </div>
                      )}
                      {analysisResult.seo_score < 70 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-sm">
                            SEO-optimering saknas - webbplatsen syns sämre i Google
                          </span>
                        </div>
                      )}
                      {analysisResult.accessibility_score < 70 && (
                        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                          <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <span className="text-sm">
                            Tillgänglighetsproblem kan utesluta användare
                          </span>
                        </div>
                      )}
                      {analysisResult.performance_score >= 90 &&
                        analysisResult.seo_score >= 90 && (
                          <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                            <span className="text-sm">
                              Webbplatsen har bra grundläggande teknisk kvalitet
                            </span>
                          </div>
                        )}
                    </div>
                  </div>

                  {/* Next Step CTA */}
                  <Separator />
                  <Button onClick={() => setActiveTab("email")} className="w-full">
                    <Mail className="mr-2 h-4 w-4" />
                    Skapa outreach-mail baserat på analys
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
                  <div>
                    <p className="font-medium">Ingen analys ännu</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Klicka nedan för att analysera webbplatsen
                    </p>
                  </div>
                  <Button onClick={handleAnalyze} disabled={isAnalyzing}>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Starta analys
                  </Button>
                </div>
              )}
            </TabsContent>

            {/* Email Tab */}
            <TabsContent value="email" className="p-6 mt-0 space-y-4">
              {!analysisResult ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Analysera webbplatsen först för att generera mail
                  </p>
                  <Button onClick={() => setActiveTab("analysis")}>
                    Gå till analys
                  </Button>
                </div>
              ) : emailSent ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="font-medium">Mail skickat!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Mailet har skickats till {recipientEmail}
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => {
                    setEmailSent(false);
                    setEmailGenerated(false);
                    setEmailSubject("");
                    setEmailBody("");
                  }}>
                    Skicka nytt mail
                  </Button>
                </div>
              ) : (
                <>
                  {/* Recipient Info */}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5" />
                        E-post *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="kontakt@foretag.se"
                        value={recipientEmail}
                        onChange={(e) => setRecipientEmail(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="company" className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        Företag
                      </Label>
                      <Input
                        id="company"
                        placeholder="Företag AB"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contact" className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5" />
                      Kontaktperson
                    </Label>
                    <Input
                      id="contact"
                      placeholder="Anna Andersson"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                    />
                  </div>

                  {!emailGenerated ? (
                    <Button
                      onClick={handleGenerateEmail}
                      disabled={isGeneratingEmail}
                      className="w-full"
                    >
                      {isGeneratingEmail ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Genererar...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generera mail med AI
                        </>
                      )}
                    </Button>
                  ) : (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <Label htmlFor="subject">Ämnesrad</Label>
                        <Input
                          id="subject"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="body">Meddelande</Label>
                        <Textarea
                          id="body"
                          value={emailBody}
                          onChange={(e) => setEmailBody(e.target.value)}
                          rows={10}
                          className="font-mono text-sm"
                        />
                      </div>

                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={handleGenerateEmail}
                          disabled={isGeneratingEmail}
                          className="flex-1"
                        >
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generera om
                        </Button>
                        <Button
                          onClick={handleSendEmail}
                          disabled={isSendingEmail || !recipientEmail}
                          className="flex-1"
                        >
                          {isSendingEmail ? (
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
                </>
              )}
            </TabsContent>

            {/* Lead Tab */}
            <TabsContent value="lead" className="p-6 mt-0 space-y-4">
              {leadCreated ? (
                <div className="flex flex-col items-center justify-center py-12 space-y-4 text-center">
                  <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                  <div>
                    <p className="font-medium">Lead finns redan!</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {leadFormData.companyName} är sparad som lead
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Extract Data */}
                  {place.website && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                      <Globe className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate flex-1">
                        {place.website.replace(/^https?:\/\//, "")}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleExtractLeadData}
                        disabled={isExtractingData}
                      >
                        {isExtractingData ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Zap className="mr-1 h-3 w-3" />
                            Hämta data
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Form Fields */}
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor="leadCompany" className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5" />
                        Företagsnamn *
                      </Label>
                      <Input
                        id="leadCompany"
                        value={leadFormData.companyName}
                        onChange={(e) =>
                          setLeadFormData((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                        placeholder="Företagets namn"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="leadContact" className="flex items-center gap-2">
                        <User className="h-3.5 w-3.5" />
                        Kontaktperson
                      </Label>
                      <Input
                        id="leadContact"
                        value={leadFormData.contactName}
                        onChange={(e) =>
                          setLeadFormData((prev) => ({ ...prev, contactName: e.target.value }))
                        }
                        placeholder="Namn på kontaktperson"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="leadEmail" className="flex items-center gap-2">
                          <Mail className="h-3.5 w-3.5" />
                          E-post
                        </Label>
                        <Input
                          id="leadEmail"
                          type="email"
                          value={leadFormData.email}
                          onChange={(e) =>
                            setLeadFormData((prev) => ({ ...prev, email: e.target.value }))
                          }
                          placeholder="email@företag.se"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="leadPhone" className="flex items-center gap-2">
                          <Phone className="h-3.5 w-3.5" />
                          Telefon
                        </Label>
                        <Input
                          id="leadPhone"
                          value={leadFormData.phone}
                          onChange={(e) =>
                            setLeadFormData((prev) => ({ ...prev, phone: e.target.value }))
                          }
                          placeholder="08-xxx xx xx"
                        />
                      </div>
                    </div>
                  </div>

                  <Button
                    onClick={handleSaveLead}
                    disabled={isSavingLead || !leadFormData.companyName}
                    className="w-full"
                  >
                    {isSavingLead ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sparar...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Skapa lead
                      </>
                    )}
                  </Button>
                </>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
