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

interface SendOfferDialogProps {
  documentId: string;
  recipientEmail: string;
  recipientName: string;
  viewToken: string;
  onSent: () => void;
  onClose: () => void;
}

export function SendOfferDialog({
  documentId,
  recipientEmail: initialEmail,
  recipientName: initialName,
  viewToken,
  onSent,
  onClose,
}: SendOfferDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const offerUrl = `${window.location.origin}/offer/${viewToken}`;

  const handleSend = async () => {
    if (!email) {
      toast.error(t("templates.sendOffer.emailRequired"));
      return;
    }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-document-email", {
        body: {
          documentId,
          recipientEmail: email,
          recipientName: name,
          message,
          offerUrl,
        },
      });

      if (error) throw error;

      toast.success(t("templates.sendOffer.sentTo", { email }));
      onSent();
    } catch (err: any) {
      toast.error(t("templates.sendOffer.sendError", { error: err.message || t("templates.sendOffer.unknownError") }));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(offerUrl);
    toast.success(t("templates.sendOffer.linkCopied"));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("templates.sendOffer.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("templates.sendOffer.recipientName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("templates.sendOffer.recipientNamePlaceholder")} />
          </div>
          <div>
            <Label>{t("templates.sendOffer.email")}</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("offers.send.emailPlaceholder")} />
          </div>
          <div>
            <Label>{t("templates.sendOffer.message")}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("templates.sendOffer.messagePlaceholder")}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm min-w-0">
            <span className="flex-1 text-muted-foreground text-xs break-all min-w-0">{offerUrl}</span>
            <Button variant="ghost" size="icon" onClick={copyLink} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("templates.sendOffer.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? t("templates.sendOffer.sending") : t("templates.sendOffer.sendViaEmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
