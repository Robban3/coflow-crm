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
} from "lucide-react";
import type { ReportSchema, ReportSection } from "./reportSchema";
import { format } from "date-fns";
import { sv, enUS, es } from "date-fns/locale";
import { ReportBookingDialog } from "./ReportBookingDialog";

interface Props {
  data: ReportSchema;
  publicMode?: boolean;
  reportId?: string;
  leadId?: string | null;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

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

const scoreLabel = (v: number | null, t: TranslateFn) => {
  if (v === null) return t("reports.renderer.scoreNotCalculated");
  if (v >= 80) return t("reports.renderer.scoreStrong");
  if (v >= 50) return t("reports.renderer.scoreGood");
  return t("reports.renderer.scoreLow");
};

const buildSeverityConfig = (t: TranslateFn): Record<string, { label: string; color: string; icon: typeof AlertCircle; bgClass: string }> => ({
  high: {
    label: t("reports.renderer.severityHigh"),
    color: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
    bgClass: "bg-red-500/8 border-red-500/15 dark:bg-red-500/10 dark:border-red-500/20",
  },
  medium: {
    label: t("reports.renderer.severityMedium"),
    color: "text-amber-600 dark:text-amber-400",
    icon: AlertTriangle,
    bgClass: "bg-amber-500/8 border-amber-500/15 dark:bg-amber-500/10 dark:border-amber-500/20",
  },
  low: {
    label: t("reports.renderer.severityLow"),
    color: "text-blue-600 dark:text-blue-400",
    icon: Circle,
    bgClass: "bg-blue-500/8 border-blue-500/15 dark:bg-blue-500/10 dark:border-blue-500/20",
  },
});

const buildPriorityConfig = (t: TranslateFn): Record<string, { label: string; timeline: string; icon: typeof Zap }> => ({
  quick_win: { label: t("reports.renderer.priorityQuickWin"), timeline: t("reports.renderer.timelineQuickWin"), icon: Zap },
  medium: { label: t("reports.renderer.priorityMedium"), timeline: t("reports.renderer.timelineMedium"), icon: Target },
  long_term: { label: t("reports.renderer.priorityLongTerm"), timeline: t("reports.renderer.timelineLongTerm"), icon: Clock },
});

/* ─── Score Ring SVG ──────────────────────────────────────────────────── */

function ScoreRing({ value, max = 100, size = 120 }: { value: number | null; max?: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value !== null ? Math.min(value / max, 1) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
          className="stroke-muted/20" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset}
          className={`${scoreRingColor(value)} transition-all duration-1000`} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-bold tracking-tight ${scoreColor(value)}`}>
          {value ?? "–"}
        </span>
        <span className="text-[10px] text-muted-foreground tracking-wide">/ {max}</span>
      </div>
    </div>
  );
}

/* ─── Section Label ──────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-1">
      {children}
    </p>
  );
}

/* ─── Section Renderers ──────────────────────────────────────────────── */

function SummarySection({ content }: { content: any }) {
  const { t } = useTranslation();
  return (
    <div className="report-section">
      <SectionLabel>{t("reports.renderer.executiveSummary")}</SectionLabel>
      <div className="mt-3 text-sm leading-[1.8] text-foreground/90">
        {content.text}
      </div>
    </div>
  );
}

function ScorecardsSection({ content }: { content: any }) {
  // Not used as standalone anymore – score is in the header
  return null;
}

function FindingsSection({ content }: { content: any }) {
  const { t } = useTranslation();
  const severityConfig = buildSeverityConfig(t);
  const items: any[] = content.items || [];

  // Group by severity
  const groups = [
    { key: "high", items: items.filter((f) => f.severity === "high") },
    { key: "medium", items: items.filter((f) => f.severity === "medium") },
    { key: "low", items: items.filter((f) => f.severity !== "high" && f.severity !== "medium") },
  ].filter((g) => g.items.length > 0);

  return (
    <div className="space-y-6 report-section">
      {groups.map((group) => {
        const cfg = severityConfig[group.key] || severityConfig.low;
        const Icon = cfg.icon;
        return (
          <div key={group.key}>
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-3.5 w-3.5 ${cfg.color}`} />
              <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
              <span className="text-[10px] text-muted-foreground">({group.items.length})</span>
            </div>
            <div className="space-y-3">
              {group.items.map((f: any, i: number) => (
                <div key={i} className={`rounded-xl border p-5 ${cfg.bgClass}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground">{f.title}</h4>
                      {f.category && (
                        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{f.category}</span>
                      )}
                      {f.description && (
                        <div className="mt-2">
                          <SectionLabel>{t("reports.renderer.businessImpact")}</SectionLabel>
                          <p className="text-xs text-muted-foreground leading-relaxed">{f.description}</p>
                        </div>
                      )}
                      {f.recommendation && (
                        <div className="mt-2">
                          <SectionLabel>{t("reports.renderer.recommendedAction")}</SectionLabel>
                          <p className="text-xs text-foreground/80 leading-relaxed">{f.recommendation}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActionsSection({ content }: { content: any }) {
  const { t } = useTranslation();
  const priorityConfig = buildPriorityConfig(t);
  const groups: any[] = content.groups || [];
  const orderedKeys = ["quick_win", "medium", "long_term"];
  const sorted = [...groups].sort(
    (a, b) => orderedKeys.indexOf(a.priority) - orderedKeys.indexOf(b.priority)
  );

  return (
    <div className="space-y-8 report-section">
      {sorted.map((g: any, gi: number) => {
        const cfg = priorityConfig[g.priority] || priorityConfig.medium;
        const Icon = cfg.icon;
        return (
          <div key={g.priority} className="relative">
            {/* Timeline connector */}
            {gi < sorted.length - 1 && (
              <div className="absolute left-[15px] top-[40px] bottom-0 w-px bg-border print:bg-gray-200" />
            )}
            <div className="flex items-start gap-4">
              {/* Step circle */}
              <div className="relative z-10 flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full border bg-card">
                <Icon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0 pb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <h4 className="text-sm font-semibold text-foreground">{cfg.label}</h4>
                  <span className="text-[10px] text-muted-foreground">{cfg.timeline}</span>
                </div>
                <div className="space-y-3 mt-3">
                  {g.items.map((a: any, i: number) => (
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
                          <div className="flex gap-6 mt-2">
                            {a.estimated_impact && (
                              <div>
                                <SectionLabel>{t("reports.renderer.impact")}</SectionLabel>
                                <span className="text-xs font-medium text-foreground">{a.estimated_impact}</span>
                              </div>
                            )}
                            {a.estimated_effort && (
                              <div>
                                <SectionLabel>{t("reports.renderer.effort")}</SectionLabel>
                                <span className="text-xs font-medium text-foreground">{a.estimated_effort}</span>
                              </div>
                            )}
                          </div>
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
  );
}

function CtaSection({ content, onBook }: { content: any; onBook?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl border bg-primary/5 p-8 md:p-10 text-center report-section report-cta">
      <h3 className="text-lg font-semibold mb-2 text-foreground">{content.heading}</h3>
      <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto leading-relaxed">
        {content.description}
      </p>
      <Button size="lg" className="rounded-xl" onClick={onBook}>
        {content.buttonText || t("reports.renderer.contactUs")}
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}

function TextSection({ content }: { content: any }) {
  return (
    <div className="text-sm text-muted-foreground leading-relaxed report-section">
      {content.text}
    </div>
  );
}

function renderSection(section: ReportSection, t: TranslateFn, onBook?: () => void) {
  switch (section.type) {
    case "summary":
      return <SummarySection content={section.content} />;
    case "scorecards":
      return <ScorecardsSection content={section.content} />;
    case "actions":
      return <ActionsSection content={section.content} />;
    case "findings":
      return <FindingsSection content={section.content} />;
    case "cta":
      return <CtaSection content={section.content} onBook={onBook} />;
    case "text":
      return <TextSection content={section.content} />;
    default:
      return <TextSection content={{ text: t("reports.renderer.unknownSectionType", { type: section.type }) }} />;
  }
}

/* ─── Main Renderer ──────────────────────────────────────────────────── */

export function ReportRenderer({ data, publicMode, reportId, leadId }: Props) {
  const { t, language } = useTranslation();
  const dateLocale = language === "en" ? enUS : language === "es" ? es : sv;
  const numberLocale = language === "en" ? "en-US" : language === "es" ? "es-ES" : "sv-SE";
  const [techOpen, setTechOpen] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const geoScore = data.meta.scores?.geo ?? null;
  const createdDate = data.meta.createdAt
    ? format(new Date(data.meta.createdAt), "d MMMM yyyy", { locale: dateLocale })
    : null;

  // Split sections
  const mainSections = data.sections.filter(
    (s) => s.type !== "cta" && s.id !== "scores"
  );
  const ctaSection = data.sections.find((s) => s.type === "cta");

  const handleBook = () => setBookingOpen(true);

  return (
    <div className="report-root max-w-[750px] mx-auto px-6 md:px-10 py-8 md:py-14">

      {/* ─── HEADER / COVER ─── */}
      <header className="report-hero mb-12">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-8">
          <div className="flex-1 min-w-0">
            <SectionLabel>{t("reports.renderer.heroLabel")}</SectionLabel>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground mt-1 leading-tight">
              {data.meta.companyName}
            </h1>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              {data.meta.domain && (
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {data.meta.domain}
                </span>
              )}
              {createdDate && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {createdDate}
                </span>
              )}
            </div>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-2 mt-4">
              {data.hero.badges.map((b, i) => (
                <Badge key={i} variant="outline" className="text-[10px] font-normal border-border/50 bg-transparent">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
          {/* Score ring */}
          <div className="flex flex-col items-center shrink-0">
            <ScoreRing value={geoScore} />
            <p className={`text-xs font-medium mt-2 ${scoreColor(geoScore)}`}>
              {scoreLabel(geoScore, t)}
            </p>
          </div>
        </div>
      </header>

      {/* Divider */}
      <div className="h-px bg-border/50 mb-10 report-divider" />

      {/* ─── SECTIONS ─── */}
      <div className="space-y-12">
        {mainSections.map((section) => (
          <section key={section.id} className="report-block" data-track-section={section.id}>
            {/* Only show title for non-summary sections */}
            {section.type !== "summary" && (
              <h2 className="text-base font-semibold tracking-tight text-foreground mb-4 flex items-center gap-2">
                <span className="w-1 h-5 rounded-full bg-primary/60 shrink-0" />
                {section.title}
              </h2>
            )}
            {renderSection(section, t, handleBook)}
          </section>
        ))}
      </div>

      {/* ─── TECHNICAL APPENDIX (collapsible) ─── */}
      <div className="mt-12">
        <Collapsible open={techOpen} onOpenChange={setTechOpen}>
          <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer group">
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${techOpen ? "rotate-180" : ""}`} />
            <span className="font-medium">{t("reports.renderer.techAppendix")}</span>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-4">
            <div className="rounded-xl border bg-muted/20 p-5 text-xs text-muted-foreground leading-relaxed space-y-2">
              <p>{t("reports.renderer.techCrawlNote", { domain: data.meta.domain || t("reports.renderer.theWebsite") })}</p>
              <p>{t("reports.renderer.techMethod")}</p>
              <p>{t("reports.renderer.techGenerated", { date: data.meta.createdAt ? new Date(data.meta.createdAt).toLocaleString(numberLocale) : t("reports.renderer.unknownDate") })}</p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

      {/* ─── CTA ─── */}
      {ctaSection && (
        <div className="mt-12">
          {renderSection(ctaSection, t, handleBook)}
        </div>
      )}

      {/* ─── FOOTER ─── */}
      {publicMode && (
        <footer className="mt-14 pt-6 border-t border-border/30 text-center report-footer">
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
        companyName={data.meta.companyName}
        domain={data.meta.domain}
      />
    </div>
  );
}
