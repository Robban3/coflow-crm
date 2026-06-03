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

const toneOptions = [
  {
    value: "standard",
    label: "Standard",
    description: "Balanserat och professionellt",
    example: `Hej,

Jag har analyserat er webbplats och noterade att SEO-poängen ligger på 45/100. Det finns goda möjligheter att förbättra er synlighet i sökmotorer.

Har ni tid för ett kort samtal om hur ni kan nå fler potentiella kunder?`,
  },
  {
    value: "familiar",
    label: "Familjär",
    description: "Varmt och personligt",
    example: `Hej!

Jag tittade precis på er sajt och blev nyfiken – ni har en riktigt snygg design! Såg dock att SEO-poängen hamnade på 45/100, vilket ofta beror på tekniska smågrejer som är enkla att fixa.

Skulle vara kul att höra mer om er verksamhet – har du några minuter över?`,
  },
  {
    value: "informative",
    label: "Informativ",
    description: "Faktabaserat och pedagogiskt",
    example: `Hej,

Efter en analys av er webbplats kan jag konstatera att SEO-poängen ligger på 45/100. Detta påverkar er synlighet i sökresultaten – studier visar att 75% av användare aldrig scrollar förbi första sidan på Google.

De främsta förbättringsområdena jag identifierade rör meta-beskrivningar och rubrikstruktur. Vill du att jag går igenom dem mer i detalj?`,
  },
  {
    value: "direct",
    label: "Direkt",
    description: "Rakt på sak, kortfattat",
    example: `Hej,

Analyserade er sajt – SEO: 45/100. Ni tappar sannolikt trafik.

Kan vi ta 15 min nästa vecka för att gå igenom de snabbaste förbättringarna?`,
  },
];

export function EmailSignatureSettings() {
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
        title: "Inställningar sparade",
        description: "Dina outreach-inställningar har uppdaterats",
      });
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara inställningarna",
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
            Avsändare & signatur
          </CardTitle>
          <CardDescription>
            Anpassa hur dina outreach-mail visas för mottagaren
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Sender Display Name */}
          <div className="space-y-2">
            <Label htmlFor="sender_display_name">Avsändarnamn</Label>
            <Input
              id="sender_display_name"
              placeholder={settings.company_name || user?.user_metadata?.full_name || "Ditt namn eller företag"}
              value={settings.sender_display_name}
              onChange={(e) => setSettings(prev => ({ ...prev, sender_display_name: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Detta namn visas som avsändare i mottagarens inkorg. 
              Lämna tomt för att använda ditt fullständiga namn eller företagsnamn.
            </p>
            <div className="p-3 rounded-lg bg-muted/50 border">
              <p className="text-xs text-muted-foreground mb-1">Förhandsgranskning:</p>
              <p className="text-sm font-medium">
                {settings.sender_display_name || settings.company_name || user?.user_metadata?.full_name || "Kod & Co."} &lt;hej@kodco.se&gt;
              </p>
            </div>
          </div>

          {/* Company Info */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="company_name" className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Företagsnamn
              </Label>
              <Input
                id="company_name"
                placeholder="Ditt Företag AB"
                value={settings.company_name}
                onChange={(e) => setSettings(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_website" className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Hemsida
              </Label>
              <Input
                id="company_website"
                type="url"
                placeholder="https://dittforetag.se"
                value={settings.company_website}
                onChange={(e) => setSettings(prev => ({ ...prev, company_website: e.target.value }))}
              />
            </div>
          </div>

          {/* Company Logo Upload */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              Företagslogga
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
            <Label htmlFor="email_signature">E-postsignatur</Label>
            <Textarea
              id="email_signature"
              placeholder={`Med vänliga hälsningar,

${user?.user_metadata?.full_name || 'Ditt Namn'}
${settings.company_name || 'Företaget'}
Tel: 070-XXX XX XX`}
              value={settings.email_signature}
              onChange={(e) => setSettings(prev => ({ ...prev, email_signature: e.target.value }))}
              rows={5}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Läggs till i slutet av varje AI-genererat mail
            </p>
          </div>

          {/* Email Footer */}
          <div className="space-y-2">
            <Label htmlFor="email_footer">E-postfot (frivillig)</Label>
            <Textarea
              id="email_footer"
              placeholder="T.ex. avregistreringslänk, företagsadress, disclaimer..."
              value={settings.email_footer}
              onChange={(e) => setSettings(prev => ({ ...prev, email_footer: e.target.value }))}
              rows={3}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Extra text som läggs till allra sist i mailet
            </p>
          </div>

          {/* Preview */}
          {(settings.email_signature || settings.email_footer) && (
            <div className="space-y-2">
              <Label>Förhandsvisning av signatur</Label>
              <div className="p-4 rounded-lg border bg-card">
                <p className="text-sm text-muted-foreground mb-4 italic">
                  [AI-genererad mailtext kommer här...]
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
                          alt="Logotyp" 
                          className="h-10 max-w-40 object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </a>
                    ) : (
                      <img 
                        src={settings.company_logo_url} 
                        alt="Logotyp" 
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
                Sparar...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Spara inställningar
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
            Tonalitet för AI-mail
          </CardTitle>
          <CardDescription>
            Välj hur dina AI-genererade outreach-mail ska låta
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
