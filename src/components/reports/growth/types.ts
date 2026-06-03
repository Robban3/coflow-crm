/* ─── Growth Report Snapshot Types ─── */

export interface GrowthReportData {
  type: "complete_growth_report";
  included_modules: { web: boolean; geo: boolean; seo: boolean };
  company: { name: string; domain: string | null };
  created_at: string;

  web: {
    performance_score: number | null;
    seo_score: number | null;
    accessibility_score: number | null;
    best_practices_score: number | null;
    analyzed_at: string;
  } | null;

  geo: {
    geo_score: number | null;
    summary: string | null;
    findings: GeoFinding[];
    actions: GeoAction[];
    analyzed_at: string;
  } | null;

  seo: {
    visibility_score: number | null;
    ai_summary: string | null;
    primary_keywords: SeoKeyword[] | null;
    ai_opportunities: SeoOpportunity[] | null;
  } | null;

  recommended_package: "start" | "growth" | "dominate";
  biggest_barrier: { area: string; title: string; description: string };

  // Editable before sharing
  package_config?: {
    selected: "start" | "growth" | "dominate";
    bullets: Record<string, string[]>;
  };

  /** @deprecated Use ai_visibility_pricing instead */
  pricing?: {
    geo_monthly?: number;
    web_fix?: number;
    seo_monthly?: number;
  };

  /** New unified pricing model */
  ai_visibility_pricing?: {
    start_monthly: number;
    growth_monthly: number;
    dominate_monthly: number;
    website_rebuild_from: number;
    show_website_upsell: boolean;
    currency: string;
    billing_period_label: string;
  };

  contact?: {
    booking_url?: string;
    email?: string;
    phone?: string;
  };
}

export interface GeoFinding {
  severity: string;
  category: string;
  title: string;
  description: string | null;
  recommendation: string | null;
}

export interface GeoAction {
  priority: string;
  title: string;
  steps: string | null;
  estimated_impact: string | null;
  estimated_effort: string | null;
}

export interface SeoKeyword {
  keyword: string;
  position: number;
  volume: number;
}

export interface SeoOpportunity {
  title: string;
  priority: string;
}

export function isGrowthReport(data: unknown): data is GrowthReportData {
  if (!data || typeof data !== "object") return false;
  return (data as any).type === "complete_growth_report";
}

/* ─── Default package bullets (unified AI-synlighet) ─── */

export const DEFAULT_PACKAGE_BULLETS: Record<string, string[]> = {
  start: [
    "GEO-grundoptimering",
    "Schema markup-implementation",
    "Grundläggande teknisk SEO-fix",
    "Månatlig uppföljning & rapport",
  ],
  growth: [
    "Allt i Start",
    "Avancerad GEO-optimering",
    "Innehållsstrategi för AI-synlighet",
    "Prestandaoptimering",
    "Veckovis rapportering",
    "SEO-övervakning & sökordsanalys",
  ],
  dominate: [
    "Allt i Growth",
    "Full teknisk webboptimering",
    "Kontinuerlig innehållsproduktion",
    "Konkurrentbevakning",
    "Dedikerad rådgivare",
    "Prioriterad support",
  ],
};

/* ─── Tier descriptions ─── */

export const TIER_FIT_LABELS: Record<string, string> = {
  start: "Passar er som vill komma igång med AI-synlighet och har en stabil grund.",
  growth: "Passar er som vill växa snabbare och synas mer i både Google och AI-sökmotorer.",
  dominate: "Passar er som vill dominera er nisch och maximera digital synlighet.",
};
