import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertTriangle } from "lucide-react";

interface ReportBookingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportId?: string;
  leadId?: string | null;
  companyName?: string;
  domain?: string | null;
}

export function ReportBookingDialog({
  open,
  onOpenChange,
  reportId,
  leadId,
  companyName,
  domain,
}: ReportBookingDialogProps) {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    company: companyName || "",
    message: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [isBooked, setIsBooked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [leadLoaded, setLeadLoaded] = useState(false);

  // Auto-fill from lead data
  useEffect(() => {
    if (!open || leadLoaded) return;

    const fillFromLead = async () => {
      if (!leadId) return;
      const { data } = await supabase
        .from("leads")
        .select("company_name, contact_name, email, phone")
        .eq("id", leadId)
        .maybeSingle();

      if (data) {
        setForm((prev) => ({
          ...prev,
          name: data.contact_name || prev.name,
          email: data.email || prev.email,
          phone: data.phone || prev.phone,
          company: data.company_name || prev.company,
        }));
      }
      setLeadLoaded(true);
    };
    fillFromLead();
  }, [open, leadId, leadLoaded]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setIsBooked(false);
      setError(null);
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.name || !form.email) return;
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        "book-report-meeting",
        {
          body: {
            reportId,
            leadId,
            guestName: form.name,
            guestEmail: form.email,
            guestPhone: form.phone,
            companyName: form.company,
            message: form.message,
            domain,
          },
        }
      );

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setIsBooked(true);
    } catch (err: any) {
      console.error("Booking error:", err);
      setError(err.message || "Kunde inte skicka bokning. Försök igen.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isBooked) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Tack för din bokning!</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vi har tagit emot din förfrågan och återkommer inom kort till{" "}
              <span className="font-medium text-foreground">{form.email}</span>.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Boka genomgång</DialogTitle>
          <DialogDescription>
            Fyll i dina uppgifter så kontaktar vi dig för att boka en tid.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border bg-accent/50 border-border p-3 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-foreground/60 shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Se över din information nedan och ändra om något behöver uppdateras.
          </p>
        </div>

        <div className="space-y-4 mt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-name">Namn *</Label>
              <Input
                id="booking-name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ditt namn"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-company">Företag</Label>
              <Input
                id="booking-company"
                value={form.company}
                onChange={(e) => setForm((p) => ({ ...p, company: e.target.value }))}
                placeholder="Företagsnamn"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="booking-email">E-post *</Label>
              <Input
                id="booking-email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                placeholder="din@email.se"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="booking-phone">Telefon</Label>
              <Input
                id="booking-phone"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                placeholder="07x-xxx xx xx"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="booking-message">Meddelande (valfritt)</Label>
            <Textarea
              id="booking-message"
              value={form.message}
              onChange={(e) => setForm((p) => ({ ...p, message: e.target.value }))}
              placeholder="Beskriv kort vad ni vill diskutera..."
              rows={3}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={isLoading || !form.name || !form.email}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Skicka bokningsförfrågan
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
