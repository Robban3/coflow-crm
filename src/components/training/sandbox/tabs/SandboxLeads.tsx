import { Plus, Telescope } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton, SandboxButton } from "../sandboxUi";
import { sampleLeads, statusTone } from "../sandboxData";

export function SandboxLeads() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.leads.explain")}</ExplainPanel>

      <div className="flex flex-wrap items-end gap-4">
        <HighlightButton tip={t("training.sandbox.leads.tip")} icon={Telescope}>
          {t("leads.tabFind")}
        </HighlightButton>
        <SandboxButton icon={Plus}>{t("leadGen.addLead")}</SandboxButton>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">{t("leadsList.colCompany")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("leadsList.colContact")}</th>
              <th className="text-left font-medium px-4 py-2.5 hidden md:table-cell">{t("leadsList.colEmail")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("customers.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {sampleLeads.map((l) => (
              <tr key={l.company} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{l.company}</td>
                <td className="px-4 py-3">{l.contact}</td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{l.email}</td>
                <td className="px-4 py-3">
                  <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", statusTone[l.status])}>
                    {l.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
