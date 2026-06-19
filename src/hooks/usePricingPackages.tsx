import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import { useOrganization } from "@/hooks/useOrganization";

export interface PricingPackage {
  id: string;
  category: string;
  name: string;
  price: string | null;
  unit: string | null;
  description: string | null;
  features: string[];
  highlighted: boolean;
  sort_order: number;
  is_active: boolean;
}

export interface PricingPackageInput {
  category: string;
  name: string;
  price?: string | null;
  unit?: string | null;
  description?: string | null;
  features?: string[];
  highlighted?: boolean;
  sort_order?: number;
}

export function usePricingPackages() {
  const { user } = useAuth();
  const { organization } = useOrganization();
  const queryClient = useQueryClient();
  const orgId = organization?.id ?? null;

  const query = useQuery({
    queryKey: ["pricing_packages", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<PricingPackage[]> => {
      const { data, error } = await fromTable("pricing_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((p: any) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      })) as PricingPackage[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["pricing_packages", orgId] });

  const createPackage = useMutation({
    mutationFn: async (input: PricingPackageInput) => {
      const max = (query.data ?? []).reduce((m, p) => Math.max(m, p.sort_order), 0);
      const { error } = await fromTable("pricing_packages").insert({
        category: input.category,
        name: input.name,
        price: input.price ?? null,
        unit: input.unit ?? null,
        description: input.description ?? null,
        features: input.features ?? [],
        highlighted: input.highlighted ?? false,
        sort_order: input.sort_order ?? max + 1,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updatePackage = useMutation({
    mutationFn: async ({ id, ...input }: PricingPackageInput & { id: string }) => {
      const { error } = await fromTable("pricing_packages")
        .update({
          category: input.category,
          name: input.name,
          price: input.price ?? null,
          unit: input.unit ?? null,
          description: input.description ?? null,
          features: input.features ?? [],
          highlighted: input.highlighted ?? false,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deletePackage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("pricing_packages").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    packages: query.data ?? [],
    isLoading: query.isLoading,
    createPackage,
    updatePackage,
    deletePackage,
  };
}
