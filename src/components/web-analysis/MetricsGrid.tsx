import { PageSpeedMetrics, webAnalysisApi } from "@/lib/api/webAnalysis";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n/LanguageProvider";

interface MetricItem {
  label: string;
  value: number;
  description: string;
  isCls?: boolean;
  thresholds: { good: number; poor: number };
}

interface MetricsGridProps {
  metrics: PageSpeedMetrics;
  compact?: boolean;
}

export function MetricsGrid({ metrics, compact = false }: MetricsGridProps) {
  const { t } = useTranslation();
  const metricItems: MetricItem[] = [
    {
      label: "First Contentful Paint (FCP)",
      value: metrics.firstContentfulPaint,
      description: t("webAnalysis.metricFcpDesc"),
      thresholds: { good: 1800, poor: 3000 }
    },
    {
      label: "Largest Contentful Paint (LCP)",
      value: metrics.largestContentfulPaint,
      description: t("webAnalysis.metricLcpDesc"),
      thresholds: { good: 2500, poor: 4000 }
    },
    {
      label: "Speed Index",
      value: metrics.speedIndex,
      description: t("webAnalysis.metricSpeedIndexDesc"),
      thresholds: { good: 3400, poor: 5800 }
    },
    {
      label: "Total Blocking Time (TBT)",
      value: metrics.totalBlockingTime,
      description: t("webAnalysis.metricTbtDesc"),
      thresholds: { good: 200, poor: 600 }
    },
    {
      label: "Time to Interactive (TTI)",
      value: metrics.timeToInteractive,
      description: t("webAnalysis.metricTtiDesc"),
      thresholds: { good: 3800, poor: 7300 }
    },
    {
      label: "Cumulative Layout Shift (CLS)",
      value: metrics.cumulativeLayoutShift,
      description: t("webAnalysis.metricClsDesc"),
      isCls: true,
      thresholds: { good: 0.1, poor: 0.25 }
    },
  ];

  const getMetricColor = (value: number, thresholds: { good: number; poor: number }, isCls?: boolean) => {
    // For CLS, lower is better
    if (isCls) {
      if (value <= thresholds.good) return "text-green-600 dark:text-green-400";
      if (value <= thresholds.poor) return "text-yellow-600 dark:text-yellow-400";
      return "text-red-600 dark:text-red-400";
    }
    // For time-based metrics, lower is better
    if (value <= thresholds.good) return "text-green-600 dark:text-green-400";
    if (value <= thresholds.poor) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getMetricBg = (value: number, thresholds: { good: number; poor: number }, isCls?: boolean) => {
    if (isCls) {
      if (value <= thresholds.good) return "bg-green-50 dark:bg-green-900/20";
      if (value <= thresholds.poor) return "bg-yellow-50 dark:bg-yellow-900/20";
      return "bg-red-50 dark:bg-red-900/20";
    }
    if (value <= thresholds.good) return "bg-green-50 dark:bg-green-900/20";
    if (value <= thresholds.poor) return "bg-yellow-50 dark:bg-yellow-900/20";
    return "bg-red-50 dark:bg-red-900/20";
  };

  return (
    <div className={cn("grid gap-4", compact ? "grid-cols-2 md:grid-cols-3" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3")}>
      {metricItems.map((metric) => (
        <div 
          key={metric.label} 
          className={cn(
            "p-4 rounded-lg border transition-colors",
            getMetricBg(metric.value, metric.thresholds, metric.isCls)
          )}
        >
          <p className="text-sm text-muted-foreground font-medium">{metric.label}</p>
          <p className={cn("text-2xl font-bold", getMetricColor(metric.value, metric.thresholds, metric.isCls))}>
            {metric.isCls 
              ? metric.value.toFixed(3) 
              : webAnalysisApi.formatTime(metric.value)}
          </p>
          {!compact && (
            <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}
