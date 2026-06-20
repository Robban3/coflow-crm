import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2, RotateCcw, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/LanguageProvider";
import { pickLocalized } from "@/lib/localized";
import { useQuizQuestions, type QuizQuestion } from "@/hooks/useQuizQuestions";

/** How many questions to draw from the bank per attempt. */
const QUESTIONS_PER_ATTEMPT = 10;

/** Fisher–Yates shuffle returning a new array. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface AttemptOption {
  text: string;
  originalIndex: number;
}
interface AttemptQuestion {
  id: string;
  question: string;
  explanation: string | null;
  options: AttemptOption[];
  /** Index into `options` (after shuffling) that is correct. */
  correctDisplayIndex: number;
}

/** Build one attempt: random subset, shuffled options, correct index remapped. */
function buildAttempt(bank: QuizQuestion[], language: string): AttemptQuestion[] {
  const chosen = shuffle(bank.filter((q) => q.is_published)).slice(
    0,
    Math.min(QUESTIONS_PER_ATTEMPT, bank.length)
  );
  return chosen.map((q) => {
    const baseOptions = pickLocalized(language, q.options, q.options_en, q.options_es) ?? [];
    const display = shuffle(
      baseOptions.map((text, originalIndex) => ({ text, originalIndex }))
    );
    return {
      id: q.id,
      question: pickLocalized(language, q.question, q.question_en, q.question_es),
      explanation: pickLocalized(language, q.explanation ?? null, q.explanation_en, q.explanation_es),
      options: display,
      correctDisplayIndex: display.findIndex((o) => o.originalIndex === q.correct_index),
    };
  });
}

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export function QuizRunner({
  quizId,
  onExit,
  onNext,
}: {
  quizId: string;
  onExit: () => void;
  /** When set, show a "Nästa quiz" button after grading. */
  onNext?: () => void;
}) {
  const { t, language } = useTranslation();
  const { questions, isLoading } = useQuizQuestions(quizId);

  const [attemptSeed, setAttemptSeed] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  // After grading, scroll the result into view so it's seen without scrolling.
  useEffect(() => {
    if (submitted) {
      resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [submitted]);

  // Rebuild the attempt whenever the bank, language or attempt counter changes.
  const attempt = useMemo(
    () => buildAttempt(questions, language),
    [questions, language, attemptSeed]
  );

  // Reset answers/submission each time a fresh attempt is built.
  useEffect(() => {
    setAnswers({});
    setSubmitted(false);
  }, [attemptSeed, questions, language]);

  const answeredCount = attempt.filter((q) => answers[q.id] !== undefined).length;
  const allAnswered = attempt.length > 0 && answeredCount === attempt.length;
  const score = attempt.filter((q) => answers[q.id] === q.correctDisplayIndex).length;

  const restart = () => setAttemptSeed((s) => s + 1);

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (attempt.length === 0) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t("quiz.backToList")}
        </Button>
        <p className="text-sm text-muted-foreground">{t("quiz.noQuestions")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" onClick={onExit}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {t("quiz.backToList")}
        </Button>
        {!submitted && (
          <span className="text-sm text-muted-foreground">
            {t("quiz.answeredCount", { n: answeredCount, total: attempt.length })}
          </span>
        )}
      </div>

      {submitted && (
        <div ref={resultRef} className="rounded-xl border border-border bg-card p-5 space-y-3 scroll-mt-4">
          <div>
            <p className="text-sm text-muted-foreground">{t("quiz.result")}</p>
            <p className="text-2xl font-bold">
              {t("quiz.scoreLine", { n: score, total: attempt.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={restart}>
              <RotateCcw className="h-4 w-4 mr-1.5" />
              {t("quiz.tryAgain")}
            </Button>
            {onNext ? (
              <Button variant="outline" onClick={onNext}>
                {t("quiz.nextQuiz")}
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            ) : (
              <Button variant="outline" onClick={onExit}>
                {t("quiz.backToList")}
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {attempt.map((q, qi) => {
          const selected = answers[q.id];
          return (
            <article key={q.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">
                  <span className="text-muted-foreground mr-2">{qi + 1}.</span>
                  {q.question}
                </h3>
                {submitted &&
                  (selected === q.correctDisplayIndex ? (
                    <Badge variant="success" className="shrink-0 gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {t("quiz.correct")}
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="shrink-0 gap-1">
                      <XCircle className="h-3 w-3" />
                      {t("quiz.incorrect")}
                    </Badge>
                  ))}
              </div>

              <RadioGroup
                value={selected !== undefined ? String(selected) : ""}
                onValueChange={(v) =>
                  setAnswers((prev) => ({ ...prev, [q.id]: Number(v) }))
                }
                disabled={submitted}
              >
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.correctDisplayIndex;
                  const isChosen = oi === selected;
                  return (
                    <div
                      key={oi}
                      className={cn(
                        "flex items-center gap-3 rounded-md border px-3 py-2 transition-colors",
                        !submitted && "border-border",
                        submitted && isCorrect && "border-success bg-success/10",
                        submitted && isChosen && !isCorrect && "border-destructive bg-destructive/10",
                        submitted && !isCorrect && !isChosen && "border-border opacity-70"
                      )}
                    >
                      <RadioGroupItem value={String(oi)} id={`${q.id}-${oi}`} />
                      <Label htmlFor={`${q.id}-${oi}`} className="flex-1 cursor-pointer font-normal">
                        <span className="text-muted-foreground mr-2">{LETTERS[oi]})</span>
                        {opt.text}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>

              {submitted && q.explanation && (
                <p className="text-sm text-muted-foreground border-t border-border pt-3">
                  <span className="font-medium text-foreground">{t("quiz.explanation")}: </span>
                  {q.explanation}
                </p>
              )}
            </article>
          );
        })}
      </div>

      {!submitted && (
        <div className="flex items-center gap-2">
          <Button onClick={() => setSubmitted(true)} disabled={!allAnswered}>
            {t("quiz.submit")}
          </Button>
        </div>
      )}
    </div>
  );
}
