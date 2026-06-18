import { Search, Download } from "lucide-react";
import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel, HighlightButton, SandboxButton } from "../sandboxUi";
import { prospectingResults } from "../sandboxData";

export function SandboxProspecting() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.prospecting.explain")}</ExplainPanel>

      <div className="flex flex-wrap items-end gap-4">
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm text-muted-foreground min-w-56">
          <Search className="h-4 w-4" />
          {t("training.sandbox.prospecting.searchPlaceholder")}
        </div>
        <HighlightButton tip={t("training.sandbox.prospecting.tip")} icon={Search}>
          {t("training.sandbox.prospecting.search")}
        </HighlightButton>
      </div>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">{t("companyRegistry.colCompany")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("companyRegistry.colCity")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("leadGen.website")}</th>
            </tr>
          </thead>
          <tbody>
            {prospectingResults.map((r) => (
              <tr key={r.company} className="border-t border-border">
                <td className="px-4 py-3 font-medium">{r.company}</td>
                <td className="px-4 py-3 text-muted-foreground">{r.city}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                      r.hasWebsite
                        ? "bg-muted text-muted-foreground"
                        : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    )}
                  >
                    {r.hasWebsite
                      ? t("training.sandbox.prospecting.hasWebsite")
                      : t("training.sandbox.prospecting.noWebsite")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SandboxButton icon={Download}>{t("companyRegistry.importAsLeads")}</SandboxButton>
    </div>
  );
}
