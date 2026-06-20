import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useAuth } from "@/hooks/useAuth";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question: string;
  question_en?: string | null;
  question_es?: string | null;
  options: string[];
  options_en?: string[] | null;
  options_es?: string[] | null;
  correct_index: number;
  explanation?: string | null;
  explanation_en?: string | null;
  explanation_es?: string | null;
  sort_order: number;
  is_published: boolean;
}

export interface QuizQuestionInput {
  question: string;
  question_en?: string | null;
  question_es?: string | null;
  options: string[];
  options_en?: string[] | null;
  options_es?: string[] | null;
  correct_index: number;
  explanation?: string | null;
  explanation_en?: string | null;
  explanation_es?: string | null;
}

/**
 * The question bank for a quiz. Reads run for any @applabbet.com user (RLS scopes
 * them); mutations are admin-only and rejected by RLS otherwise.
 */
export function useQuizQuestions(quizId: string | null) {
  const { user } = useAuth();
  const { canView } = useTrainingAccess();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["quiz_questions", quizId],
    enabled: !!quizId && canView,
    queryFn: async (): Promise<QuizQuestion[]> => {
      const { data, error } = await fromTable("quiz_questions")
        .select("*")
        .eq("quiz_id", quizId)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as QuizQuestion[];
    },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["quiz_questions", quizId] });

  const createQuestion = useMutation({
    mutationFn: async (input: QuizQuestionInput) => {
      const questions = query.data ?? [];
      const sort_order =
        questions.reduce((max, q) => Math.max(max, q.sort_order), 0) + 1;
      const { error } = await fromTable("quiz_questions").insert({
        quiz_id: quizId,
        ...input,
        sort_order,
        created_by: user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const updateQuestion = useMutation({
    mutationFn: async ({ id, ...input }: QuizQuestionInput & { id: string }) => {
      const { error } = await fromTable("quiz_questions").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteQuestion = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("quiz_questions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return {
    questions: query.data ?? [],
    isLoading: query.isLoading,
    createQuestion,
    updateQuestion,
    deleteQuestion,
  };
}
