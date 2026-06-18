import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";

export interface TrainingItem {
  id: string;
  category_id: string;
  title: string;
  body: unknown | null; // TipTap document JSON
  video_url: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface TrainingItemInput {
  title: string;
  body?: unknown | null;
  video_url?: string | null;
}

/**
 * Training items for a category. Reads run for any org member (RLS scopes them);
 * mutations are admin-only and rejected by RLS otherwise.
 */
export function useTrainingItems(categoryId: string | null) {
  const { user } = useAuth();
  const { canView } = useTrainingAccess();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["training_items", categoryId],
    enabled: !!categoryId && canView,
    queryFn: async (): Promise<TrainingItem[]> => {
      const { data, error } = await fromTable("training_items")
        .select("*")
        .eq("category_id", categoryId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as TrainingItem[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["training_items", categoryId] });

  const createItem = useMutation({
    mutationFn: async (input: TrainingItemInput) => {
      const items = query.data ?? [];
      const sort_order =
        items.reduce((max, i) => Math.max(max, i.sort_order), 0) + 1;
      const { error } = await fromTable("training_items").insert({
        category_id: categoryId,
        title: input.title,
        body: input.body ?? null,
        video_url: input.video_url ?? null,
        sort_order,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...input }: TrainingItemInput & { id: string }) => {
      const { error } = await fromTable("training_items")
        .update({
          title: input.title,
          body: input.body ?? null,
          video_url: input.video_url ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("training_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    createItem,
    updateItem,
    deleteItem,
  };
}
