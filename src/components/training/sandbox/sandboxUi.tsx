import { Info, Sparkles, type LucideIcon } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";

/** Explanation card shown at the top of every sandbox tab. */
export function ExplainPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4">
      <Info className="h-5 w-5 shrink-0 text-primary mt-0.5" />
      <p className="text-sm text-foreground/90 leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * A highlighted "important function" button. Does nothing but show a
 * practice-mode toast — nothing is ever saved in the sandbox.
 */
export function HighlightButton({
  children,
  tip,
  icon: Icon,
}: {
  children: React.ReactNode;
  tip?: string;
  icon?: LucideIcon;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <div className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary">
        <Sparkles className="h-3 w-3" />
        {t("training.sandbox.important")}
      </span>
      <button
        type="button"
        onClick={() => toast({ title: t("training.sandbox.practiceToast") })}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-background hover:opacity-90"
      >
        {Icon && <Icon className="h-4 w-4" />}
        {children}
      </button>
      {tip && <span className="text-xs text-muted-foreground max-w-xs">{tip}</span>}
    </div>
  );
}

/** A plain, non-highlighted sandbox button (also a no-op). */
export function SandboxButton({
  children,
  icon: Icon,
  className,
}: {
  children: React.ReactNode;
  icon?: LucideIcon;
  className?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ title: t("training.sandbox.practiceToast") })}
      className={cn(
        "inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background text-sm font-medium hover:bg-accent",
        className
      )}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
