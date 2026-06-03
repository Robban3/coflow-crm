import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Save, Mail, Key, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface OrganizationEmailConfig {
  sender_email: string;
  sender_name: string;
  resend_api_key_configured: boolean;
}

export function OrganizationEmailSettings() {
  const [config, setConfig] = useState<OrganizationEmailConfig>({
    sender_email: "",
    sender_name: "",
    resend_api_key_configured: false,
  });
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (user?.id) {
      fetchConfig();
    }
  }, [user?.id]);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      // First get user's organization_id from profile
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user!.id)
        .single();

      if (profileError || !profile?.organization_id) {
        setIsLoading(false);
        return;
      }

      setOrganizationId(profile.organization_id);

      // Then fetch organization settings
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select("sender_email, sender_name, resend_api_key_configured")
        .eq("id", profile.organization_id)
        .single();

      if (orgError) throw orgError;

      if (org) {
        setConfig({
          sender_email: org.sender_email || "",
          sender_name: org.sender_name || "",
          resend_api_key_configured: org.resend_api_key_configured || false,
        });
      }
    } catch (error) {
      console.error("Error fetching organization email config:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organizationId) {
      toast({
        title: "Ingen organisation",
        description: "Du tillhör ingen organisation ännu.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          sender_email: config.sender_email || null,
          sender_name: config.sender_name || null,
        })
        .eq("id", organizationId);

      if (error) throw error;

      toast({
        title: "E-postinställningar sparade",
        description: "Organisationens e-postkonfiguration har uppdaterats.",
      });
    } catch (error) {
      console.error("Error saving email config:", error);
      toast({
        title: "Fel",
        description: "Kunde inte spara e-postinställningarna",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!organizationId) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Du tillhör ingen organisation.</p>
        </CardContent>
      </Card>
    );
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Organisations e-postinställningar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Endast administratörer kan ändra organisationens e-postinställningar.
            </AlertDescription>
          </Alert>
          <div className="mt-4 p-4 rounded-lg border bg-muted/30">
            <p className="text-sm">
              <strong>Avsändare:</strong> {config.sender_name || "Ej konfigurerat"} &lt;{config.sender_email || "noreply@resend.dev"}&gt;
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Organisations e-postinställningar
        </CardTitle>
        <CardDescription>
          Konfigurera hur outreach-mail skickas från din organisation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="org_sender_name">Avsändarnamn</Label>
            <Input
              id="org_sender_name"
              placeholder="Din Organisation"
              value={config.sender_name}
              onChange={(e) => setConfig({ ...config, sender_name: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="org_sender_email">Avsändaradress</Label>
            <Input
              id="org_sender_email"
              type="email"
              placeholder="hej@dinorganisation.se"
              value={config.sender_email}
              onChange={(e) => setConfig({ ...config, sender_email: e.target.value })}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg border bg-muted/30">
          <p className="text-sm font-medium mb-1">Förhandsgranskning:</p>
          <p className="text-sm text-muted-foreground">
            {config.sender_name || "Din Organisation"} &lt;{config.sender_email || "noreply@resend.dev"}&gt;
          </p>
        </div>

        {/* Resend API Key Status */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            Egen Resend API-nyckel
          </Label>
          
          {config.resend_api_key_configured ? (
            <Alert className="border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                En egen Resend API-nyckel är konfigurerad. Mail skickas från er verifierade domän.
              </AlertDescription>
            </Alert>
          ) : (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <p className="mb-2">
                  För att skicka mail från <strong>{config.sender_email || "er egen domän"}</strong> behöver du:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Skapa konto på <a href="https://resend.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">resend.com</a></li>
                  <li>Verifiera din domän (DNS-poster)</li>
                  <li>Skapa en API-nyckel</li>
                  <li>Kontakta support för att lägga till nyckeln</li>
                </ol>
                <p className="mt-2 text-xs text-muted-foreground">
                  Utan egen nyckel skickas mail från standardadressen noreply@resend.dev
                </p>
              </AlertDescription>
            </Alert>
          )}
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
              Spara e-postinställningar
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
