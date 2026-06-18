import { Plus } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { sampleTasks } from "../sandboxData";

const prioTone: Record<string, string> = {
  Brådskande: "bg-destructive/15 text-destructive",
  Hög: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Normal: "bg-muted text-muted-foreground",
};

export function SandboxTasks() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.tasks.explain")}</ExplainPanel>

      <HighlightButton tip={t("training.sandbox.tasks.tip")} icon={Plus}>
        {t("training.sandbox.tasks.new")}
      </HighlightButton>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {sampleTasks.map((task) => (
          <div key={task.title} className="flex items-center gap-3 px-4 py-3">
            <span
              className={cn(
                "h-4 w-4 rounded border shrink-0",
                task.done ? "bg-primary border-primary" : "border-muted-foreground/40"
              )}
            />
            <span className={cn("flex-1 text-sm", task.done && "line-through text-muted-foreground")}>
              {task.title}
            </span>
            <span className="text-xs text-muted-foreground hidden sm:inline">{task.due}</span>
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", prioTone[task.priority])}>
              {task.priority}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
