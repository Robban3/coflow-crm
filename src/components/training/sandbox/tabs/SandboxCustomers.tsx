import { useTranslation } from "@/i18n/LanguageProvider";
import { cn } from "@/lib/utils";
import { ExplainPanel } from "../sandboxUi";
import { sampleCustomers } from "../sandboxData";

export function SandboxCustomers() {
  const { t } = useTranslation();
  return (
    <div className="space-y-5">
      <ExplainPanel>{t("training.sandbox.customers.explain")}</ExplainPanel>

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">{t("customers.colCompany")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("customers.colContact")}</th>
              <th className="text-left font-medium px-4 py-2.5">{t("customers.colStatus")}</th>
            </tr>
          </thead>
          <tbody>
            {sampleCustomers.map((c) => {
              const active = c.status === "Aktiv";
              return (
                <tr key={c.company} className="border-t border-border">
                  <td className="px-4 py-3 font-medium">{c.company}</td>
                  <td className="px-4 py-3">{c.contact}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-block px-2 py-0.5 rounded-full text-xs font-medium",
                        active
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {active ? t("customers.statusActive") : t("customers.statusChurned")}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
