import { Send, PenSquare } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

export function SandboxMail() {
  const { t } = useTranslation();
  const { sampleEmails } = useSandboxData();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.mail.explain")}</ExplainPanel>

      <HighlightButton tip={t("training.sandbox.mail.tip")} icon={PenSquare}>
        {t("training.sandbox.mail.compose")}
      </HighlightButton>

      <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
        {sampleEmails.map((m) => (
          <div key={m.subject} className="flex items-center gap-3 px-4 py-3">
            <div className={cn("h-2 w-2 rounded-full shrink-0", m.unread ? "bg-primary" : "bg-transparent")} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className={cn("text-sm truncate", m.unread && "font-semibold")}>{m.from}</span>
                <span className="text-xs text-muted-foreground shrink-0">{m.time}</span>
              </div>
              <p className="text-sm truncate">{m.subject}</p>
              <p className="text-xs text-muted-foreground truncate">{m.preview}</p>
            </div>
            <Send className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
