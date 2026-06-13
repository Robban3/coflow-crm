import { useTranslation } from "@/i18n/LanguageProvider";
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
  const { t } = useTranslation();
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
          title: t("webAnalysis.notLoggedIn"),
          description: t("webAnalysis.notLoggedInGenerateDesc"),
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
        title: t("webAnalysis.mailGeneratedTitle"),
        description: seoData 
          ? "Inkluderar SEO Intelligence-data i mailet"
          : t("webAnalysis.qoReviewBeforeSend"),
      });
    } catch (error) {
      console.error("Error generating email:", error);
      toast({
        title: t("webAnalysis.errorGenerating"),
        description: error instanceof Error ? error.message : t("webAnalysis.qoCouldNotGenerate"),
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!recipientEmail) {
      toast({
        title: t("webAnalysis.emailMissingTitle"),
        description: t("webAnalysis.emailMissingDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("webAnalysis.notLoggedIn"));
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
        title: t("webAnalysis.mailSentTitle"),
        description: t("webAnalysis.qoSentTo", { email: recipientEmail }),
      });

      // Reset and close
      handleReset();
      onOpenChange(false);
    } catch (error) {
      console.error("Error sending email:", error);
      toast({
        title: t("webAnalysis.errorSending"),
        description: error instanceof Error ? error.message : t("webAnalysis.qoCouldNotSend"),
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
            <Mail className="h-5 w-5" />{t("webAnalysis.quickOutreach")}</DialogTitle>
          <DialogDescription>
            {t("webAnalysis.quickOutreachDesc")}
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
                placeholder={t("webAnalysis.recipientEmailPlaceholder")}
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="companyName" className="flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                {t("webAnalysis.qoCompanyName")}
              </Label>
              <Input
                id="companyName"
                placeholder={t("webAnalysis.companyNamePlaceholder2")}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName" className="flex items-center gap-2">
              <User className="h-4 w-4" />{t("webAnalysis.contactPerson")}</Label>
            <Input
              id="contactName"
              placeholder={t("webAnalysis.contactNamePlaceholder")}
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("webAnalysis.generatingMail")}</>
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
                <Label htmlFor="subject">{t("webAnalysis.subjectLabel")}</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="body">{t("webAnalysis.messageLabel")}</Label>
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
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("webAnalysis.sending")}</>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />{t("webAnalysis.sendMail")}</>
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
