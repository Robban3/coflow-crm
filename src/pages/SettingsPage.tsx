import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/hooks/useAuth";
import { EmailSignatureSettings } from "@/components/settings/EmailSignatureSettings";
import { OrganizationDashboard } from "@/components/settings/OrganizationDashboard";
import { OrganizationEmailSettings } from "@/components/settings/OrganizationEmailSettings";
import { ProfileImageUpload } from "@/components/settings/ProfileImageUpload";
import { GrowthReportPricingSettings } from "@/components/reports/growth/GrowthReportPricingSettings";
import { User, Building2, Settings as SettingsIcon, Mail, Loader2, Layout, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useModules } from "@/hooks/useModules";
import { TemplatesList } from "@/components/documents/templates/TemplatesList";
import { TemplateEditor } from "@/components/documents/templates/TemplateEditor";
import { Routes, Route, useLocation } from "react-router-dom";

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const { hasModuleAccess } = useModules();
  const location = useLocation();

  // Check if we're on a template editor sub-route
  const isTemplateEditor = location.pathname.startsWith("/settings/templates/");

  const [profile, setProfile] = useState({
    full_name: "",
    avatar_url: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const showTemplates = hasModuleAccess('templates');

  const initials = profile.full_name
    ? profile.full_name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
    : user?.email?.substring(0, 2).toUpperCase() || 'U';

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    
    const { data, error } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && data) {
      setProfile({
        full_name: data.full_name || "",
        avatar_url: data.avatar_url || "",
      });
    }
    setIsLoading(false);
  };

  const handleSaveProfile = async () => {
    if (!user?.id) return;
    setIsSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: profile.full_name || null,
        avatar_url: profile.avatar_url || null,
      })
      .eq("id", user.id);

    if (error) {
      toast({
        title: "Fel",
        description: "Kunde inte spara profiländringar",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Sparad!",
        description: "Din profil har uppdaterats",
      });
    }
    setIsSaving(false);
  };

  // If we're editing a specific template, render the editor directly
  if (isTemplateEditor) {
    return (
      <AppLayout title="Redigera mall">
        <TemplateEditor />
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Inställningar">
      <div className="space-y-4 md:space-y-6">
        <Tabs defaultValue="profile" className="space-y-4 md:space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
            <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Profil</span>
              <span className="sm:hidden">Profil</span>
            </TabsTrigger>
            <TabsTrigger value="outreach" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Outreach</span>
              <span className="sm:hidden">Mail</span>
            </TabsTrigger>
            {showTemplates && (
              <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Layout className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Mallar</span>
                <span className="sm:hidden">Mallar</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="organization" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Organisation</span>
                <span className="sm:hidden">Org</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Rapporter</span>
                <span className="sm:hidden">Rapp.</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="general" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <SettingsIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Allmänt</span>
              <span className="sm:hidden">Mer</span>
            </TabsTrigger>
          </TabsList>

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>Profil</CardTitle>
                <CardDescription>
                  Hantera din personliga information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <>
                    <div>
                      <Label className="mb-3 block">Profilbild</Label>
                      <ProfileImageUpload
                        currentUrl={profile.avatar_url}
                        userId={user?.id || ""}
                        type="avatar"
                        onUpload={(url) => setProfile(prev => ({ ...prev, avatar_url: url }))}
                        fallback={initials}
                        size="lg"
                      />
                    </div>

                    <div className="grid gap-4 max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="name">Namn</Label>
                        <Input
                          id="name"
                          value={profile.full_name}
                          onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder="Ditt namn"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">E-post</Label>
                        <Input
                          id="email"
                          type="email"
                          defaultValue={user?.email || ''}
                          disabled
                        />
                      </div>
                    </div>

                    <Button onClick={handleSaveProfile} disabled={isSaving}>
                      {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Spara ändringar
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Outreach Tab */}
          <TabsContent value="outreach" className="space-y-6">
            {isAdmin && <OrganizationEmailSettings />}
            <EmailSignatureSettings />
          </TabsContent>

          {/* Templates Tab */}
          {showTemplates && (
            <TabsContent value="templates">
              <TemplatesList />
            </TabsContent>
          )}

          {/* Organization Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="organization">
              <OrganizationDashboard />
            </TabsContent>
          )}

          {/* Reports Pricing Tab (Admin only) */}
          {isAdmin && (
            <TabsContent value="reports">
              <GrowthReportPricingSettings />
            </TabsContent>
          )}

          {/* General Tab */}
          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Allmänna inställningar</CardTitle>
                <CardDescription>
                  Generella systeminställningar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Notifikationer via e-post</p>
                    <p className="text-sm text-muted-foreground">
                      Få påminnelser om uppföljningar och tasks
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">Veckosammanfattning</p>
                    <p className="text-sm text-muted-foreground">
                      Få en sammanfattning av veckans aktiviteter
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
