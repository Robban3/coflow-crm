import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useQuizQuestions, type QuizQuestion } from "@/hooks/useQuizQuestions";
import { QuizQuestionEditor } from "./QuizQuestionEditor";

interface Props {
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuizManager({ quizId, open, onOpenChange }: Props) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { questions, isLoading, deleteQuestion } = useQuizQuestions(quizId);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuizQuestion | null>(null);

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("quiz.deleteQuestionConfirm"))) return;
    try {
      await deleteQuestion.mutateAsync(id);
    } catch (e: any) {
      toast({
        title: t("common.error"),
        description: e?.message ?? t("common.unexpectedError"),
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("quiz.manageQuestions")}</DialogTitle>
            <DialogDescription>
              {t("quiz.questionsCount", { n: questions.length })}
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : questions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4">{t("quiz.noQuestions")}</p>
          ) : (
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={q.id} className="flex items-center gap-2">
                  <span className="flex-1 text-sm truncate">
                    <span className="text-muted-foreground mr-1.5">{i + 1}.</span>
                    {q.question}
                  </span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0"
                    onClick={() => {
                      setEditing(q);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive"
                    onClick={() => handleDelete(q.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Button
            className="w-full"
            variant="outline"
            onClick={() => {
              setEditing(null);
              setEditorOpen(true);
            }}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            {t("quiz.addQuestion")}
          </Button>
        </DialogContent>
      </Dialog>

      <QuizQuestionEditor
        quizId={quizId}
        open={editorOpen}
        onOpenChange={setEditorOpen}
        question={editing}
      />
    </>
  );
}
