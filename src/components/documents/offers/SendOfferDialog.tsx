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
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState(initialName);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const offerUrl = `${window.location.origin}/offer/${viewToken}`;

  const handleSend = async () => {
    if (!email) {
      toast.error("Ange mottagarens e-postadress");
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

      toast.success(`Offerten skickades till ${email}`);
      onSent();
    } catch (err: any) {
      toast.error("Kunde inte skicka: " + (err.message || "Okänt fel"));
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(offerUrl);
    toast.success("Länk kopierad!");
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Skicka offert</DialogTitle>
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
            <span className="flex-1 text-muted-foreground text-xs break-all min-w-0">{offerUrl}</span>
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
