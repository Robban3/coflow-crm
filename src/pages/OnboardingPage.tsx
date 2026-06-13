import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Building2, Mail, ArrowRight, Check, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProfileImageUpload } from "@/components/settings/ProfileImageUpload";
import { useTranslation } from "@/i18n/LanguageProvider";

const INDUSTRY_TEMPLATES = [
  { id: "telephony", labelKey: "onboarding.industryTelephonyLabel", descriptionKey: "onboarding.industryTelephonyDesc" },
  { id: "fleet", labelKey: "onboarding.industryFleetLabel", descriptionKey: "onboarding.industryFleetDesc" },
  { id: "it", labelKey: "onboarding.industryItLabel", descriptionKey: "onboarding.industryItDesc" },
  { id: "web", labelKey: "onboarding.industryWebLabel", descriptionKey: "onboarding.industryWebDesc" },
  { id: "other", labelKey: "onboarding.industryOtherLabel", descriptionKey: "onboarding.industryOtherDesc" },
];

interface OnboardingData {
  organizationName: string;
  website: string;
  logoUrl: string;
  senderEmail: string;
  senderName: string;
  industry: string;
  serviceDescription: string;
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    organizationName: "",
    website: "",
    logoUrl: "",
    senderEmail: "",
    senderName: "",
    industry: "",
    serviceDescription: "",
  });
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useTranslation();

  // Check if user already completed onboarding
  useEffect(() => {
    const checkOnboarding = async () => {
      if (!user) return;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, organization_id")
        .eq("id", user.id)
        .single();

      if (profile?.onboarding_completed && profile?.organization_id) {
        navigate("/dashboard");
      }
    };
    
    checkOnboarding();
  }, [user, navigate]);

  const handleNext = () => {
    if (step === 1 && !data.organizationName) {
      toast({
        title: t("onboarding.toastOrgNameRequiredTitle"),
        description: t("onboarding.toastOrgNameRequiredDesc"),
        variant: "destructive",
      });
      return;
    }
    setStep(step + 1);
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleComplete = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      // Create organization
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .insert({
          name: data.organizationName,
          website: data.website || null,
          logo_url: data.logoUrl || null,
          sender_email: data.senderEmail || "noreply@resend.dev",
          sender_name: data.senderName || data.organizationName,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (orgError) throw orgError;

      // Update profile with organization and onboarding status
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          organization_id: org.id,
          onboarding_completed: true,
          company_name: data.organizationName,
          company_website: data.website || null,
          company_logo_url: data.logoUrl || null,
          service_industry: data.industry || null,
          service_description: data.serviceDescription || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Admin role is automatically assigned via database trigger

      toast({
        title: t("onboarding.toastWelcomeTitle"),
        description: t("onboarding.toastWelcomeDesc", { name: data.organizationName }),
      });

      navigate("/dashboard");
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast({
        title: t("onboarding.toastErrorTitle"),
        description: error.message || t("onboarding.toastErrorDesc"),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Building2 className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">{t("onboarding.step1Title")}</CardTitle>
              <CardDescription>
                {t("onboarding.step1Desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="orgName">{t("onboarding.orgNameLabel")}</Label>
                <Input
                  id="orgName"
                  placeholder={t("onboarding.orgNamePlaceholder")}
                  value={data.organizationName}
                  onChange={(e) => setData({ ...data, organizationName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">{t("onboarding.websiteLabel")}</Label>
                <Input
                  id="website"
                  type="url"
                  placeholder={t("onboarding.websitePlaceholder")}
                  value={data.website}
                  onChange={(e) => setData({ ...data, website: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>{t("onboarding.logoLabel")}</Label>
                <ProfileImageUpload
                  currentUrl={data.logoUrl}
                  userId={user?.id || "temp"}
                  type="logo"
                  onUpload={(url) => setData({ ...data, logoUrl: url })}
                  fallback={data.organizationName?.substring(0, 2).toUpperCase() || "ORG"}
                  size="md"
                />
              </div>
            </CardContent>
          </>
        );

      case 2:
        return (
          <>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Mail className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">{t("onboarding.step2Title")}</CardTitle>
              <CardDescription>
                {t("onboarding.step2Desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="senderName">{t("onboarding.senderNameLabel")}</Label>
                <Input
                  id="senderName"
                  placeholder={data.organizationName || t("onboarding.senderNamePlaceholder")}
                  value={data.senderName}
                  onChange={(e) => setData({ ...data, senderName: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("onboarding.senderNameHint")}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="senderEmail">{t("onboarding.senderEmailLabel")}</Label>
                <Input
                  id="senderEmail"
                  type="email"
                  placeholder={t("onboarding.senderEmailPlaceholder")}
                  value={data.senderEmail}
                  onChange={(e) => setData({ ...data, senderEmail: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  {t("onboarding.senderEmailHint")}
                </p>
              </div>

              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-sm font-medium mb-1">{t("onboarding.previewLabel")}</p>
                <p className="text-sm text-muted-foreground">
                  {data.senderName || data.organizationName || t("onboarding.previewFallbackOrg")} &lt;{data.senderEmail || "noreply@resend.dev"}&gt;
                </p>
              </div>
            </CardContent>
          </>
        );

      case 3:
        return (
          <>
            <CardHeader className="text-center">
              <div className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center mx-auto mb-4">
                <Briefcase className="h-7 w-7 text-primary-foreground" />
              </div>
              <CardTitle className="text-2xl">{t("onboarding.step3Title")}</CardTitle>
              <CardDescription>
                {t("onboarding.step3Desc")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>{t("onboarding.chooseIndustryLabel")}</Label>
                <div className="grid gap-2">
                  {INDUSTRY_TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setData({ ...data, industry: template.id })}
                      className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                        data.industry === template.id
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/30"
                      }`}
                    >
                      <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        data.industry === template.id ? "border-primary bg-primary" : "border-muted-foreground/50"
                      }`}>
                        {data.industry === template.id && (
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{t(template.labelKey)}</p>
                        <p className="text-sm text-muted-foreground">{t(template.descriptionKey)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serviceDesc">{t("onboarding.serviceDescLabel")}</Label>
                <Textarea
                  id="serviceDesc"
                  placeholder={t("onboarding.serviceDescPlaceholder")}
                  value={data.serviceDescription}
                  onChange={(e) => setData({ ...data, serviceDescription: e.target.value })}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  {t("onboarding.serviceDescHint")}
                </p>
              </div>
            </CardContent>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 pt-6 px-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 flex-1 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <p className="text-center text-sm text-muted-foreground mt-2">
          {t("onboarding.progressStep", { step })}
        </p>

        {renderStep()}

        <div className="flex justify-between p-6 pt-0">
          {step > 1 ? (
            <Button variant="outline" onClick={handleBack} disabled={isLoading}>
              {t("onboarding.back")}
            </Button>
          ) : (
            <div />
          )}
          
          {step < 3 ? (
            <Button onClick={handleNext}>
              {t("onboarding.continue")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleComplete} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("onboarding.creating")}
                </>
              ) : (
                <>
                  {t("onboarding.finish")}
                  <Check className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
