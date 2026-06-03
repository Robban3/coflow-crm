import { AppLayout } from "@/components/layout/AppLayout";
import { ReportGenerator } from "@/components/reports/ReportGenerator";

export default function ReportsPage() {
  return (
    <AppLayout title="Rapporter">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Rapporter</h2>
          <p className="text-muted-foreground">
            Generera professionella rapporter för dina leads
          </p>
        </div>

        {/* Report Generator */}
        <ReportGenerator />
      </div>
    </AppLayout>
  );
}
