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
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const quoteUrl = `${window.location.origin}/quote/${viewToken}`;

  const handleSend = async () => {
    if (!email) {
      toast.error("Ange mottagarens e-postadress");
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

      toast.success(`${documentLabel === "avtal" ? "Avtalet" : "Offerten"} skickades till ${email}`);
      onSent();
    } catch (err: any) {
      toast.error("Kunde inte skicka: " + (err.message || "Okänt fel"));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(quoteUrl);
    toast.success("Länk kopierad!");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skicka {documentLabel}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Mottagare (namn)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Kontaktperson" />
          </div>
          <div>
            <Label>E-postadress</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="kontakt@foretag.se" />
          </div>
          <div>
            <Label>Personligt meddelande (valfritt)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hej! Här kommer offerten vi pratade om..."
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
            Avbryt
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            <Send className="h-4 w-4 mr-2" />
            {sending ? "Skickar..." : "Skicka via e-post"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
