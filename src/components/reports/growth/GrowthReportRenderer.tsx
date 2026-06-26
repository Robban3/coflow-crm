import { useTranslation } from "@/i18n/LanguageProvider";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertCircle,
  AlertTriangle,
  Circle,
  ChevronDown,
  ArrowRight,
  Calendar,
  Globe,
  Zap,
  Target,
  Clock,
  CheckCircle2,
  TrendingUp,
  BarChart3,
  Search,
  Eye,
  FileText as PackageIcon,
  Phone,
  Mail,
  ExternalLink,
  Loader2,
  Sparkles,
  Monitor,
} from "lucide-react";
import type { GrowthReportData, GeoFinding, GeoAction } from "./types";
import { DEFAULT_PACKAGE_BULLETS, TIER_FIT_LABELS } from "./types";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { ReportBookingDialog } from "../ReportBookingDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";

interface Props {
  data: GrowthReportData;
  publicMode?: boolean;
  reportId?: string;
  leadId?: string | null;
  onCtaClick?: (name: string) => void;
  onPdfClick?: () => void;
  onShareClick?: () => void;
}

/* ─── Helpers ─── */

const formatPrice = (amount: number): string => {
  const str = amount.toLocaleString("sv-SE");
  // Replace regular space with thin space for thousands separator
  return str.replace(/\s/g, "\u2009");
};

