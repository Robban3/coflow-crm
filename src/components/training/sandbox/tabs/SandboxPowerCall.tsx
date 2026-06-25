import { Phone, PhoneOff, PhoneForwarded, CalendarCheck } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton, SandboxButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxPowerCall() {
  const { t } = useTranslation();
  const { powerCallLead: lead } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.powercall.explain")}</ExplainPanel>

      <div className="max-w-xl rounded-2xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span>
            {lead.done} / {lead.done + lead.queue}
          </span>
          <span>{t("nav.outreach_pro")}</span>
        </div>

        <h3 className="text-xl font-bold">{lead.company}</h3>
        <p className="text-muted-foreground">{lead.contact}</p>
        <p className="text-lg font-mono mt-2">{lead.phone}</p>
        <p className="text-sm bg-muted/50 rounded-lg p-3 mt-3">{lead.note}</p>

        <div className="flex flex-wrap items-end gap-4 mt-5">
          <HighlightButton tip={t("training.sandbox.powercall.tip")} icon={Phone}>
            {t("training.sandbox.powercall.call")}
          </HighlightButton>
          <SandboxButton icon={CalendarCheck}>{t("pipeline.stage.meeting_booked")}</SandboxButton>
          <SandboxButton icon={PhoneForwarded}>{t("training.sandbox.powercall.next")}</SandboxButton>
          <SandboxButton icon={PhoneOff}>{t("training.sandbox.powercall.noAnswer")}</SandboxButton>
        </div>
      </div>
    </div>
  );
}
