import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Trophy } from "lucide-react";

interface Prefill {
  company_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
}

interface WonDealDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadId?: string | null;
  quoteId?: string | null;
  prefill?: Prefill;
}

const REQUIRED = [
  "company_name",
  "contact_name",
  "email",
  "phone",
  "product_service",
  "onboarding_date",
  "onboarding_time",
] as const;

const EMPTY = {
  company_name: "",
  contact_name: "",
  email: "",
  phone: "",
  product_service: "",
  onboarding_date: "",
  onboarding_time: "",
  seller_notes: "",
  customer_goal: "",
  promises: "",
};

export function WonDealDialog({ open, onOpenChange, leadId, quoteId, prefill }: WonDealDialogProps) {
  const { user } = useAuth();
  const organizationId = useOrganizationId();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  useEffect(() => {
    if (open) {
      setForm({
        ...EMPTY,
        company_name: prefill?.company_name || "",
        contact_name: prefill?.contact_name || "",
        email: prefill?.email || "",
        phone: prefill?.phone || "",
      });
    }
  }, [open, prefill]);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const canSave = REQUIRED.every((k) => form[k].trim().length > 0);

  const handleSubmit = async () => {
    if (!canSave || !user) return;
    setSaving(true);
    const { data: inserted, error } = await (supabase as any)
      .from("deal_handoffs")
      .insert({
        organization_id: organizationId,
        lead_id: leadId ?? null,
        quote_id: quoteId ?? null,
        created_by: user.id,
        company_name: form.company_name.trim(),
        contact_name: form.contact_name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        product_service: form.product_service.trim(),
        onboarding_date: form.onboarding_date,
        onboarding_time: form.onboarding_time,
        seller_notes: form.seller_notes.trim() || null,
        customer_goal: form.customer_goal.trim() || null,
        promises: form.promises.trim() || null,
      } as any)
      .select("id")
      .single();
    setSaving(false);
    if (error) {
      toast({ title: "Kunde inte spara", description: error.message, variant: "destructive" });
      return;
    }
    // Email the handoff to the onboarding recipient (best-effort).
    supabase.functions
      .invoke("notify-deal-handoff", { body: { handoffId: (inserted as any)?.id } })
      .catch(() => {});
    toast({ title: "Affär registrerad 🎉", description: "Onboarding-uppgifterna är sparade." });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" /> Grattis till affären!
          </DialogTitle>
          <DialogDescription>Fyll i uppgifterna för kundens onboarding.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Obligatoriska fält
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Företagsnamn *">
              <Input value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
            </Field>
            <Field label="Kontaktperson *">
              <Input value={form.contact_name} onChange={(e) => set("contact_name", e.target.value)} />
            </Field>
            <Field label="E-postadress *">
              <Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </Field>
            <Field label="Telefonnummer *">
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            </Field>
          </div>
          <Field label="Produkt/tjänst som sålts *">
            <Input value={form.product_service} onChange={(e) => set("product_service", e.target.value)} />
          </Field>
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Datum för onboarding *">
              <Input type="date" value={form.onboarding_date} onChange={(e) => set("onboarding_date", e.target.value)} />
            </Field>
            <Field label="Tid för onboarding *">
              <Input type="time" value={form.onboarding_time} onChange={(e) => set("onboarding_time", e.target.value)} />
            </Field>
          </div>

          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground pt-2">
            Bra att ha
          </p>
          <Field label="Säljarens anteckningar">
            <Textarea rows={2} value={form.seller_notes} onChange={(e) => set("seller_notes", e.target.value)} />
          </Field>
          <Field label="Kundens huvudsakliga mål med köpet">
            <Textarea rows={2} value={form.customer_goal} onChange={(e) => set("customer_goal", e.target.value)} />
          </Field>
          <Field label="Löften / specialöverenskommelser under försäljningen">
            <Textarea rows={2} value={form.promises} onChange={(e) => set("promises", e.target.value)} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Avbryt
          </Button>
          <Button onClick={handleSubmit} disabled={!canSave || saving}>
            {saving ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sparar…</>
            ) : (
              "Spara affär"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">{label}</Label>
      {children}
    </div>
  );
}