const scoreColor = (v: number | null) => {
  if (v === null) return "text-muted-foreground";
  if (v >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (v >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
};

const scoreRingColor = (v: number | null) => {
  if (v === null) return "stroke-muted-foreground/30";
  if (v >= 80) return "stroke-emerald-500";
  if (v >= 50) return "stroke-amber-500";
  return "stroke-red-500";
};

const scoreBg = (v: number | null) => {
  if (v === null) return "bg-muted/30";
  if (v >= 80) return "bg-emerald-500/8 dark:bg-emerald-500/10";
  if (v >= 50) return "bg-amber-500/8 dark:bg-amber-500/10";
  return "bg-red-500/8 dark:bg-red-500/10";
};

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const buildSeverityConfig = (t: TranslateFn): Record<string, { label: string; color: string; icon: typeof AlertCircle; bgClass: string }> => ({
  high: { label: t("reports.renderer.severityHigh"), color: "text-red-600 dark:text-red-400", icon: AlertCircle, bgClass: "bg-red-500/8 border-red-500/15 dark:bg-red-500/10 dark:border-red-500/20" },
  medium: { label: t("reports.renderer.severityMedium"), color: "text-amber-600 dark:text-amber-400", icon: AlertTriangle, bgClass: "bg-amber-500/8 border-amber-500/15 dark:bg-amber-500/10 dark:border-amber-500/20" },
  low: { label: t("reports.renderer.severityLow"), color: "text-blue-600 dark:text-blue-400", icon: Circle, bgClass: "bg-blue-500/8 border-blue-500/15 dark:bg-blue-500/10 dark:border-blue-500/20" },
});

const buildPriorityConfig = (t: TranslateFn): Record<string, { label: string; timeline: string; icon: typeof Zap }> => ({
  quick_win: { label: t("reports.renderer.priorityQuickWin"), timeline: "0–30 dagar", icon: Zap },
  medium: { label: t("reports.renderer.priorityMedium"), timeline: t("reports.renderer.timelineMedium"), icon: Target },
  long_term: { label: t("reports.renderer.priorityLongTerm"), timeline: t("reports.renderer.timelineLongTerm"), icon: Clock },
});

const buildTierLabels = (t: TranslateFn): Record<string, string> => ({
  start: "Start",
  growth: t("reports.pricing.growth"),
  dominate: "Dominate",
});

/* ─── Score Ring SVG ─── */

function ScoreRing({ value, size = 72 }: { value: number | null; size?: number }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value !== null ? Math.min(value / 100, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className="stroke-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className={`${scoreRingColor(value)} transition-all duration-1000`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-bold tracking-tight ${scoreColor(value)}`}>{value ?? "–"}</span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">{children}</p>;
}

function SectionDivider() {
  return <div className="h-px bg-border/50 my-10 growth-report-divider" />;
}

/* ─── Main Renderer ─── */

export function GrowthReportRenderer({ data, publicMode, reportId, leadId, onCtaClick, onPdfClick, onShareClick }: Props) {
  const { t } = useTranslation();
  const severityConfig = buildSeverityConfig(t);
  const priorityConfig = buildPriorityConfig(t);
  const tierLabels = buildTierLabels(t);
  const [techOpen, setTechOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [expandedTier, setExpandedTier] = useState<string | null>(null);
  const [orderModal, setOrderModal] = useState<{
    open: boolean;
    tier?: "start" | "growth" | "dominate";
    includeWebsite?: boolean;
  }>({ open: false });

  const createdDate = data.created_at
    ? format(new Date(data.created_at), "d MMMM yyyy", { locale: sv })
    : null;

  const webScore = data.web?.performance_score ?? null;
  const seoScore = data.seo?.visibility_score ?? data.web?.seo_score ?? null;
  const geoScore = data.geo?.geo_score ?? null;

  const handleBook = () => setBookingOpen(true);

  // Build roadmap from GEO actions
  const roadmapGroups: { priority: string; items: GeoAction[] }[] = [];
  if (data.geo?.actions) {
    const grouped: Record<string, GeoAction[]> = { quick_win: [], medium: [], long_term: [] };
    for (const a of data.geo.actions) {
      const key = a.priority in grouped ? a.priority : "medium";
      grouped[key].push(a);
    }
    for (const key of ["quick_win", "medium", "long_term"]) {
      if (grouped[key].length > 0) {
        roadmapGroups.push({ priority: key, items: grouped[key] });
      }
    }
  }

  const selectedPkg = data.package_config?.selected || data.recommended_package;
  const pkgBullets = data.package_config?.bullets || DEFAULT_PACKAGE_BULLETS;
  const p = data.ai_visibility_pricing;

  // Website section shown only when web performance is genuinely poor
  // Website section shown when web performance is poor OR always when upsell is enabled
  const showWebsiteSection = p?.show_website_upsell !== false && webScore !== null && webScore < 75;

  const tierPrices: Record<string, number> = p ? {
    start: p.start_monthly,
    growth: p.growth_monthly,
    dominate: p.dominate_monthly,
  } : {};

  return (
    <div className="growth-report-root max-w-[780px] mx-auto px-6 md:px-10 py-8 md:py-14">

      {/* ═══════════ 1. EXECUTIVE OVERVIEW ═══════════ */}
      <header className="growth-report-section mb-10" data-track-section="executive">
        <SectionLabel>{t("reports.growth.reportLabel")}</SectionLabel>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1 leading-tight">
          {data.company.name}
        </h1>
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {data.company.domain && (
            <span className="flex items-center gap-1"><Globe className="h-3 w-3" />{data.company.domain}</span>
          )}
          {createdDate && (
            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{createdDate}</span>
          )}
        </div>

        {/* Three score badges */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-8">
          <ScoreBadge label={t("reports.growth.webPerformance")} score={webScore} icon={<BarChart3 className="h-3.5 w-3.5" />} />
          <ScoreBadge label={t("reports.generator.typeSeo")} score={seoScore} icon={<Search className="h-3.5 w-3.5" />} />
          <ScoreBadge label={t("reports.growth.aiVisibility")} score={geoScore} icon={<Eye className="h-3.5 w-3.5" />} />
        </div>

        {/* Executive summary */}
        {data.geo?.summary && (
          <div className="mt-8 text-sm leading-[1.8] text-foreground/90">
            {data.geo.summary}
          </div>
        )}
      </header>

      <SectionDivider />

      {/* ═══════════ 2. NULÄGE ═══════════ */}
      <section className="growth-report-section" data-track-section="nuläge">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />{t("reports.growth.currentState")}</h2>

        <div className="space-y-6">
          {data.included_modules.web && data.web && (
            <ModuleCard
              title={t("reports.growth.webPerformance")}
              icon={<BarChart3 className="h-4 w-4 text-primary/70" />}
              score={data.web.performance_score}
            >
              <div className="grid grid-cols-2 gap-3 mt-3">
                <MiniScore label={t("reports.growth.performance")} value={data.web.performance_score} />
                <MiniScore label={t("reports.generator.typeSeo")} value={data.web.seo_score} />
                <MiniScore label={t("reports.growth.accessibility")} value={data.web.accessibility_score} />
                <MiniScore label={t("reports.growth.bestPractices")} value={data.web.best_practices_score} />
              </div>
              {data.web.performance_score !== null && data.web.performance_score < 70 && (
                <div className="mt-3">
                  <SectionLabel>{t("reports.growth.whyItMatters")}</SectionLabel>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t("reports.growth.webPerfWhy")}</p>
                </div>
              )}
            </ModuleCard>
          )}

          {data.included_modules.seo && data.seo && (
            <ModuleCard
              title={t("reports.create.seo")}
              icon={<Search className="h-4 w-4 text-primary/70" />}
              score={data.seo.visibility_score ?? null}
            >
              {data.seo.ai_summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">{data.seo.ai_summary}</p>
              )}
              {data.seo.primary_keywords && data.seo.primary_keywords.length > 0 && (
                <div className="mt-3">
                  <SectionLabel>{t("reports.growth.topKeywords")}</SectionLabel>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {data.seo.primary_keywords.slice(0, 8).map((kw, i) => (
                      <Badge key={i} variant="outline" className="text-[10px] font-normal">
                        {kw.keyword} <span className="text-muted-foreground ml-1">#{kw.position}</span>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </ModuleCard>
          )}

          {data.included_modules.geo && data.geo && (
            <ModuleCard
              title={t("reports.create.geo")}
              icon={<Eye className="h-4 w-4 text-primary/70" />}
              score={data.geo.geo_score}
            >
              {data.geo.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-2">
                  {data.geo.summary.length > 300 ? data.geo.summary.slice(0, 300) + "…" : data.geo.summary}
                </p>
              )}
              {data.geo.findings.length > 0 && (
                <div className="mt-3">
                  <SectionLabel>{t("reports.growth.keyFindings")}</SectionLabel>
                  <div className="space-y-1.5 mt-1">
                    {data.geo.findings
                      .sort((a, b) => {
                        const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
                        return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
                      })
                      .slice(0, 3)
                      .map((f, i) => {
                        const cfg = severityConfig[f.severity] || severityConfig.low;
                        return (
                          <div key={i} className="flex items-start gap-2 text-xs">
                            <cfg.icon className={`h-3 w-3 mt-0.5 shrink-0 ${cfg.color}`} />
                            <span className="text-foreground/80">{f.title}</span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </ModuleCard>
          )}
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ 3. STÖRSTA TILLVÄXTHINDRET ═══════════ */}
      <section className="growth-report-section" data-track-section="barrier">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-red-500/60 shrink-0" />{t("reports.growth.biggestBarrier")}</h2>
        <div className="rounded-xl border border-red-500/15 bg-red-500/5 dark:bg-red-500/8 p-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">{data.biggest_barrier.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{data.biggest_barrier.description}</p>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ 4. ROADMAP ═══════════ */}
      {roadmapGroups.length > 0 && (
        <section className="growth-report-section" data-track-section="roadmap">
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-6 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />{t("reports.growth.actionPlan")}</h2>
          <div className="space-y-8">
            {roadmapGroups.map((g, gi) => {
              const cfg = priorityConfig[g.priority] || priorityConfig.medium;
              const Icon = cfg.icon;
              return (
                <div key={g.priority} className="relative">
                  {gi < roadmapGroups.length - 1 && (
                    <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border print:bg-gray-200" />
                  )}
                  <div className="flex items-start gap-4">
                    <div className="relative z-10 flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border bg-card">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0 pb-6">
                      <div className="flex items-baseline gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground">{cfg.label}</h4>
                        <span className="text-[10px] text-muted-foreground">{cfg.timeline}</span>
                      </div>
                      <div className="space-y-3 mt-3">
                        {g.items.map((a, i) => (
                          <div key={i} className="rounded-xl border bg-card/50 p-4">
                            <div className="flex items-start gap-3">
                              <CheckCircle2 className="h-4 w-4 text-primary/50 shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-foreground">{a.title}</p>
                                {a.steps && (
                                  <div className="mt-1.5">
                                    <SectionLabel>{t("reports.renderer.whatToDo")}</SectionLabel>
                                    <p className="text-xs text-muted-foreground leading-relaxed">{a.steps}</p>
                                  </div>
                                )}
                                {a.estimated_impact && (
                                  <div className="mt-2">
                                    <SectionLabel>{t("reports.renderer.impact")}</SectionLabel><span className="text-xs font-medium text-foreground">{a.estimated_impact}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <SectionDivider />

      {/* ═══════════ 5. BRIDGE — t("reports.growth.bridgeTitle") ═══════════ */}
      <section className="growth-report-section" data-track-section="bridge">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4 flex items-center gap-2">
          <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />{t("reports.growth.bridgeTitle")}</h2>
        <div className="space-y-3 text-sm text-foreground/85 leading-relaxed max-w-[640px]">
          <p>{t("reports.growth.bridgeP1", { barrier: data.biggest_barrier.title.toLowerCase() })}</p>
          <p>{t("reports.growth.bridgeP2")}</p>
          <p>{t("reports.growth.bridgeP3")}</p>
        </div>
      </section>

      <SectionDivider />

      {/* ═══════════ 6. REKOMMENDERAD VÄG FRAMÅT ═══════════ */}
      {p && (
        <section className="growth-report-section" data-track-section="pricing">
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-2 flex items-center gap-2">
            <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />{t("reports.growth.recommendedPath")}</h2>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed max-w-[600px]">{t("reports.growth.recommendedPathDesc")}</p>

          {/* ── Recommended package (primary) ── */}
          {(() => {
            const recTier = selectedPkg;
            const recPrice = tierPrices[recTier];
            const recBullets = pkgBullets[recTier] || DEFAULT_PACKAGE_BULLETS[recTier];
            const isExpanded = expandedTier === recTier;

            // Contextual "why" based on scores
            const whyLines: string[] = [];
            if (geoScore !== null && geoScore < 60) whyLines.push(t("reports.growth.whyGeo"));
            if (seoScore !== null && seoScore < 60) whyLines.push(t("reports.growth.whySeo"));
            if (webScore !== null && webScore < 60) whyLines.push(t("reports.growth.whyWeb"));
            if (whyLines.length === 0) whyLines.push(t("reports.growth.whyDefault"));

            return (
              <div className="rounded-xl border border-primary/25 bg-primary/[0.02] dark:bg-primary/[0.04] p-6 sm:p-7 mb-6">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-2 py-0.5">{t("reports.growth.recommended")}</Badge>
                </div>
                <h3 className="text-base font-semibold text-foreground mt-2">
                  AI-synlighet – {tierLabels[recTier]}
                </h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed max-w-[540px]">
                  {whyLines[0]}
                  {whyLines.length > 1 && ` ${whyLines[1]}`}
                </p>
                <p className="text-xs text-muted-foreground/80 mt-3">
                  <TrendingUp className="inline h-3 w-3 mr-1 -mt-0.5" />{t("reports.growth.expectedEffect90")}</p>

                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-4 text-xs text-primary hover:text-primary/80"
                  onClick={() => setExpandedTier(isExpanded ? null : recTier)}
                >
                  {isExpanded ? t("reports.growth.hideSetupPrice") : t("reports.growth.showSetupPrice")}
                  <ChevronDown className={`ml-1 h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </Button>

                {isExpanded && (
                  <div className="mt-5 pt-5 border-t border-border/40 space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-200">
                    {/* What's included */}
                    <div>
                      <SectionLabel>{t("reports.growth.whatsIncluded")}</SectionLabel>
                      <ul className="space-y-2 mt-2">
                        {recBullets.map((b, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                            <CheckCircle2 className="h-3 w-3 text-primary/50 shrink-0 mt-0.5" />
                            {b}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* How it works */}
                    <div>
                      <SectionLabel>{t("reports.growth.howItWorks")}</SectionLabel>
                      <div className="space-y-1.5 mt-2">
                        {[
                          t("reports.growth.howStep1"),
                          t("reports.growth.howStep2"),
                          t("reports.growth.howStep3"),
                        ].map((step, i) => (
                          <p key={i} className="text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
                            <span className="text-[10px] font-medium text-foreground/60 mt-px shrink-0">{i + 1}.</span>
                            {step}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Expected effect */}
                    <div>
                      <SectionLabel>{t("reports.growth.expectedEffect")}</SectionLabel>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{t("reports.growth.expectedEffectDesc")}</p>
                    </div>

                    {/* Price – last, subtle */}
                    <div className="rounded-lg bg-muted/30 dark:bg-muted/10 px-4 py-3">
                      <p className="text-sm text-foreground">{t("reports.growth.from")}<span className="font-semibold">{formatPrice(recPrice)} kr</span>
                        <span className="text-xs text-muted-foreground ml-1">{p.billing_period_label}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{t("reports.growth.cancelAnytimeVat")}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── Alternative tiers ── */}
          <div className="grid gap-3 sm:grid-cols-2">
            {(["start", "growth", "dominate"] as const)
              .filter((t) => t !== selectedPkg)
              .map((tier) => {
                const price = tierPrices[tier];
                const bullets = pkgBullets[tier] || DEFAULT_PACKAGE_BULLETS[tier];
                const isExpanded = expandedTier === tier;

                return (
                  <div key={tier} className="rounded-xl border border-border/50 bg-card/30 p-5">
                    <p className="text-[10px] font-medium tracking-wide uppercase text-muted-foreground mb-1">{t("reports.growth.alternativeLevel")}</p>
                    <h4 className="text-sm font-semibold text-foreground">{tierLabels[tier]}</h4>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                      {TIER_FIT_LABELS[tier]}
                    </p>

                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-3 text-[11px] text-muted-foreground hover:text-foreground px-0"
                      onClick={() => setExpandedTier(isExpanded ? null : tier)}
                    >
                      {isExpanded ? t("reports.growth.hide") : t("reports.growth.showSetupPrice")}
                      <ChevronDown className={`ml-1 h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </Button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-border/30 space-y-3 animate-in fade-in-0 duration-150">
                        <ul className="space-y-1.5">
                          {bullets.map((b, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed">
                              <CheckCircle2 className="h-3 w-3 text-primary/40 shrink-0 mt-0.5" />
                              {b}
                            </li>
                          ))}
                        </ul>
                        <div className="rounded-lg bg-muted/20 px-3 py-2">
                          <p className="text-sm text-foreground">{t("reports.growth.from")}<span className="font-semibold">{formatPrice(price)} kr</span>
                            <span className="text-xs text-muted-foreground ml-1">{p.billing_period_label}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{t("reports.growth.cancelAnytimeVatShort")}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      )}

      {/* ═══════════ 7. HEMSIDA — PRIMÄR REKOMMENDATION ═══════════ */}
      {showWebsiteSection && p && (
        <>
          <SectionDivider />
          <section className="growth-report-section" data-track-section="website">
            <h2 className="text-lg font-semibold tracking-tight text-foreground mb-4 flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />{t("reports.growth.websiteTitle")}</h2>
            <div className="rounded-xl border border-primary/25 bg-primary/[0.02] dark:bg-primary/[0.04] p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20 px-2 py-0.5 mb-2">{t("reports.growth.stronglyRecommended")}</Badge>
                  <p className="text-sm text-foreground/90 leading-relaxed">{t("reports.growth.websiteDescPrefix")}<span className="font-semibold">{webScore}/100</span>{t("reports.growth.websiteDescSuffix")}</p>
                  <div className="mt-4 rounded-lg bg-muted/30 dark:bg-muted/10 px-4 py-3">
                    <p className="text-sm text-foreground">{t("reports.growth.from")}<span className="font-semibold">{formatPrice(p.website_rebuild_from)} kr</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{t("reports.growth.websitePriceNote")}</p>
                  </div>
                  {data.contact?.booking_url && (
                    <p className="text-xs text-muted-foreground mt-3">
                      <a
                        href={data.contact.booking_url}
                        onClick={() => onCtaClick?.("website_discuss")}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline underline-offset-2 hover:text-foreground transition-colors"
                      >{t("reports.growth.websiteDiscuss")}</a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}

      <SectionDivider />

      {/* ═══════════ 8. SLUT-CTA — TRYGG KONVERTERING ═══════════ */}
      <section className="growth-report-section growth-report-cta py-4" data-track-section="next_steps">
        <div className="max-w-[560px] mx-auto text-center">
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-3">{t("reports.growth.finalCtaTitle")}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-8">{t("reports.growth.finalCtaDesc")}</p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {data.contact?.booking_url ? (
              <Button size="lg" className="rounded-xl" asChild onClick={() => onCtaClick?.("book")}>
                <a href={data.contact.booking_url} target="_blank" rel="noopener noreferrer">
                  <Calendar className="mr-2 h-4 w-4" />{t("reports.growth.getPlan")}<ExternalLink className="ml-1.5 h-3 w-3" />
                </a>
              </Button>
            ) : (
              <Button size="lg" className="rounded-xl" onClick={() => { onCtaClick?.("book"); handleBook(); }}>
                <Calendar className="mr-2 h-4 w-4" />{t("reports.growth.getPlan")}</Button>
            )}
            {publicMode && data.contact?.email && (
              <Button variant="outline" size="lg" className="rounded-xl" asChild onClick={() => onCtaClick?.("send_report_as_offer")}>
                <a href={`mailto:${data.contact.email}?subject=Rapport som offertunderlag – ${data.company.name}`}>
                  <Mail className="mr-2 h-4 w-4" />{t("reports.growth.sendAsOffer")}</a>
              </Button>
            )}
          </div>

          {data.contact && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 mt-8 text-xs text-muted-foreground">
              {data.contact.email && (
                <span className="flex items-center gap-1">
                  <Mail className="h-3 w-3" /> {data.contact.email}
                </span>
              )}
              {data.contact.phone && (
                <span className="flex items-center gap-1">
                  <Phone className="h-3 w-3" /> {data.contact.phone}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ─── TECHNICAL APPENDIX ─── */}
      <div className="mt-12">
        <Collapsible open={techOpen} onOpenChange={setTechOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${techOpen ? "rotate-180" : ""}`} />
            <span className="font-medium">{t("reports.renderer.techAppendix")}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="rounded-xl border bg-muted/20 p-5 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>{t("reports.growth.techDataNote")}</p>
              {data.included_modules.web && <p>{t("reports.growth.techWeb")}</p>}
              {data.included_modules.geo && <p>{t("reports.growth.techGeo")}</p>}
              {data.included_modules.seo && <p>{t("reports.growth.techSeo")}</p>}
              <p>Genererad: {new Date(data.created_at).toLocaleString("sv-SE")}</p>
            </div>

            {data.geo && data.geo.findings.length > 0 && (
              <div className="mt-6 space-y-3">
                <h4 className="text-xs font-semibold text-foreground">Alla GEO-fynd ({data.geo.findings.length})</h4>
                {data.geo.findings.map((f, i) => {
                  const cfg = severityConfig[f.severity] || severityConfig.low;
                  return (
                    <div key={i} className={`rounded-xl border p-4 ${cfg.bgClass}`}>
                      <div className="flex items-start gap-2">
                        <cfg.icon className={`h-3 w-3 mt-0.5 shrink-0 ${cfg.color}`} />
                        <div className="flex-1 min-w-0">
                          <h5 className="text-xs font-semibold text-foreground">{f.title}</h5>
                          {f.category && <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.category}</span>}
                          {f.description && (
                            <div className="mt-1.5"><SectionLabel>{t("reports.renderer.businessImpact")}</SectionLabel><p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p></div>
                          )}
                          {f.recommendation && (
                            <div className="mt-1.5"><SectionLabel>{t("reports.renderer.recommendedAction")}</SectionLabel><p className="text-xs text-foreground/80 leading-relaxed">{f.recommendation}</p></div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ─── FOOTER ─── */}
      {publicMode && (
        <footer className="mt-14 pt-6 border-t border-border/30 text-center growth-report-footer">
          <p className="text-[11px] text-muted-foreground">{t("reports.renderer.footerBy")}<span className="font-medium">Kod & Co</span>
          </p>
        </footer>
      )}

      {/* ─── BOOKING DIALOG ─── */}
      <ReportBookingDialog
        open={bookingOpen}
        onOpenChange={setBookingOpen}
        reportId={reportId}
        leadId={leadId}
        companyName={data.company.name}
        domain={data.company.domain}
      />

      {/* ─── ORDER MODAL (CRM users only) ─── */}
      {!publicMode && orderModal.open && (
        <OrderModal
          open={orderModal.open}
          onOpenChange={(open) => setOrderModal((p) => ({ ...p, open }))}
          tier={orderModal.tier || selectedPkg}
          includeWebsite={orderModal.includeWebsite || false}
          pricing={p!}
          tierLabels={tierLabels}
          contact={data.contact}
          companyName={data.company.name}
          leadId={leadId}
          reportId={reportId}
        />
      )}
    </div>
  );
}

/* ═══════════ ORDER MODAL ═══════════ */

function OrderModal({
  open,
  onOpenChange,
  tier,
  includeWebsite,
  pricing,
  tierLabels,
  contact,
  companyName,
  leadId,
  reportId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tier: "start" | "growth" | "dominate";
  includeWebsite: boolean;
  pricing: NonNullable<GrowthReportData["ai_visibility_pricing"]>;
  tierLabels: Record<string, string>;
  contact?: GrowthReportData["contact"];
  companyName: string;
  leadId?: string | null;
  reportId?: string;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [addWebsite, setAddWebsite] = useState(includeWebsite);
  const [isCreating, setIsCreating] = useState(false);
  const [createdOfferId, setCreatedOfferId] = useState<string | null>(null);

  const tierPrice = tier === "start" ? pricing.start_monthly : tier === "growth" ? pricing.growth_monthly : pricing.dominate_monthly;

  const handleCreateOffer = async () => {
    if (!leadId) {
      toast({ title: t("reports.order.noLead"), description: t("reports.order.noLeadDesc"), variant: "destructive" });
      return;
    }
    setIsCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error(t("reports.order.notLoggedIn"));

      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", user.id)
        .single();

      const orgId = profile?.organization_id;

      // Create quote
      const { data: quote, error: qErr } = await supabase
        .from("quotes")
        .insert({
          title: `AI-synlighet ${tierLabels[tier]} – ${companyName}`,
          quote_number: `OFF-${Date.now().toString(36).toUpperCase()}`,
          status: "draft",
          lead_id: leadId,
          organization_id: orgId,
          created_by: user.id,
          notes: reportId ? t("reports.order.fromReport", { reportId }) : undefined,
        })
        .select("id")
        .single();

      if (qErr || !quote) throw qErr || new Error(t("reports.order.couldNotCreateQuote"));

      // Add line items
      const items: any[] = [
        {
          quote_id: quote.id,
          description: `AI-synlighet – ${tierLabels[tier]} (SEO + GEO)`,
          quantity: 1,
          unit_price: tierPrice,
          unit: t("reports.order.unitMonth"),
          billing_type: "recurring",
          sort_order: 0,
          vat_rate: 25,
        },
      ];

      if (addWebsite) {
        items.push({
          quote_id: quote.id,
          description: t("reports.order.lineWebsite"),
          quantity: 1,
          unit_price: pricing.website_rebuild_from,
          unit: "st",
          billing_type: "one_time",
          sort_order: 1,
          vat_rate: 25,
        });
      }

      const { error: itemErr } = await supabase
        .from("quote_items")
        .insert(items);

      if (itemErr) throw itemErr;

      setCreatedOfferId(quote.id);
      toast({ title: t("reports.order.created"), description: t("reports.order.createdDesc", { company: companyName }) });
    } catch (err: any) {
      console.error("Create offer error:", err);
      toast({ title: t("reports.generator.error"), description: t("reports.order.createError"), variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  if (createdOfferId) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">{t("reports.order.created")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-6">
{t("reports.order.createdSummary", { company: companyName })}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button asChild>
                <a href={`/quotes`}>{t("reports.order.openQuote")}<ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                </a>
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>{t("reports.generator.close")}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("reports.order.title")}</DialogTitle>
          <DialogDescription>
{t("reports.order.desc", { company: companyName })}
          </DialogDescription>
        </DialogHeader>

        {/* Selected package summary */}
        <div className="rounded-xl border bg-primary/[0.03] p-4 mt-2">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">
                AI-synlighet – {tierLabels[tier]}
              </p>
              <p className="text-xs text-muted-foreground">{t("reports.order.monthlyService")}</p>
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatPrice(tierPrice)} kr<span className="text-xs font-normal text-muted-foreground"> {pricing.billing_period_label}</span>
            </p>
          </div>
        </div>

        {/* Website add-on toggle */}
        {pricing.show_website_upsell && (
          <div className="rounded-xl border p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Monitor className="h-4 w-4 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">{t("reports.pricing.websiteHeading")}</p>
                <p className="text-xs text-muted-foreground">{t("reports.order.websiteAddonFrom", { price: formatPrice(pricing.website_rebuild_from) })}</p>
              </div>
            </div>
            <Button
              variant={addWebsite ? "default" : "outline"}
              size="sm"
              className="shrink-0"
              onClick={() => setAddWebsite(!addWebsite)}
            >
              {addWebsite ? "Tillagd ✓" : t("reports.order.add")}
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-3 mt-4">
          {contact?.booking_url && (
            <Button size="lg" className="rounded-xl w-full" asChild>
              <a href={contact.booking_url} target="_blank" rel="noopener noreferrer">
                <Calendar className="mr-2 h-4 w-4" />{t("reports.order.bookMeeting")}<ExternalLink className="ml-1.5 h-3 w-3" />
              </a>
            </Button>
          )}

          <Button
            variant={contact?.booking_url ? "outline" : "default"}
            size="lg"
            className="rounded-xl w-full"
            onClick={handleCreateOffer}
            disabled={isCreating}
          >
            {isCreating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <PackageIcon className="mr-2 h-4 w-4" />
            )}
            Skapa offert som utkast
          </Button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center mt-2">{t("reports.order.draftNote")}</p>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Sub-components ─── */

function ScoreBadge({ label, score, icon }: { label: string; score: number | null; icon: React.ReactNode }) {
  return (
    <div className={`rounded-xl border p-4 text-center ${scoreBg(score)}`}>
      <div className="flex items-center justify-center gap-1.5 mb-2 text-muted-foreground">
        {icon}
        <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      <ScoreRing value={score} size={64} />
    </div>
  );
}

function ModuleCard({ title, icon, score, children }: {
  title: string; icon: React.ReactNode; score: number | null; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card/50 p-5">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        </div>
        {score !== null && (
          <span className={`text-sm font-bold ${scoreColor(score)}`}>{score}/100</span>
        )}
      </div>
      {children}
    </div>
  );
}

function MiniScore({ label, value }: { label: string; value: number | null }) {
  return (
    <div className={`rounded-lg p-2.5 text-center ${scoreBg(value)}`}>
      <span className={`text-lg font-bold ${scoreColor(value)}`}>{value ?? "–"}</span>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
