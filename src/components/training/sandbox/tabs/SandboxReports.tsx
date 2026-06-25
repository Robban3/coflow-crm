import { FilePlus, FileBarChart } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxReports() {
  const { t } = useTranslation();
  const { sampleReports } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.reports.explain")}</ExplainPanel>

      <HighlightButton tip={t("training.sandbox.reports.tip")} icon={FilePlus}>
        {t("training.sandbox.reports.create")}
      </HighlightButton>

      <div className="grid gap-3 sm:grid-cols-2">
        {sampleReports.map((r) => (
          <div key={r.title} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <FileBarChart className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{r.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {r.type} · {r.date}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
