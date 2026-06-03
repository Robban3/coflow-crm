import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Granularity, PeriodPreset } from "@/pages/StatisticsPage";

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
          <SelectItem value="today">Idag</SelectItem>
          <SelectItem value="yesterday">Igår</SelectItem>
          <SelectItem value="last_7_days">Senaste 7 dagar</SelectItem>
          <SelectItem value="last_30_days">Senaste 30 dagar</SelectItem>
          <SelectItem value="this_week">Denna vecka</SelectItem>
          <SelectItem value="last_week">Förra veckan</SelectItem>
          <SelectItem value="this_month">Denna månad</SelectItem>
          <SelectItem value="last_month">Förra månaden</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
