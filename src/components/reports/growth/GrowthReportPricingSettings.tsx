import { useTranslation } from "@/i18n/LanguageProvider";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/hooks/useOrganization";

interface PricingRow {
  id?: string;
  ai_visibility_start_monthly: number;
  ai_visibility_growth_monthly: number;
  ai_visibility_dominate_monthly: number;
  website_rebuild_from_price: number;
  show_website_upsell: boolean;
  booking_url: string;
  contact_email: string;
  contact_phone: string;
}

const DEFAULTS: PricingRow = {
  ai_visibility_start_monthly: 4900,
  ai_visibility_growth_monthly: 8900,
  ai_visibility_dominate_monthly: 14900,
  website_rebuild_from_price: 18000,
  show_website_upsell: true,
  booking_url: "",
  contact_email: "hej@kodco.se",
  contact_phone: "",
};

export function GrowthReportPricingSettings() {
  const { t } = useTranslation();
  const { organization } = useOrganization();
  const { toast } = useToast();
  const [form, setForm] = useState<PricingRow>(DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!organization?.id) return;
    (async () => {
      const { data } = await supabase
        .from("organization_pricing")
        .select("*")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (data) {
        const d = data as any;
        setForm({
          id: data.id,
          ai_visibility_start_monthly: Number(d.ai_visibility_start_monthly) || DEFAULTS.ai_visibility_start_monthly,
          ai_visibility_growth_monthly: Number(d.ai_visibility_growth_monthly) || DEFAULTS.ai_visibility_growth_monthly,
          ai_visibility_dominate_monthly: Number(d.ai_visibility_dominate_monthly) || DEFAULTS.ai_visibility_dominate_monthly,
          website_rebuild_from_price: Number(d.website_rebuild_from_price) || DEFAULTS.website_rebuild_from_price,
          show_website_upsell: d.show_website_upsell !== false,
          booking_url: data.booking_url || "",
          contact_email: data.contact_email || "",
          contact_phone: data.contact_phone || "",
        });
      }
      setIsLoading(false);
    })();
  }, [organization?.id]);

  const handleSave = async () => {
    if (!organization?.id) return;
    setIsSaving(true);
    try {
      const payload: any = {
        organization_id: organization.id,
        ai_visibility_start_monthly: form.ai_visibility_start_monthly,
        ai_visibility_growth_monthly: form.ai_visibility_growth_monthly,
        ai_visibility_dominate_monthly: form.ai_visibility_dominate_monthly,
        website_rebuild_from_price: form.website_rebuild_from_price,
        show_website_upsell: form.show_website_upsell,
        booking_url: form.booking_url || null,
        contact_email: form.contact_email || null,
        contact_phone: form.contact_phone || null,
      };

      if (form.id) {
        const { error } = await supabase
          .from("organization_pricing")
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("organization_pricing")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        setForm((prev) => ({ ...prev, id: data.id }));
      }

      toast({ title: t("reports.pricing.saved"), description: t("reports.pricing.savedDesc") });
    } catch (err) {
      toast({ title: t("reports.generator.error"), description: t("reports.pricing.saveError"), variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const n = (field: keyof PricingRow, value: string) => {
    setForm((prev) => ({ ...prev, [field]: Number(value) || 0 }));
  };
  const s = (field: keyof PricingRow, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{t("reports.pricing.title")}</CardTitle>
        <CardDescription>{t("reports.pricing.desc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* AI-synlighet */}
        <div>
          <h4 className="text-sm font-semibold mb-3">{t("reports.pricing.aiVisibilityHeading")}</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.pricing.start")}</Label>
              <Input type="number" value={form.ai_visibility_start_monthly} onChange={(e) => n("ai_visibility_start_monthly", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.pricing.growth")}</Label>
              <Input type="number" value={form.ai_visibility_growth_monthly} onChange={(e) => n("ai_visibility_growth_monthly", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.pricing.dominate")}</Label>
              <Input type="number" value={form.ai_visibility_dominate_monthly} onChange={(e) => n("ai_visibility_dominate_monthly", e.target.value)} />
            </div>
          </div>
        </div>

        {/* Website rebuild */}
        <div>
          <h4 className="text-sm font-semibold mb-3">{t("reports.pricing.websiteHeading")}</h4>
          <div className="flex items-center gap-4 mb-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.show_website_upsell}
                onCheckedChange={(v) => setForm((p) => ({ ...p, show_website_upsell: v }))}
              />
              <Label className="text-xs">{t("reports.pricing.showUpsell")}</Label>
            </div>
          </div>
          <div className="max-w-xs space-y-1">
            <Label className="text-xs">{t("reports.pricing.fromPrice")}</Label>
            <Input type="number" value={form.website_rebuild_from_price} onChange={(e) => n("website_rebuild_from_price", e.target.value)} />
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 className="text-sm font-semibold mb-3">{t("reports.pricing.contactHeading")}</h4>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.pricing.bookingLink")}</Label>
              <Input value={form.booking_url} onChange={(e) => s("booking_url", e.target.value)} placeholder="https://..." />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.pricing.email")}</Label>
              <Input value={form.contact_email} onChange={(e) => s("contact_email", e.target.value)} placeholder="hej@kodco.se" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t("reports.booking.phone")}</Label>
              <Input value={form.contact_phone} onChange={(e) => s("contact_phone", e.target.value)} placeholder="+46..." />
            </div>
          </div>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          {t("reports.pricing.save")}
        </Button>
      </CardContent>
    </Card>
  );
}
