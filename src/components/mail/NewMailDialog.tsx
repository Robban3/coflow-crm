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
        title: "Fyll i alla fält",
        description: "Mottagare, ämne och meddelande krävs för att skicka mail.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Du måste vara inloggad för att skicka mail.");
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
        title: "Mail skickat",
        description: `Mailet skickades till ${to}`,
      });

      handleOpenChange(false);
      onSent?.();
    } catch (error) {
      toast({
        title: "Kunde inte skicka mail",
        description: error instanceof Error ? error.message : "Ett oväntat fel uppstod.",
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
          Nytt mail
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nytt mail</DialogTitle>
          <DialogDescription>
            Skriv och skicka ett nytt mail till valfri mottagare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="new-mail-to">Mottagare</Label>
            <Input
              id="new-mail-to"
              type="email"
              placeholder="kontakt@foretag.se"
              value={recipientEmail}
              onChange={(event) => setRecipientEmail(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mail-subject">Ämne</Label>
            <Input
              id="new-mail-subject"
              placeholder="Ämnesrad"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="new-mail-body">Meddelande</Label>
            <Textarea
              id="new-mail-body"
              rows={10}
              placeholder="Skriv ditt meddelande här..."
              value={body}
              onChange={(event) => setBody(event.target.value)}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            Avsändare kopplas automatiskt till inloggad användare.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isSending}>
            Avbryt
          </Button>
          <Button onClick={handleSend} disabled={isSending}>
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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
