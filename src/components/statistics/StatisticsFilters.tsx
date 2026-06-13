import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Granularity, PeriodPreset } from "@/pages/StatisticsPage";
import { useTranslation } from "@/i18n/LanguageProvider";

interface Props {
  granularity: Granularity;
  onGranularityChange: (g: Granularity) => void;
  periodPreset: PeriodPreset;
  onPeriodPresetChange: (p: PeriodPreset) => void;
}

const PERIOD_GRANULARITY: Record<PeriodPreset, Granularity> = {
  today: "day",
  yesterday: "day",
  last_7_days: "day",
  last_30_days: "day",
  this_week: "day",
  last_week: "day",
  this_month: "week",
  last_month: "week",
  custom: "day",
};

export function StatisticsFilters({ onGranularityChange, periodPreset, onPeriodPresetChange }: Props) {
  const { t } = useTranslation();
  const handlePeriodChange = (p: PeriodPreset) => {
    onPeriodPresetChange(p);
    onGranularityChange(PERIOD_GRANULARITY[p] ?? "day");
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <Select value={periodPreset} onValueChange={(v) => handlePeriodChange(v as PeriodPreset)}>
        <SelectTrigger className="w-[180px] h-9 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="today">{t("statistics.periodToday")}</SelectItem>
          <SelectItem value="yesterday">{t("statistics.periodYesterday")}</SelectItem>
          <SelectItem value="last_7_days">{t("statistics.periodLast7Days")}</SelectItem>
          <SelectItem value="last_30_days">{t("statistics.periodLast30Days")}</SelectItem>
          <SelectItem value="this_week">{t("statistics.periodThisWeek")}</SelectItem>
          <SelectItem value="last_week">{t("statistics.periodLastWeek")}</SelectItem>
          <SelectItem value="this_month">{t("statistics.periodThisMonth")}</SelectItem>
          <SelectItem value="last_month">{t("statistics.periodLastMonth")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
