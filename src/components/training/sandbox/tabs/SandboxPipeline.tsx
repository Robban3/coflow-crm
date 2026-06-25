import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxPipeline() {
  const { t } = useTranslation();
  const { pipelineStages } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.pipeline.explain")}</ExplainPanel>

      <div className="flex gap-3 overflow-x-auto pb-2">
        {pipelineStages.map((stage) => (
          <div key={stage.name} className="w-56 shrink-0">
            <div className="flex items-center justify-between mb-2 px-1">
              <span className="text-sm font-semibold">{stage.name}</span>
              <span className="text-xs text-muted-foreground">{stage.deals.length}</span>
            </div>
            <div className="space-y-2 rounded-xl bg-muted/40 p-2 min-h-24">
              {stage.deals.map((d) => (
                <div
                  key={d.company}
                  className="rounded-lg border border-border bg-card p-3 shadow-sm cursor-grab"
                >
                  <p className="text-sm font-medium">{d.company}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{d.value}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
