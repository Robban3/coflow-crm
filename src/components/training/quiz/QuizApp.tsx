import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Play, Settings2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { fromTable } from "@/components/documents/supabaseHelper";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pickLocalized } from "@/lib/localized";
import { useTrainingAccess } from "@/hooks/useTrainingAccess";
import { useQuizzes } from "@/hooks/useQuizzes";
import { QuizRunner } from "./QuizRunner";
import { QuizManager } from "./QuizManager";

/** Per-quiz question counts in one query (avoids a hook-per-quiz). */
function useQuestionCounts(enabled: boolean) {
  return useQuery({
    queryKey: ["quiz_question_counts"],
    enabled,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await fromTable("quiz_questions").select("quiz_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of (data ?? []) as { quiz_id: string }[]) {
        counts[row.quiz_id] = (counts[row.quiz_id] ?? 0) + 1;
      }
      return counts;
    },
  });
}

export function QuizApp() {
  const { t, language } = useTranslation();
  const { canView, canEdit } = useTrainingAccess();
  const { quizzes, isLoading } = useQuizzes();
  const { data: counts } = useQuestionCounts(canView);

  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [managingQuizId, setManagingQuizId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeQuizId) {
    const idx = quizzes.findIndex((q) => q.id === activeQuizId);
    const active = idx >= 0 ? quizzes[idx] : undefined;
    const next = idx >= 0 ? quizzes[idx + 1] : undefined;
    return (
      <QuizRunner
        key={activeQuizId}
        quizId={activeQuizId}
        title={active ? pickLocalized(language, active.title, active.title_en, active.title_es) : undefined}
        onExit={() => setActiveQuizId(null)}
        onNext={next ? () => setActiveQuizId(next.id) : undefined}
      />
    );
  }

  if (quizzes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-20 px-6 rounded-xl border border-dashed border-border bg-muted/30">
        <HelpCircle className="h-10 w-10 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground max-w-md">{t("quiz.empty")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{t("quiz.subtitle")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {quizzes.map((q) => {
          const count = counts?.[q.id] ?? 0;
          return (
            <Card key={q.id} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-lg">
                    {pickLocalized(language, q.title, q.title_en, q.title_es)}
                  </CardTitle>
                  <Badge variant="secondary" className="shrink-0">
                    {t("quiz.questionsCount", { n: count })}
                  </Badge>
                </div>
                {q.description && (
                  <CardDescription>
                    {pickLocalized(language, q.description, q.description_en, q.description_es)}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="mt-auto flex items-center gap-2">
                <Button onClick={() => setActiveQuizId(q.id)} disabled={count === 0}>
                  <Play className="h-4 w-4 mr-1.5" />
                  {t("quiz.start")}
                </Button>
                {canEdit && (
                  <Button variant="outline" onClick={() => setManagingQuizId(q.id)}>
                    <Settings2 className="h-4 w-4 mr-1.5" />
                    {t("quiz.manageQuestions")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {managingQuizId && (
        <QuizManager
          quizId={managingQuizId}
          open={!!managingQuizId}
          onOpenChange={(open) => !open && setManagingQuizId(null)}
        />
      )}
    </div>
  );
}
