import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useOrganizationId } from "@/hooks/useOrganizationId";
import type { SellerProfileValues } from "@/components/seller/SellerProfileForm";

const APPLABBET_DOMAIN = "@applabbet.com";

// Drives the mandatory seller-profile popup and the settings tab. A "seller" is
// a non-admin @applabbet user; they must fill in their profile once. Admins are
// exempt (per product decision).
export function useSellerProfile() {
  const { user, isAdmin } = useAuth();
  const organizationId = useOrganizationId();
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const email = user?.email?.toLowerCase() ?? "";
  const isApplabbet = email.endsWith(APPLABBET_DOMAIN);
  const isSeller = isApplabbet && !isAdmin;

  const refetch = useCallback(async () => {
    if (!user?.id || !isSeller) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { data } = await (supabase as any)
      .from("seller_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    setProfile((data as Record<string, unknown>) ?? null);
    setIsLoading(false);
  }, [user?.id, isSeller]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const save = useCallback(
    async (values: SellerProfileValues): Promise<{ error?: string }> => {
      if (!user?.id) return { error: "Inte inloggad" };
      setSaving(true);
      const row = {
        user_id: user.id,
        organization_id: organizationId,
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        applabbet_email: values.applabbet_email.trim(),
        external_email: values.external_email.trim(),
        address: values.address.trim(),
        postal_code: values.postal_code.trim(),
        city: values.city.trim(),
        personnummer: values.personnummer.trim(),
        company_form: values.company_form,
        external_service_name:
          values.company_form === "extern_tjanst" ? values.external_service_name.trim() || null : null,
      };
      const { error } = await (supabase as any)
        .from("seller_profiles")
        .upsert(row, { onConflict: "user_id" });
      setSaving(false);
      if (error) return { error: error.message };
      await refetch();
      return {};
    },
    [user?.id, organizationId, refetch],
  );

  const needsSellerProfile = isSeller && !isLoading && !profile;

  return { isSeller, isApplabbet, profile, isLoading, saving, needsSellerProfile, save, refetch };
}
