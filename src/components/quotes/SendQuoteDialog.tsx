import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Copy } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

interface SendQuoteDialogProps {
  quoteId: string;
  recipientEmail: string;
  recipientName: string;
  viewToken: string;
  documentLabel?: "offert" | "avtal";
  onSent: () => void;
  onClose: () => void;
}

export function SendQuoteDialog({
  quoteId,
  recipientEmail: initialEmail,
  recipientName: initialName,
  viewToken,
  documentLabel = "offert",
  onSent,
  onClose,
}: SendQuoteDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const quoteUrl = `${window.location.origin}/quote/${viewToken}`;

  const handleSend = async () => {
    if (!email) {
      toast.error(t("quotes.enterRecipientEmail"));
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-quote-email", {
        body: {
          quoteId,
          recipientEmail: email,
          recipientName: name,
          message,
          quoteUrl,
        },
      });

      if (error) throw error;

      // Update quote status
      await supabase
        .from("quotes")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          recipient_email: email,
          recipient_name: name,
        })
        .eq("id", quoteId);

      toast.success(
        documentLabel === "avtal"
          ? t("quotes.agreementSentTo", { email })
          : t("quotes.quoteSentTo", { email })
      );
      onSent();
    } catch (err: any) {
      toast.error(t("quotes.couldNotSend", { error: err.message || t("quotes.unknownError") }));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(quoteUrl);
    toast.success(t("quotes.linkCopied"));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{documentLabel === "avtal" ? t("quotes.sendAvtal") : t("quotes.sendOffert")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("quotes.recipientName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("quotes.contactPerson")} />
          </div>
          <div>
            <Label>{t("quotes.emailAddress")}</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("quotes.emailPlaceholder")} />
          </div>
          <div>
            <Label>{t("quotes.personalMessage")}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("quotes.messagePlaceholder")}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm min-w-0">
            <span className="flex-1 text-muted-foreground text-xs break-all min-w-0">{quoteUrl}</span>
            <Button variant="ghost" size="icon" onClick={copyLink} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("quotes.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? t("quotes.sending") : t("quotes.sendViaEmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
