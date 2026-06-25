import { Plus, Send } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { ExplainPanel, HighlightButton, SandboxButton } from "../sandboxUi";
import { useSandboxData } from "../sandboxData";

const kr = (n: number) => `${n.toLocaleString("sv-SE")} kr`;

export function SandboxQuotes() {
  const { t } = useTranslation();
  const { quoteSample } = useSandboxData();
  const total = quoteSample.lines.reduce((sum, l) => sum + l.qty * l.price, 0);

  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.quotes.explain")}</ExplainPanel>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <SandboxButton icon={Plus}>{t("training.sandbox.quotes.new")}</SandboxButton>
        <HighlightButton tip={t("training.sandbox.quotes.tip")} icon={Send}>
          {t("training.sandbox.quotes.send")}
        </HighlightButton>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-muted/30">
          <span className="font-semibold">{quoteSample.number}</span>
          <span className="text-sm text-muted-foreground">{quoteSample.customer}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-5 py-2">{t("training.sandbox.quotes.colDesc")}</th>
              <th className="text-right font-medium px-5 py-2 w-16">{t("training.sandbox.quotes.colQty")}</th>
              <th className="text-right font-medium px-5 py-2 w-32">{t("training.sandbox.quotes.colPrice")}</th>
            </tr>
          </thead>
          <tbody>
            {quoteSample.lines.map((l) => (
              <tr key={l.description} className="border-t border-border">
                <td className="px-5 py-2.5">{l.description}</td>
                <td className="px-5 py-2.5 text-right">{l.qty}</td>
                <td className="px-5 py-2.5 text-right">{kr(l.qty * l.price)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-semibold">
              <td className="px-5 py-3" colSpan={2}>
                {t("training.sandbox.quotes.total")}
              </td>
              <td className="px-5 py-3 text-right">{kr(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
