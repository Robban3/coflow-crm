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
import { Send, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "@/i18n/LanguageProvider";

interface SendReportDialogProps {
  reportId: string;
  reportUrl: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  onClose: () => void;
}

export function SendReportDialog({
  reportId,
  reportUrl,
  recipientEmail,
  recipientName,
  onClose,
}: SendReportDialogProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState(recipientEmail || "");
  const [name, setName] = useState(recipientName || "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!email) {
      toast.error(t("reports.email.emailRequired"));
      return;
    }
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-report-email", {
        body: { reportId, recipientEmail: email, recipientName: name, message, reportUrl },
      });
      if (error) throw error;
      if (data && data.success === false) throw new Error(data.error || "Unknown error");

      toast.success(t("reports.email.sentTo", { email }));
      onClose();
    } catch (err: any) {
      toast.error(t("reports.email.sendError", { error: err.message || t("reports.email.unknownError") }));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(reportUrl);
    toast.success(t("reports.view.linkCopied"));
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("reports.email.title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>{t("reports.email.recipientName")}</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("reports.email.recipientNamePlaceholder")} />
          </div>
          <div>
            <Label>{t("reports.email.email")}</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder={t("reports.email.emailPlaceholder")} />
          </div>
          <div>
            <Label>{t("reports.email.message")}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("reports.email.messagePlaceholder")}
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted text-sm min-w-0">
            <span className="flex-1 text-muted-foreground text-xs break-all min-w-0">{reportUrl}</span>
            <Button variant="ghost" size="icon" onClick={copyLink} className="shrink-0">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t("reports.email.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            {sending ? t("reports.email.sending") : t("reports.email.sendViaEmail")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
