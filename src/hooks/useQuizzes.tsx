import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";

export interface Quiz {
  id: string;
  key: string;
  title: string;
  title_en?: string | null;
  title_es?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_es?: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface QuizInput {
  key: string;
  title: string;
  title_en?: string | null;
  title_es?: string | null;
  description?: string | null;
  description_en?: string | null;
  description_es?: string | null;
}

/**
 * Quizzes (the bank metadata). Reads run for any @applabbet.com user (RLS scopes
 * them); mutations are admin-only and rejected by RLS otherwise.
 */
export function useQuizzes() {
  const { user } = useAuth();
  const { canView } = useTrainingAccess();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["quizzes"],
    enabled: canView,
    queryFn: async (): Promise<Quiz[]> => {
      const { data, error } = await fromTable("quizzes")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Quiz[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["quizzes"] });

  const createQuiz = useMutation({
    mutationFn: async (input: QuizInput) => {
      const quizzes = query.data ?? [];
      const sort_order = quizzes.reduce((max, q) => Math.max(max, q.sort_order), 0) + 1;
      const { error } = await fromTable("quizzes").insert({
        ...input,
        sort_order,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateQuiz = useMutation({
    mutationFn: async ({ id, ...input }: QuizInput & { id: string }) => {
      const { error } = await fromTable("quizzes").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteQuiz = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("quizzes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    quizzes: query.data ?? [],
    isLoading: query.isLoading,
    createQuiz,
    updateQuiz,
    deleteQuiz,
  };
}
