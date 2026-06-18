import { Plus } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { sampleTickets } from "../sandboxData";

const statusTone: Record<string, string> = {
  Öppen: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  Pågående: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Löst: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export function SandboxTickets() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.tickets.explain")}</ExplainPanel>

      <HighlightButton tip={t("training.sandbox.tickets.tip")} icon={Plus}>
        {t("training.sandbox.tickets.new")}
      </HighlightButton>

      <div className="grid gap-3 sm:grid-cols-2">
        {sampleTickets.map((tk) => (
          <div key={tk.title} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <span className="font-medium text-sm">{tk.title}</span>
              <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium shrink-0", statusTone[tk.status])}>
                {tk.status}
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded-full bg-muted">{tk.type}</span>
              <span>·</span>
              <span>{tk.priority}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
