import { CalendarPlus, Clock, Link2 } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxMeetings() {
  const { t } = useTranslation();
  const { sampleMeetings } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.meetings.explain")}</ExplainPanel>

      <HighlightButton tip={t("training.sandbox.meetings.tip")} icon={CalendarPlus}>
        {t("training.sandbox.meetings.book")}
      </HighlightButton>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {sampleMeetings.map((m) => (
          <div key={m.title} className="flex items-center gap-4 px-4 py-3">
            <div className="flex flex-col items-center justify-center w-14 shrink-0">
              <span className="text-xs text-muted-foreground">{m.date}</span>
              <span className="text-sm font-semibold inline-flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {m.time}
              </span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{m.title}</p>
              <p className="text-xs text-muted-foreground truncate">{m.withWhom}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Link2 className="h-3.5 w-3.5" />
        {t("training.sandbox.meetings.booking")}
      </p>
    </div>
  );
}
