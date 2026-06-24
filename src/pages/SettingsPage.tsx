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
import { User, Building2, Settings as SettingsIcon, Mail, Loader2, Layout, BarChart3, IdCard } from "lucide-react";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import { SellerProfileSettings } from "@/components/settings/SellerProfileSettings";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useModules } from "@/hooks/useModules";
import { TemplatesList } from "@/components/documents/templates/TemplatesList";
import { TemplateEditor } from "@/components/documents/templates/TemplateEditor";
import { Routes, Route, useLocation } from "react-router-dom";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function SettingsPage() {
  const { user, isAdmin } = useAuth();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { hasModuleAccess } = useModules();
  const { canEditProfile: canEditSellerProfile } = useSellerProfile();
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
        title: t("settings.profileSaveErrorTitle"),
        description: t("settings.profileSaveErrorDesc"),
        variant: "destructive",
      });
    } else {
      toast({
        title: t("settings.profileSavedTitle"),
        description: t("settings.profileSavedDesc"),
      });
    }
    setIsSaving(false);
  };

  // If we're editing a specific template, render the editor directly
  if (isTemplateEditor) {
    return (
      <AppLayout title={t("settings.editTemplateTitle")}>
        <TemplateEditor />
      </AppLayout>
    );
  }

  return (
    <AppLayout title={t("settings.pageTitle")}>
      <div className="space-y-4 md:space-y-6">
        <Tabs defaultValue="profile" className="space-y-4 md:space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1 w-full justify-start">
            <TabsTrigger value="profile" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <User className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t("settings.tabProfile")}</span>
              <span className="sm:hidden">{t("settings.tabProfile")}</span>
            </TabsTrigger>
            {canEditSellerProfile && (
              <TabsTrigger value="seller" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <IdCard className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>Mina uppgifter</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="outreach" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Mail className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t("settings.tabOutreach")}</span>
              <span className="sm:hidden">{t("settings.tabOutreachShort")}</span>
            </TabsTrigger>
            {showTemplates && (
              <TabsTrigger value="templates" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Layout className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t("settings.tabTemplates")}</span>
                <span className="sm:hidden">{t("settings.tabTemplates")}</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="organization" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <Building2 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t("settings.tabOrganization")}</span>
                <span className="sm:hidden">{t("settings.tabOrganizationShort")}</span>
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="reports" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
                <BarChart3 className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">{t("settings.tabReports")}</span>
                <span className="sm:hidden">{t("settings.tabReportsShort")}</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="general" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <SettingsIcon className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t("settings.tabGeneral")}</span>
              <span className="sm:hidden">{t("settings.tabGeneralShort")}</span>
            </TabsTrigger>
          </TabsList>

          {/* Seller profile tab */}
          {canEditSellerProfile && (
            <TabsContent value="seller">
              <SellerProfileSettings />
            </TabsContent>
          )}

          {/* Profile Tab */}
          <TabsContent value="profile">
            <Card>
              <CardHeader>
                <CardTitle>{t("settings.profileTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.profileDesc")}
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
                      <Label className="mb-3 block">{t("settings.profileImage")}</Label>
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
                        <Label htmlFor="name">{t("settings.name")}</Label>
                        <Input
                          id="name"
                          value={profile.full_name}
                          onChange={(e) => setProfile(prev => ({ ...prev, full_name: e.target.value }))}
                          placeholder={t("settings.namePlaceholder")}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">{t("settings.email")}</Label>
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
                      {t("settings.saveChanges")}
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
                <CardTitle>{t("settings.generalTitle")}</CardTitle>
                <CardDescription>
                  {t("settings.generalDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{t("settings.emailNotifications")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.emailNotificationsDesc")}
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <p className="font-medium">{t("settings.weeklySummary")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("settings.weeklySummaryDesc")}
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
