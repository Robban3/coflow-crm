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

interface ServiceProfileSettings {
  service_industry: string;
  service_description: string;
}

const industryTemplates = [
  {
    value: "web_agency",
    label: "Webbyrå / IT",
    description: "Hemsidor, SEO, Google Ads, webbutveckling",
    template: `Vi hjälper företag att synas online genom professionella hemsidor, sökmotoroptimering (SEO) och digital marknadsföring. Våra tjänster inkluderar:

• Hemsideutveckling och design
• SEO och synlighet på Google
• Google Ads-kampanjer
• Webbanalys och optimering

Vi fokuserar på att leverera mätbara resultat som ökar synlighet och konverteringar.`,
  },
  {
    value: "telephony",
    label: "Telefoni / Telekom",
    description: "Mobilabonnemang, växellösningar, företagstelefoni",
    template: `Vi erbjuder kostnadseffektiva telefonilösningar för företag. Våra tjänster inkluderar:

• Mobilabonnemang för företag
• Molnbaserade växellösningar
• Fast telefoni och SIP-trunking
• Samlade fakturor och förenklad administration

Vi analyserar företagets nuvarande telefonikostnader och föreslår optimerade lösningar.`,
  },
  {
    value: "fleet_leasing",
    label: "Fordonsleasing",
    description: "Billeasing, fordonsflotta, företagsbilar",
    template: `Vi hjälper företag med kostnadseffektiva och flexibla leasinglösningar för fordonsflottan. Våra tjänster inkluderar:

• Operationell och finansiell leasing
• Tjänstebilar och förmånsbilar
• Elbilar och miljövänliga alternativ
• Flottatjänster och administration

Vi analyserar företagets nuvarande fordonspark och föreslår optimerade avtal.`,
  },
  {
    value: "it_services",
    label: "IT-tjänster / Konsulting",
    description: "Systemutveckling, IT-support, molntjänster",
    template: `Vi levererar IT-tjänster som effektiviserar och säkrar verksamheten. Våra tjänster inkluderar:

• IT-support och helpdesk
• Molnlösningar och Microsoft 365
• Systemutveckling och integration
• IT-säkerhet och backup

Vi hjälper företag att fokusera på sin kärnverksamhet medan vi tar hand om IT:n.`,
  },
  {
    value: "custom",
    label: "Egen bransch",
    description: "Skriv en egen beskrivning av dina tjänster",
    template: "",
  },
];

export function ServiceProfileSettings() {
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
        title: "Tjänsteprofil sparad",
        description: "Din tjänsteprofil kommer nu användas för outreach-generering",
      });
    } catch (error) {
      console.error('Error saving service profile:', error);
      toast({
        title: "Fel",
        description: "Kunde inte spara tjänsteprofilen",
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
          Tjänsteprofil för Outreach
        </CardTitle>
        <CardDescription>
          Beskriv vad din organisation säljer så AI:n kan generera relevant outreach oavsett bransch
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Industry Selection */}
        <div className="space-y-3">
          <Label>Välj branschmall (snabbstart)</Label>
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
            Tjänstebeskrivning
          </Label>
          <Textarea
            id="service_description"
            placeholder="Beskriv vad din organisation säljer, era huvudtjänster, målgrupp och unika säljargument. Detta används av AI:n för att generera relevant outreach..."
            value={settings.service_description}
            onChange={(e) => setSettings(prev => ({ ...prev, service_description: e.target.value }))}
            rows={8}
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            Ju mer detaljerad beskrivning, desto bättre anpassad outreach. Nämn gärna specifika tjänster, 
            prissättning, och vad som skiljer er från konkurrenterna.
          </p>
        </div>

        {/* Preview of what AI will use */}
        {settings.service_description && (
          <div className="space-y-2">
            <Label>Förhandsvisning för AI</Label>
            <div className="p-4 rounded-lg border bg-muted/30 text-sm">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                AI:n kommer använda denna information vid outreach-generering:
              </p>
              <p className="font-medium mb-1">
                Bransch: {selectedIndustry?.label || "Ej vald"}
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
          <p className="font-medium mb-2">💡 Hur används tjänsteprofilen?</p>
          <ul className="space-y-1 text-muted-foreground text-xs">
            <li>• <strong>Telefoniförsäljning:</strong> AI:n refererar till leadens befintliga operatör och abonnemang från Fordonsdata & Telefoni-modulen</li>
            <li>• <strong>Fordonsleasing:</strong> AI:n analyserar leadens fordonsflotta och föreslår optimerade lösningar</li>
            <li>• <strong>Webbyrå:</strong> AI:n använder webbanalysdata som tidigare för att pitcha SEO/Ads</li>
            <li>• <strong>Egen bransch:</strong> AI:n utgår helt från din beskrivning och anpassar efter tillgänglig leaddata</li>
          </ul>
        </div>

        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sparar...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Spara tjänsteprofil
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
