import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { useQuizQuestions, type QuizQuestion } from "@/hooks/useQuizQuestions";

const NUM_OPTIONS = 3;
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/** Pad/trim an options array to a fixed length of editable strings. */
function toFields(options?: string[] | null): string[] {
  const a = [...(options ?? [])];
  while (a.length < NUM_OPTIONS) a.push("");
  return a.slice(0, NUM_OPTIONS);
}
/** Trimmed options, or null when every field is empty (falls back to base). */
function fromFields(fields: string[]): string[] | null {
  const trimmed = fields.map((f) => f.trim());
  return trimmed.some((f) => f.length > 0) ? trimmed : null;
}

interface Props {
  quizId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question?: QuizQuestion | null;
}

export function QuizQuestionEditor({ quizId, open, onOpenChange, question }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {open && (
          <EditorForm
            key={question?.id ?? "new"}
            quizId={quizId}
            question={question}
            onClose={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditorForm({
  quizId,
  question,
  onClose,
}: {
  quizId: string;
  question?: QuizQuestion | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { createQuestion, updateQuestion } = useQuizQuestions(quizId);

  const [qSv, setQSv] = useState(question?.question ?? "");
  const [qEn, setQEn] = useState(question?.question_en ?? "");
  const [qEs, setQEs] = useState(question?.question_es ?? "");
  const [optsSv, setOptsSv] = useState<string[]>(toFields(question?.options));
  const [optsEn, setOptsEn] = useState<string[]>(toFields(question?.options_en));
  const [optsEs, setOptsEs] = useState<string[]>(toFields(question?.options_es));
  const [explSv, setExplSv] = useState(question?.explanation ?? "");
  const [explEn, setExplEn] = useState(question?.explanation_en ?? "");
  const [explEs, setExplEs] = useState(question?.explanation_es ?? "");
  const [correct, setCorrect] = useState(question?.correct_index ?? 0);

  const isEditing = !!question;
  const isSaving = createQuestion.isPending || updateQuestion.isPending;

  const langs = [
    { code: "sv", label: "Svenska", q: qSv, setQ: setQSv, opts: optsSv, setOpts: setOptsSv, expl: explSv, setExpl: setExplSv },
    { code: "en", label: "English", q: qEn, setQ: setQEn, opts: optsEn, setOpts: setOptsEn, expl: explEn, setExpl: setExplEn },
    { code: "es", label: "Español", q: qEs, setQ: setQEs, opts: optsEs, setOpts: setOptsEs, expl: explEs, setExpl: setExplEs },
  ] as const;

  const setOptionAt = (
    setter: (v: string[]) => void,
    current: string[],
    idx: number,
    value: string
  ) => {
    const next = [...current];
    next[idx] = value;
    setter(next);
  };

  const handleSave = async () => {
    const baseOptions = fromFields(optsSv);
    if (!qSv.trim()) {
      toast({ title: t("quiz.questionRequired"), variant: "destructive" });
      return;
    }
    if (!baseOptions || baseOptions.filter((o) => o.length > 0).length < 2) {
      toast({ title: t("quiz.optionsRequired"), variant: "destructive" });
      return;
    }
    try {
      const payload = {
        question: qSv.trim(),
        question_en: qEn.trim() || null,
        question_es: qEs.trim() || null,
        options: baseOptions,
        options_en: fromFields(optsEn),
        options_es: fromFields(optsEs),
        correct_index: Math.min(correct, baseOptions.length - 1),
        explanation: explSv.trim() || null,
        explanation_en: explEn.trim() || null,
        explanation_es: explEs.trim() || null,
      };
      if (isEditing) {
        await updateQuestion.mutateAsync({ id: question!.id, ...payload });
      } else {
        await createQuestion.mutateAsync(payload);
      }
      toast({ title: t("quiz.saved") });
      onClose();
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
      <DialogHeader>
        <DialogTitle>{isEditing ? t("quiz.editQuestion") : t("quiz.newQuestion")}</DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <Tabs defaultValue="sv">
          <TabsList className="grid w-full grid-cols-3">
            {langs.map((l) => (
              <TabsTrigger key={l.code} value={l.code}>
                {l.label}
              </TabsTrigger>
            ))}
          </TabsList>

          {langs.map((l) => (
            <TabsContent key={l.code} value={l.code} className="space-y-4 mt-4">
              {l.code !== "sv" && (
                <p className="text-xs text-muted-foreground">{t("quiz.fallbackHint")}</p>
              )}
              <div className="space-y-2">
                <Label>{t("quiz.fieldQuestion")}</Label>
                <Input value={l.q} onChange={(e) => l.setQ(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("quiz.fieldOptions")}</Label>
                {l.opts.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-5 text-sm text-muted-foreground">{LETTERS[i]})</span>
                    <Input
                      value={opt}
                      onChange={(e) => setOptionAt(l.setOpts, l.opts, i, e.target.value)}
                      placeholder={`${t("quiz.fieldOption")} ${LETTERS[i]}`}
                    />
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <Label>{t("quiz.fieldExplanation")}</Label>
                <Textarea value={l.expl} onChange={(e) => l.setExpl(e.target.value)} rows={2} />
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="space-y-2 border-t border-border pt-4">
          <Label>{t("quiz.fieldCorrect")}</Label>
          <RadioGroup
            value={String(correct)}
            onValueChange={(v) => setCorrect(Number(v))}
            className="flex gap-4"
          >
            {optsSv.map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <RadioGroupItem value={String(i)} id={`correct-${i}`} />
                <Label htmlFor={`correct-${i}`} className="font-normal cursor-pointer">
                  {LETTERS[i]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onClose} disabled={isSaving}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t("quiz.save")}
        </Button>
      </DialogFooter>
    </>
  );
}
