import { useState } from "react";
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
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, Send, Mail, Building2, User } from "lucide-react";
import { PageSpeedResult } from "@/lib/api/webAnalysis";
import { SeoAnalysis } from "@/components/web-analysis/SeoReport";
import { useMarket } from "@/hooks/useMarket";

interface QuickOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  analysisResult: PageSpeedResult;
  url: string;
  seoData?: SeoAnalysis | null;
}

export function QuickOutreachDialog({
  open,
  onOpenChange,
  analysisResult,
  url,
  seoData,
}: QuickOutreachDialogProps) {
  const [recipientEmail, setRecipientEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const { toast } = useToast();
  const { market } = useMarket();

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Ej inloggad",
          description: "Du måste vara inloggad för att generera mail",
          variant: "destructive",
        });
        return;
      }

      // Build SEO opportunities string if available
      let seoOpportunities: string | undefined;
      if (seoData?.ai_opportunities && seoData.ai_opportunities.length > 0) {
        seoOpportunities = seoData.ai_opportunities
          .slice(0, 3)
          .map(opp => `${opp.title} (${opp.priority})`)
          .join(", ");
      }

      const response = await supabase.functions.invoke("generate-analysis-outreach", {
        body: {
          url,
          market,
          performanceScore: analysisResult.performance_score,
          seoScore: analysisResult.seo_score,
          accessibilityScore: analysisResult.accessibility_score,
          bestPracticesScore: analysisResult.best_practices_score,
          pwaScore: analysisResult.pwa_score,
          // Only include optional fields if they have values
          ...(recipientEmail && { recipientEmail }),
          ...(companyName && { companyName }),
          ...(contactName && { contactName }),
          // Include SEO Intelligence data if available
          ...(seoData && {
            seoVisibilityScore: seoData.visibility_score,
            seoSummary: seoData.ai_summary,
            seoOpportunities,
          }),
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      setSubject(response.data.subject);
      setBody(response.data.body);
      setIsGenerated(true);

      toast({
        title: "Mail genererat!",
        description: seoData 
          ? "Inkluderar SEO Intelligence-data i mailet"
          : "Granska och redigera mailet innan du skickar",
      });
    } catch (error) {
      console.error("Error generating email:", error);
      toast({
        title: "Fel vid generering",
        description: error instanceof Error ? error.message : "Kunde inte generera mail",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail) {
      toast({
        title: "E-post saknas",
        description: "Ange mottagarens e-postadress",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Ej inloggad");
      }

      const response = await supabase.functions.invoke("send-quick-outreach-email", {
        body: {
          to: recipientEmail,
          subject,
          bodyText: body,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      toast({
        title: "Mail skickat!",
        description: `Mailet har skickats till ${recipientEmail}`,
      });

      // Reset and close
      handleReset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: "Fel vid skickning",
        description: error instanceof Error ? error.message : "Kunde inte skicka mail",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleReset = () => {
    setRecipientEmail("");
    setCompanyName("");
    setContactName("");
    setSubject("");
    setBody("");
    setIsGenerated(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      handleReset();
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Snabb outreach
          </DialogTitle>
          <DialogDescription>
            Generera och skicka ett personligt mail baserat på analysresultatet
            {seoData && " (inkluderar SEO Intelligence-data)"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Recipient info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="recipientEmail" className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                E-post *
              </Label>
              <Input
                id="recipientEmail"
                type="email"
                placeholder="kontakt@foretag.se"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                Företagsnamn
              </Label>
              <Input
                id="companyName"
                placeholder="Företag AB"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Kontaktperson
            </Label>
            <Input
              id="contactName"
              placeholder="Anna Andersson"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
            />
          </div>

          {!isGenerated ? (
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
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
                  {seoData && " (+ SEO)"}
                </>
              )}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="subject">Ämnesrad</Label>
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
                  rows={12}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Generera om
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={isSending || !recipientEmail}
                  className="flex-1"
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
