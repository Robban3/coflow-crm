import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Send } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";

interface NewMailDialogProps {
  onSent?: () => void;
}

export function NewMailDialog({ onSent }: NewMailDialogProps) {
  const [open, setOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const resetForm = () => {
    setRecipientEmail("");
    setSubject("");
    setBody("");
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
    }
  };

  const handleSend = async () => {
    const to = recipientEmail.trim();
    const trimmedSubject = subject.trim();
    const bodyText = body.trim();

    if (!to || !trimmedSubject || !bodyText) {
      toast({
        title: t("mail.fillAllFields"),
        description: t("mail.fillAllFieldsDesc"),
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error(t("mail.mustBeLoggedIn"));
      }

      const { error } = await supabase.functions.invoke("send-quick-outreach-email", {
        body: {
          to,
          subject: trimmedSubject,
          bodyText,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: t("mail.mailSent"),
        description: t("mail.mailSentTo", { to }),
      });

      handleOpenChange(false);
      onSent?.();
    } catch (error) {
      toast({
        title: t("mail.couldNotSend"),
        description: error instanceof Error ? error.message : t("mail.unexpectedError"),
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          {t("mail.newMailButton")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("mail.newMailButton")}</DialogTitle>
          <DialogDescription>
            {t("mail.newMailDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-mail-to">{t("mail.recipient")}</Label>
            <Input
              id="new-mail-to"
              type="email"
              placeholder={t("mail.recipientPlaceholder")}
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mail-subject">{t("mail.subject")}</Label>
            <Input
              id="new-mail-subject"
              placeholder={t("mail.subjectPlaceholder")}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mail-body">{t("mail.message")}</Label>
            <Textarea
              id="new-mail-body"
              rows={10}
              placeholder={t("mail.messagePlaceholder")}
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {t("mail.senderNote")}
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSending}>
            {t("mail.cancel")}
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("mail.sending")}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t("mail.sendMail")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
