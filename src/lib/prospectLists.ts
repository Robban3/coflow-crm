// Prospektlistor – delade typer och etiketter.
//
// src/integrations/supabase/types.ts är autogenererad och känner ännu inte till
// prospect_lists / prospect_list_items, så alla anrop mot dem går via
// (supabase as any) och typas lokalt med interfacen nedan.

export type ProspectListStatus =
  | "building"
  | "enriching"
  | "ready"
  | "imported"
  | "archived";

export type WebsiteStatus =
  | "unknown"
  | "linked"
  | "discovered"
  | "none_found"
  | "verify_failed";

export type ReviewStatus = "keep" | "discard";

export interface ProspectList {
  id: string;
  organization_id: string;
  created_by: string;
  name: string;
  description: string | null;
  status: ProspectListStatus;
  filter_json: Record<string, unknown> | null;
  shared_to_team: boolean;
  item_count: number;
  imported_at: string | null;
  imported_lead_count: number;
  created_at: string;
  updated_at: string;
}

export interface ProspectListItem {
  id: string;
  list_id: string;
  organization_id: string;
  pool_id: string | null;
  company_name: string;
  org_number: string | null;
  city: string | null;
  address: string | null;
  postal_code: string | null;
  phone: string | null;
  email: string | null;
  industry: string | null;
  sni_codes: string[] | null;
  website: string | null;
  website_status: WebsiteStatus;
  website_source: string | null;
  website_confidence: number | null;
  website_evidence: Record<string, unknown> | null;
  opportunity_score: number | null;
  opportunity_score_version: string | null;
  main_issue_code: string | null;
  score_reasons: Record<string, unknown> | null;
  scored_at: string | null;
  review_status: ReviewStatus | null;
  imported_lead_id: string | null;
  duplicate_of_lead_id: string | null;
  source: string;
  source_data: Record<string, unknown> | null;
  created_at: string;
}

/**
 * Ett företag på väg in i en lista. list_id och organization_id sätts av
 * dialogen som gör inserten, så anroparen behöver bara mappa företagsfälten.
 */
export interface NewProspectListItem {
  company_name: string;
  org_number?: string | null;
  city?: string | null;
  address?: string | null;
  postal_code?: string | null;
  phone?: string | null;
  email?: string | null;
  industry?: string | null;
  sni_codes?: string[] | null;
  website?: string | null;
  website_status?: WebsiteStatus;
  source: string;
  source_data?: Record<string, unknown> | null;
}

/** Radtyp som import_prospect_list_to_leads() returnerar. */
export interface ImportProspectListResult {
  imported: number;
  skipped_duplicates: number;
  remaining: number;
}

export const LIST_STATUS_LABELS: Record<ProspectListStatus, string> = {
  building: "Byggs",
  enriching: "Berikas",
  ready: "Redo",
  imported: "Importerad",
  archived: "Arkiverad",
};

/** Badge-varianter (semantiska tokens, se components/ui/badge.tsx). */
export type BadgeVariant =
  | "default"
  | "secondary"
  | "destructive"
  | "success"
  | "warning"
  | "info"
  | "outline";

export const LIST_STATUS_VARIANTS: Record<ProspectListStatus, BadgeVariant> = {
  building: "outline",
  enriching: "info",
  ready: "success",
  imported: "secondary",
  archived: "outline",
};

export const WEBSITE_STATUS_LABELS: Record<WebsiteStatus, string> = {
  unknown: "Okänd",
  linked: "Länkad",
  discovered: "Hittad",
  none_found: "Ingen hittad",
  verify_failed: "Kunde ej verifieras",
};

export const WEBSITE_STATUS_VARIANTS: Record<WebsiteStatus, BadgeVariant> = {
  unknown: "outline",
  linked: "success",
  discovered: "info",
  none_found: "secondary",
  verify_failed: "warning",
};

export function listStatusLabel(status: string): string {
  return LIST_STATUS_LABELS[status as ProspectListStatus] ?? status;
}

export function websiteStatusLabel(status: string): string {
  return WEBSITE_STATUS_LABELS[status as WebsiteStatus] ?? status;
}

// Issue codes raised by the opportunity scorer. Keep in sync with
// supabase/functions/_shared/opportunity-score.ts — the score is meaningless to
// a salesperson without the reason behind it.
export const ISSUE_LABELS: Record<string, string> = {
  no_website: "Saknar webbplats",
  site_unreachable: "Sajten svarar inte",
  server_error: "Serverfel",
  no_https: "Saknar HTTPS",
  tls_invalid: "Certifikatfel",
  legacy_plugin: "Flash/plugin-innehall",
  table_layout: "Tabellbaserad layout",
  stale_copyright: "Foraldrad sidfot",
  jquery_stack: "Gammal teknikstack",
  legacy_bootstrap: "Gammal Bootstrap",
  no_responsive_img: "Inga responsiva bilder",
  heavy_inline_css: "Spretig inline-CSS",
  no_viewport_meta: "Ej mobilanpassad",
  fixed_width: "Fast bredd",
  missing_title: "Saknar sidtitel",
  missing_meta_desc: "Saknar metabeskrivning",
  missing_h1: "Saknar rubrik",
  no_schema: "Saknar strukturerad data",
  thin_content: "Tunt innehall",
  no_favicon: "Saknar favicon",
  no_contact_path: "Ingen kontaktvag",
  no_open_graph: "Saknar delningstaggar",
  no_analytics: "Ingen webbanalys",
  psi_very_slow: "Mycket langsam",
  psi_slow: "Langsam",
};

export function issueLabel(code: string | null | undefined): string | null {
  if (!code) return null;
  return ISSUE_LABELS[code] ?? code;
}

// Score bands. NOTE the colour reads as the state of the WEBSITE, not the value
// of the lead — red means the site is in bad shape, which is precisely the lead
// worth calling. The descriptions spell that out so nobody reads red as "skip".
export type ScoreBand = {
  min: number;
  max: number;
  label: string;
  description: string;
  /** Tailwind classes using the existing semantic tokens. */
  textClass: string;
  badgeClass: string;
  dotClass: string;
};

export const SCORE_BANDS: ScoreBand[] = [
  {
    min: 0,
    max: 25,
    label: "Välskött",
    description:
      "Modern och fungerande webbplats. Svårt att sälja mot — prioritera annat.",
    textClass: "text-success",
    badgeClass: "bg-success/10 text-success border-success/20",
    dotClass: "bg-success",
  },
  {
    min: 26,
    max: 50,
    label: "Mindre brister",
    description:
      "Fungerar, men har luckor i mobil, SEO eller innehåll. Kan vara värt ett samtal.",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  {
    min: 51,
    max: 75,
    label: "Tydliga brister",
    description:
      "Flera påtagliga problem — ofta föråldrad design eller dålig mobilanpassning. Bra lead.",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  {
    min: 76,
    max: 100,
    label: "Stora brister",
    description:
      "Mycket gammal webbplats — eller ingen alls. Här finns störst behov och bäst chans att sälja.",
    textClass: "text-destructive",
    badgeClass: "bg-destructive/10 text-destructive border-destructive/20",
    dotClass: "bg-destructive",
  },
];

export function scoreBand(score: number | null | undefined): ScoreBand | null {
  if (score == null) return null;
  return (
    SCORE_BANDS.find((b) => score >= b.min && score <= b.max) ??
    SCORE_BANDS[SCORE_BANDS.length - 1]
  );
}
