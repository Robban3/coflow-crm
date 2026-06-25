import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useSellerProfile } from "@/hooks/useSellerProfile";
import {
  SellerProfileForm, EMPTY_SELLER_PROFILE, type SellerProfileValues, type CompanyForm,
} from "@/components/seller/SellerProfileForm";

// Editable seller profile under Settings. Same form as the first-login popup.
export function SellerProfileSettings() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { profile, isLoading, saving, save, reset, isTestUser } = useSellerProfile();
  const { toast } = useToast();

  const handleReset = async () => {
    const { error } = await reset();
    if (error) {
      toast({ title: t("settings.sellerResetErrorTitle"), description: error, variant: "destructive" });
      return;
    }
    // Reload so the gate (its own hook instance) re-evaluates and the blocking
    // first-login popup shows again.
    window.location.reload();
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  const p = profile as Record<string, any> | null;
  const initial: SellerProfileValues = {
    ...EMPTY_SELLER_PROFILE,
    first_name: p?.first_name ?? "",
    last_name: p?.last_name ?? "",
    applabbet_email: p?.applabbet_email ?? user?.email ?? "",
    external_email: p?.external_email ?? "",
    address: p?.address ?? "",
    postal_code: p?.postal_code ?? "",
    city: p?.city ?? "",
    personnummer: p?.personnummer ?? "",
    company_form: (p?.company_form as CompanyForm) ?? "",
    external_service_name: p?.external_service_name ?? "",
  };

  const handleSave = async (values: SellerProfileValues) => {
    const { error } = await save(values);
    toast(
      error
        ? { title: t("settings.sellerSaveErrorTitle"), description: error, variant: "destructive" }
        : { title: t("settings.sellerSavedTitle"), description: t("settings.sellerSavedDesc") },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.sellerCardTitle")}</CardTitle>
        <CardDescription>
          {t("settings.sellerCardDesc")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SellerProfileForm
          initial={initial}
          saving={saving}
          submitLabel={t("settings.saveChanges")}
          onSave={handleSave}
          lockApplabbetEmail
          lockPersonnummer={!!p?.personnummer}
        />

        {isTestUser && (
          <div className="mt-6 border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">
              {t("settings.sellerTestToolNote")}
            </p>
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4 mr-2" />
              {t("settings.sellerResetButton")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
