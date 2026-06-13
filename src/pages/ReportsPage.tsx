import { AppLayout } from "@/components/layout/AppLayout";
import { ReportGenerator } from "@/components/reports/ReportGenerator";
import { useTranslation } from "@/i18n/LanguageProvider";

export default function ReportsPage() {
  const { t } = useTranslation();
  return (
    <AppLayout title={t("reports.title")}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t("reports.title")}</h2>
          <p className="text-muted-foreground">
            {t("reports.subtitle")}
          </p>
        </div>

        {/* Report Generator */}
        <ReportGenerator />
      </div>
    </AppLayout>
  );
}
