import { CalendarRange, Trophy } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { statsKpis, leaderboard } from "../sandboxData";

export function SandboxStatistics() {
  const { t } = useTranslation();
  const top = Math.max(...leaderboard.map((l) => l.points));

  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.statistics.explain")}</ExplainPanel>

      <div className="flex justify-end">
        <HighlightButton tip={t("training.sandbox.statistics.tip")} icon={CalendarRange}>
          {t("training.sandbox.statistics.period")}
        </HighlightButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statsKpis.map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-bold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-5">
        <h3 className="font-semibold mb-4 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-500" />
          {t("training.sandbox.statistics.leaderboard")}
        </h3>
        <div className="space-y-3">
          {leaderboard.map((l, i) => (
            <div key={l.name} className="flex items-center gap-3">
              <span className="w-5 text-sm text-muted-foreground tabular-nums">{i + 1}</span>
              <span className="w-16 text-sm font-medium">{l.name}</span>
              <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full" style={{ width: `${(l.points / top) * 100}%` }} />
              </div>
              <span className="text-sm tabular-nums text-muted-foreground">{l.points}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
