import { Search, BarChart3, Mail, Plus } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton, SandboxButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxDashboard() {
  const { t } = useTranslation();
  const { sampleStats } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.dashboard.explain")}</ExplainPanel>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sampleStats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-3">{t("dashboard.quickActions")}</h3>
        <div className="flex flex-wrap items-end gap-4">
          <HighlightButton tip={t("training.sandbox.dashboard.tip")} icon={Search}>
            {t("dashboard.quickSearchLeads")}
          </HighlightButton>
          <SandboxButton icon={BarChart3}>{t("dashboard.quickNewAnalysis")}</SandboxButton>
          <SandboxButton icon={Mail}>{t("dashboard.quickMail")}</SandboxButton>
          <SandboxButton icon={Plus}>{t("dashboard.quickNewTask")}</SandboxButton>
        </div>
      </div>
    </div>
  );
}
