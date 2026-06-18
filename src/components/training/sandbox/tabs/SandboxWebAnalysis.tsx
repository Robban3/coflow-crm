import { Globe, ScanSearch } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { webAnalysisSite, webAnalysisScores, webAnalysisFindings } from "../sandboxData";

function scoreTone(v: number) {
  if (v >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-destructive";
}

export function SandboxWebAnalysis() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.webanalysis.explain")}</ExplainPanel>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          {webAnalysisSite}
        </div>
        <HighlightButton tip={t("training.sandbox.webanalysis.tip")} icon={ScanSearch}>
          {t("training.sandbox.webanalysis.analyze")}
        </HighlightButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {webAnalysisScores.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <p className={cn("text-3xl font-bold", scoreTone(s.value))}>{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-3">{t("training.sandbox.webanalysis.findings")}</h3>
        <ul className="space-y-2">
          {webAnalysisFindings.map((f) => (
            <li key={f} className="flex items-start gap-2 text-sm">
              <span className="mt-1 h-1.5 w-1.5 rounded-full bg-destructive shrink-0" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
