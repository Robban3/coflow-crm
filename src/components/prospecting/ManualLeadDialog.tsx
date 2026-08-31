import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "@/i18n/LanguageProvider";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";

// Normalize a company name for org-wide dedup (mirror of the prospecting tab's
// normalizeCompanyName: lowercase, strip common Swedish legal suffixes/punct).
function normName(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/\s+(ab|hb|kb|ek\.?\s*för\.?|handelsbolag|aktiebolag|kommanditbolag)\s*$/i, "")
    .replace(/[,.\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface ManualLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCompanyName?: string;
  defaultPhone?: string;
  onCreated?: () => void;
}

/**
 * Manual "add my own lead" reserve for when a company isn't found in the
 * register. Saves the lead directly as the current salesperson's own
 * (created_by = assigned_to = me) WITHOUT triggering auto-enrichment — the rep
 * can start an analysis later. Org-wide dedup by normalized company name via
 * get_org_lead_claims() so two reps can't claim the same company.
 */
export function ManualLeadDialog({
  open,
  onOpenChange,
  defaultCompanyName,
  defaultPhone,
  onCreated,
}: ManualLeadDialogProps) {
  const { t } = useTranslation();
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
  const [contactName, setContactName] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill from the register search terms each time the dialog opens.
  useEffect(() => {
    if (open) {
      setCompanyName(defaultCompanyName || "");
      setPhone(defaultPhone || "");
      setWebsite("");
      setEmail("");
      setContactName("");
    }
  }, [open, defaultCompanyName, defaultPhone]);

  const save = async () => {
    if (!companyName.trim()) {
      toast.error(t("manualLead.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error(t("manualLead.notLoggedIn"));
        return;
      }

      // Org-wide dedup by normalized company name.
      const { data: claims } = await (supabase as any).rpc("get_org_lead_claims");
      const target = normName(companyName);
      const dup = (claims ?? []).find(
        (c: any) => c.company_name && normName(c.company_name) === target,
      );
      if (dup) {
        toast.error(t("manualLead.duplicate", { owner: dup.owner_name || "" }));
        setSaving(false);
        return;
      }

      // created_by must be self (RLS); assigned_to = self makes it explicitly
      // this rep's claimed lead. organization_id is filled by a DB trigger.
      // No enrichment_status: 'pending' → the enrichment queue skips it.
      const { error } = await supabase.from("leads").insert({
        company_name: companyName.trim(),
        contact_name: contactName.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        source: "manual",
        created_by: user.id,
        assigned_to: user.id,
      });
      if (error) throw error;

      toast.success(t("manualLead.created", { name: companyName.trim() }));
      onOpenChange(false);
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message || t("manualLead.saveError"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("manualLead.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">{t("manualLead.companyName")} *</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} autoFocus />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("manualLead.phone")}</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("manualLead.website")}</Label>
              <Input value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">{t("manualLead.contact")}</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">{t("manualLead.email")}</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("manualLead.hint")}</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            {t("manualLead.cancel")}
          </Button>
          <Button onClick={save} disabled={saving || !companyName.trim()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <UserPlus className="h-4 w-4 mr-1" />}
            {t("manualLead.save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
