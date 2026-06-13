import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Loader2, Save, Mail, Globe, Building2, MessageSquare } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ProfileImageUpload } from "./ProfileImageUpload";
import { ServiceProfileSettings } from "./ServiceProfileSettings";

interface SignatureSettings {
  email_signature: string;
  company_name: string;
  company_website: string;
  company_logo_url: string;
  email_footer: string;
  outreach_tone: string;
  sender_display_name: string;
}

export function EmailSignatureSettings() {
  const { t } = useTranslation();

  const toneOptions = [
    {
      value: "standard",
      label: t("settings.toneStandardLabel"),
      description: t("settings.toneStandardDesc"),
      example: t("settings.toneStandardExample"),
    },
    {
      value: "familiar",
      label: t("settings.toneFamiliarLabel"),
      description: t("settings.toneFamiliarDesc"),
      example: t("settings.toneFamiliarExample"),
    },
    {
      value: "informative",
      label: t("settings.toneInformativeLabel"),
      description: t("settings.toneInformativeDesc"),
      example: t("settings.toneInformativeExample"),
    },
    {
      value: "direct",
      label: t("settings.toneDirectLabel"),
      description: t("settings.toneDirectDesc"),
      example: t("settings.toneDirectExample"),
    },
  ];

  const [settings, setSettings] = useState<SignatureSettings>({
    email_signature: "",
    company_name: "",
    company_website: "",
    company_logo_url: "",
    email_footer: "",
    outreach_tone: "standard",
    sender_display_name: "",
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
        .select('email_signature, company_name, company_website, company_logo_url, email_footer, outreach_tone, sender_display_name')
        .eq('id', user!.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings({
          email_signature: data.email_signature || "",
          company_name: data.company_name || "",
          company_website: data.company_website || "",
          company_logo_url: data.company_logo_url || "",
          email_footer: data.email_footer || "",
          outreach_tone: data.outreach_tone || "standard",
          sender_display_name: data.sender_display_name || "",
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          email_signature: settings.email_signature || null,
          company_name: settings.company_name || null,
          company_website: settings.company_website || null,
          company_logo_url: settings.company_logo_url || null,
          email_footer: settings.email_footer || null,
          outreach_tone: settings.outreach_tone || "standard",
          sender_display_name: settings.sender_display_name || null,
        })
        .eq('id', user.id);

      if (error) throw error;

      toast({
        title: t("settings.signatureSavedTitle"),
        description: t("settings.signatureSavedDesc"),
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: t("settings.error"),
        description: t("settings.signatureSaveErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const selectedTone = toneOptions.find(t => t.value === settings.outreach_tone) || toneOptions[0];

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
    <div className="space-y-6">
      {/* Service Profile Card - New! Configure what you sell */}
      <ServiceProfileSettings />

      {/* Sender Settings Card - Most commonly used, show first */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("settings.senderCardTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.senderCardDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender Display Name */}
          <div className="space-y-2">
            <Label htmlFor="sender_display_name">{t("settings.senderName")}</Label>
            <Input
              id="sender_display_name"
              placeholder={settings.company_name || user?.user_metadata?.full_name || t("settings.senderNamePlaceholder")}
              value={settings.sender_display_name}
              onChange={(e) => setSettings(prev => ({ ...prev, sender_display_name: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.senderNameHelp")}
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-1">{t("settings.preview")}</p>
              <p className="text-sm font-medium">
                {settings.sender_display_name || settings.company_name || user?.user_metadata?.full_name || t("settings.senderFallbackName")} &lt;hej@kodco.se&gt;
              </p>
            </div>
          </div>

          {/* Company Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                {t("settings.companyName")}
              </Label>
              <Input
                id="company_name"
                placeholder={t("settings.companyNamePlaceholder")}
                value={settings.company_name}
                onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_website" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                {t("settings.companyWebsite")}
              </Label>
              <Input
                id="company_website"
                type="url"
                placeholder={t("settings.companyWebsitePlaceholder")}
                value={settings.company_website}
                onChange={(e) => setSettings(prev => ({ ...prev, company_website: e.target.value }))}
              />
            </div>
          </div>

          {/* Company Logo Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              {t("settings.companyLogo")}
            </Label>
            <ProfileImageUpload
              currentUrl={settings.company_logo_url}
              userId={user?.id || ""}
              type="logo"
              onUpload={(url) => setSettings(prev => ({ ...prev, company_logo_url: url }))}
              fallback={settings.company_name?.substring(0, 2).toUpperCase() || "CO"}
              size="md"
            />
          </div>

          {/* Email Signature */}
          <div className="space-y-2">
            <Label htmlFor="email_signature">{t("settings.emailSignature")}</Label>
            <Textarea
              id="email_signature"
              placeholder={t("settings.emailSignaturePlaceholder", {
                name: user?.user_metadata?.full_name || t("settings.emailSignatureFallbackName"),
                company: settings.company_name || t("settings.emailSignatureFallbackCompany"),
              })}
              value={settings.email_signature}
              onChange={(e) => setSettings(prev => ({ ...prev, email_signature: e.target.value }))}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.emailSignatureHelp")}
            </p>
          </div>

          {/* Email Footer */}
          <div className="space-y-2">
            <Label htmlFor="email_footer">{t("settings.emailFooter")}</Label>
            <Textarea
              id="email_footer"
              placeholder={t("settings.emailFooterPlaceholder")}
              value={settings.email_footer}
              onChange={(e) => setSettings(prev => ({ ...prev, email_footer: e.target.value }))}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("settings.emailFooterHelp")}
            </p>
          </div>

          {/* Preview */}
          {(settings.email_signature || settings.email_footer) && (
            <div className="space-y-2">
              <Label>{t("settings.signaturePreviewLabel")}</Label>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm text-muted-foreground mb-4 italic">
                  {t("settings.signaturePreviewPlaceholder")}
                </p>
                {settings.email_signature && (
                  <div className="whitespace-pre-wrap text-sm border-t pt-4 mt-4">
                    {settings.email_signature}
                  </div>
                )}
                {settings.company_logo_url && (
                  <div className="mt-4 pt-3 border-t">
                    {settings.company_website ? (
                      <a 
                        href={settings.company_website} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-block hover:opacity-80 transition-opacity"
                      >
                        <img 
                          src={settings.company_logo_url} 
                          alt={t("settings.logoAlt")}
                          className="h-10 max-w-40 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </a>
                    ) : (
                      <img 
                        src={settings.company_logo_url} 
                        alt={t("settings.logoAlt")} 
                        className="h-10 max-w-40 object-contain"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                  </div>
                )}
                {settings.email_footer && (
                  <div className="whitespace-pre-wrap text-xs text-muted-foreground border-t pt-3 mt-3">
                    {settings.email_footer}
                  </div>
                )}
              </div>
            </div>
          )}

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("settings.saving")}
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                {t("settings.saveSettings")}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Tone Selection Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            {t("settings.toneCardTitle")}
          </CardTitle>
          <CardDescription>
            {t("settings.toneCardDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <RadioGroup
            value={settings.outreach_tone}
            onValueChange={(value) => setSettings(prev => ({ ...prev, outreach_tone: value }))}
            className="grid gap-3 sm:grid-cols-2"
          >
            {toneOptions.map((tone) => (
              <div key={tone.value} className="relative">
                <RadioGroupItem
                  value={tone.value}
                  id={tone.value}
                  className="peer sr-only"
                />
                <Label
                  htmlFor={tone.value}
                  className="flex flex-col gap-1 rounded-lg border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary cursor-pointer transition-colors"
                >
                  <span className="font-semibold">{tone.label}</span>
                  <span className="text-sm text-muted-foreground">{tone.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>

          {/* Tone Preview */}
          <div className="space-y-2">
            <Label>Exempel på {selectedTone.label.toLowerCase()} ton:</Label>
            <div className="p-4 rounded-lg border bg-muted/30">
              <p className="text-sm whitespace-pre-wrap">{selectedTone.example}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Detta är ett exempel. Faktiska mail anpassas efter varje leads analysresultat.
            </p>
          </div>

          <Button onClick={handleSave} disabled={isSaving} variant="outline">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sparar...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Spara tonalitet
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
