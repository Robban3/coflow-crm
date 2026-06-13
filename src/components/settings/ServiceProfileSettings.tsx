import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save, Briefcase, Lightbulb } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";

interface ServiceProfileSettings {
  service_industry: string;
  service_description: string;
}

export function ServiceProfileSettings() {
  const { t } = useTranslation();

  const industryTemplates = [
    {
      value: "web_agency",
      label: t("settings.industryWebLabel"),
      description: t("settings.industryWebDesc"),
      template: t("settings.industryWebTemplate"),
    },
    {
      value: "telephony",
      label: t("settings.industryTelephonyLabel"),
      description: t("settings.industryTelephonyDesc"),
      template: t("settings.industryTelephonyTemplate"),
    },
    {
      value: "fleet_leasing",
      label: t("settings.industryFleetLabel"),
      description: t("settings.industryFleetDesc"),
      template: t("settings.industryFleetTemplate"),
    },
    {
      value: "it_services",
      label: t("settings.industryItLabel"),
      description: t("settings.industryItDesc"),
      template: t("settings.industryItTemplate"),
    },
    {
      value: "custom",
      label: t("settings.industryCustomLabel"),
      description: t("settings.industryCustomDesc"),
      template: "",
    },
  ];

  const [settings, setSettings] = useState<ServiceProfileSettings>({
    service_industry: "",
    service_description: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchSettings();
    }
  }, [user?.id]);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('service_industry, service_description')
        .eq('id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          service_industry: data.service_industry || "",
          service_description: data.service_description || "",
        });
      }
    } catch (error) {
      console.error('Error fetching service profile:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleIndustryChange = (value: string) => {
    const template = industryTemplates.find(t => t.value === value);
    setSettings(prev => ({
      ...prev,
      service_industry: value,
      // Only auto-fill template if current description is empty or matches another template
      service_description: prev.service_description.trim() === "" || 
        industryTemplates.some(t => t.template === prev.service_description.trim())
          ? (template?.template || "")
          : prev.service_description,
    }));
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          service_industry: settings.service_industry || null,
          service_description: settings.service_description || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: t("settings.serviceProfileSavedTitle"),
        description: t("settings.serviceProfileSavedDesc"),
      });
    } catch (error) {
      console.error('Error saving service profile:', error);
      toast({
        title: t("settings.error"),
        description: t("settings.serviceProfileSaveErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedIndustry = industryTemplates.find(t => t.value === settings.service_industry);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Briefcase className="h-5 w-5" />
          {t("settings.serviceProfileTitle")}
        </CardTitle>
        <CardDescription>
          {t("settings.serviceProfileDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Industry Selection */}
        <div className="space-y-3">
          <Label>{t("settings.chooseIndustryTemplate")}</Label>
          <RadioGroup
            value={settings.service_industry}
            onValueChange={handleIndustryChange}
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {industryTemplates.map((industry) => (
              <div key={industry.value} className="relative">
                <RadioGroupItem
                  value={industry.value}
                  id={`industry-${industry.value}`}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={`industry-${industry.value}`}
                  className="flex flex-col gap-1 rounded-lg border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                >
                  <span className="font-semibold text-sm">{industry.label}</span>
                  <span className="text-xs text-muted-foreground">{industry.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {/* Service Description */}
        <div className="space-y-2">
          <Label htmlFor="service_description" className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-muted-foreground" />
            {t("settings.serviceDescription")}
          </Label>
          <Textarea
            id="service_description"
            placeholder={t("settings.serviceDescriptionPlaceholder")}
            value={settings.service_description}
            onChange={(e) => setSettings(prev => ({ ...prev, service_description: e.target.value }))}
            rows={8}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            {t("settings.serviceDescriptionHelp")}
          </p>
        </div>

        {/* Preview of what AI will use */}
        {settings.service_description && (
          <div className="space-y-2">
            <Label>{t("settings.aiPreviewLabel")}</Label>
            <div className="p-4 rounded-lg border bg-muted/30 text-sm">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                {t("settings.aiPreviewIntro")}
              </p>
              <p className="font-medium mb-1">
                {t("settings.industryLabel", { industry: selectedIndustry?.label || t("settings.industryNotSelected") })}
              </p>
              <div className="whitespace-pre-wrap text-muted-foreground">
                {settings.service_description.length > 300 
                  ? settings.service_description.substring(0, 300) + "..."
                  : settings.service_description}
              </div>
            </div>
          </div>
        )}

        {/* Help text about how this works with modules */}
        <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 text-sm">
          <p className="font-medium mb-2">{t("settings.serviceProfileHelpTitle")}</p>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• <strong>{t("settings.serviceProfileHelpTelephony")}</strong> {t("settings.serviceProfileHelpTelephonyDesc")}</li>
            <li>• <strong>{t("settings.serviceProfileHelpFleet")}</strong> {t("settings.serviceProfileHelpFleetDesc")}</li>
            <li>• <strong>{t("settings.serviceProfileHelpWeb")}</strong> {t("settings.serviceProfileHelpWebDesc")}</li>
            <li>• <strong>{t("settings.serviceProfileHelpCustom")}</strong> {t("settings.serviceProfileHelpCustomDesc")}</li>
          </ul>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("settings.saving")}
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              {t("settings.saveServiceProfile")}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
