import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";

export type TrainingCategoryKind = "content" | "sandbox";

export interface TrainingCategory {
  id: string;
  name: string;
  name_en?: string | null;
  name_es?: string | null;
  slug: string;
  kind: TrainingCategoryKind;
  sort_order: number;
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // strip diacritics (å/ä/ö -> a/a/o)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || `kategori-${Date.now()}`
  );
}

/**
 * Training categories for the current organization. The query only runs when the
 * org has the feature flag on, so non-Applabbet orgs never fetch (and RLS would
 * return nothing anyway). Also exposes admin CRUD mutations.
 */
export function useTrainingCategories() {
  const { user } = useAuth();
  const { canView } = useTrainingAccess();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["training_categories"],
    enabled: canView,
    queryFn: async (): Promise<TrainingCategory[]> => {
      const { data, error } = await fromTable("training_categories")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrainingCategory[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["training_categories"] });

  const createCategory = useMutation({
    mutationFn: async (name: string) => {
      const categories = query.data ?? [];
      const sort_order =
        categories.reduce((max, c) => Math.max(max, c.sort_order), 0) + 1;
      const { error } = await fromTable("training_categories").insert({
        name,
        slug: slugify(name),
        kind: "content",
        sort_order,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateCategory = useMutation({
    mutationFn: async ({
      id,
      name,
      name_en,
      name_es,
    }: {
      id: string;
      name: string;
      name_en?: string | null;
      name_es?: string | null;
    }) => {
      const { error } = await fromTable("training_categories")
        .update({ name, name_en: name_en ?? null, name_es: name_es ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("training_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    categories: query.data ?? [],
    isLoading: query.isLoading,
    isEnabled: canView,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
