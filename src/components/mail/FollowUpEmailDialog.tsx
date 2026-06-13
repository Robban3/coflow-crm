import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Send, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMarket } from "@/hooks/useMarket";
import { useTranslation } from "@/i18n/LanguageProvider";

interface FollowUpEmailDialogProps {
  leadIds: string[];
  onClose: () => void;
  onSent: () => void;
}

interface GeneratedEmail {
  leadId: string;
  leadName: string;
  subject: string;
  body: string;
  body_without_signature: string;
  email: string;
}

export function FollowUpEmailDialog({
  leadIds,
  onClose,
  onSent,
}: FollowUpEmailDialogProps) {
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [emails, setEmails] = useState<GeneratedEmail[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { toast } = useToast();
  const { user } = useAuth();
  const { market } = useMarket();
  const { t } = useTranslation();

  const generateEmails = async () => {
    setGenerating(true);
    try {
      const generated: GeneratedEmail[] = [];

      for (const leadId of leadIds) {
        const { data, error } = await supabase.functions.invoke(
          "generate-outreach-email",
          {
            body: {
              leadId,
              userId: user?.id,
              context: "follow_up",
              market,
            },
          }
        );

        if (error) {
          console.error(`Error generating for ${leadId}:`, error);
          continue;
        }

        // Get lead email
        const { data: lead } = await supabase
          .from("leads")
          .select("email, company_name, contact_name")
          .eq("id", leadId)
          .single();

        if (lead?.email) {
          generated.push({
            leadId,
            leadName:
              lead.contact_name || lead.company_name || t("mail.unknownCompany"),
            subject: data.subject,
            body: data.body,
            body_without_signature: data.body_without_signature,
            email: lead.email,
          });
        }
      }

      if (generated.length === 0) {
        toast({
          title: t("mail.followUp.couldNotGenerate"),
          description: t("mail.followUp.noValidEmails"),
          variant: "destructive",
        });
        onClose();
        return;
      }

      setEmails(generated);
    } catch (e: any) {
      toast({
        title: t("mail.followUp.generateError"),
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    generateEmails();
  }, []);

  const currentEmail = emails[currentIndex];

  const updateCurrentEmail = (
    field: keyof GeneratedEmail,
    value: string
  ) => {
    setEmails((prev) =>
      prev.map((e, i) => (i === currentIndex ? { ...e, [field]: value } : e))
    );
  };

  const sendAll = async () => {
    setSending(true);
    try {
      let sentCount = 0;
      const failed: Array<{ email: string; error: string }> = [];

      for (const email of emails) {
        const { error } = await supabase.functions.invoke(
          "send-quick-outreach-email",
          {
            body: {
              to: email.email,
              subject: email.subject,
              bodyText: email.body,
              leadId: email.leadId,
            },
          }
        );

        if (error) {
          const errorMessage = error.message || t("mail.followUp.unknownError");
          failed.push({ email: email.email, error: errorMessage });
          console.error(`Failed to send to ${email.email}:`, error);
        } else {
          sentCount++;
        }
      }

      if (sentCount === 0) {
        toast({
          title: t("mail.followUp.noneSent"),
          description: failed[0]
            ? `${failed[0].email}: ${failed[0].error}`
            : t("mail.followUp.sendFailed"),
          variant: "destructive",
        });
        return;
      }

      if (failed.length > 0) {
        toast({
          title: t("mail.followUp.partialSent", {
            sent: sentCount,
            failed: failed.length,
          }),
          description: `${failed[0].email}: ${failed[0].error}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: t("mail.followUp.allSent", { count: sentCount }),
        });
      }

      onSent();
    } catch (e: any) {
      toast({ title: t("mail.followUp.error"), description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t("mail.followUp.dialogTitle")}
          </DialogTitle>
          <DialogDescription>
            {generating
              ? t("mail.followUp.generatingFor", { count: leadIds.length })
              : t("mail.followUp.generatedReview", { count: emails.length })}
          </DialogDescription>
        </DialogHeader>

        {generating ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {t("mail.followUp.generating")}
            </p>
          </div>
        ) : currentEmail ? (
          <div className="space-y-4">
            {/* Navigation for multiple emails */}
            {emails.length > 1 && (
              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIndex === 0}
                  onClick={() => setCurrentIndex((i) => i - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  {t("mail.followUp.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                  {currentIndex + 1} / {emails.length} —{" "}
                  {currentEmail.leadName}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={currentIndex === emails.length - 1}
                  onClick={() => setCurrentIndex((i) => i + 1)}
                >
                  {t("mail.followUp.next")}
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <Label>{t("mail.followUp.to")}</Label>
                <Input value={currentEmail.email} disabled className="mt-1" />
              </div>
              <div>
                <Label>{t("mail.followUp.subject")}</Label>
                <Input
                  value={currentEmail.subject}
                  onChange={(e) =>
                    updateCurrentEmail("subject", e.target.value)
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t("mail.followUp.message")}</Label>
                <Textarea
                  value={currentEmail.body}
                  onChange={(e) => updateCurrentEmail("body", e.target.value)}
                  rows={10}
                  className="mt-1 font-mono text-sm"
                />
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("mail.followUp.cancel")}
          </Button>
          <Button
            onClick={sendAll}
            disabled={generating || sending || emails.length === 0}
          >
            {sending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            {emails.length > 1
              ? t("mail.followUp.sendAll", { count: emails.length })
              : t("mail.followUp.send")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
