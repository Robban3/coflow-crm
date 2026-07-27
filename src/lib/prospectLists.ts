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

/** One finding from the opportunity scorer, as stored in score_reasons. */
export interface ScoreReason {
  code: string;
  label: string;
  impact: number;
  category: "technical" | "mobile" | "seo" | "conversion" | "modernity";
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
  score_reasons: ScoreReason[] | null;
  scored_at: string | null;
  review_status: ReviewStatus | null;
  psi_performance: number | null;
  psi_accessibility: number | null;
  psi_seo: number | null;
  psi_checked_at: string | null;
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
      "Sajten fungerar. Sälj på tillväxt i stället: synlighet i Google och AI-sök, bokning, konvertering.",
    textClass: "text-success",
    badgeClass: "bg-success/10 text-success border-success/20",
    dotClass: "bg-success",
  },
  {
    min: 26,
    max: 50,
    label: "Mindre brister",
    description:
      "Fungerar, men har konkreta luckor du kan peka på i samtalet.",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  {
    min: 51,
    max: 75,
    label: "Tydliga brister",
    description:
      "Tydliga problem — lätt att visa konkret nytta av en ny sajt.",
    textClass: "text-warning",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    dotClass: "bg-warning",
  },
  {
    min: 76,
    max: 100,
    label: "Stora brister",
    description:
      "Akut behov. Störst chans att stänga — ring dessa först.",
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

// What a salesperson can actually SAY about each finding. A label like "Gammal
// teknikstack" means nothing on a cold call — this turns each detected issue
// into an argument. Keep in sync with REASONS in
// supabase/functions/_shared/opportunity-score.ts.
export const ISSUE_ARGUMENTS: Record<string, string> = {
  no_website:
    "Syns inte alls på webben. Kunder som söker efter dem hittar konkurrenterna i stället.",
  site_unreachable:
    "Sajten svarar inte just nu — besökare som klickar möts av ett felmeddelande.",
  server_error:
    "Servern returnerar fel. Både besökare och Google får problem att nå sidan.",
  no_https:
    "Saknar HTTPS. Webbläsare varnar besökaren för att sidan är osäker.",
  tls_invalid:
    "Certifikatfel ger en full varningsruta innan besökaren ens ser sidan.",
  legacy_plugin:
    "Innehåll som kräver Flash eller plugins fungerar inte i någon modern webbläsare.",
  table_layout:
    "Byggd med tabellayout — en teknik från tidigt 2000-tal. Går inte att göra responsiv.",
  stale_copyright:
    "Sidfoten visar ett gammalt årtal. Besökare tolkar det som att verksamheten inte är aktiv.",
  jquery_stack:
    "Bygger på jQuery, teknik från 2010-talet. Tungt på mobil och dyrt att vidareutveckla.",
  legacy_bootstrap:
    "Gammal Bootstrap-version. Får ofta layoutproblem på nyare telefoner.",
  no_responsive_img:
    "Bilderna skalas inte efter skärmstorlek — sidan blir onödigt tung på mobil.",
  heavy_inline_css:
    "Formatering ligger utspridd i koden. Varje ändring blir dyr och risken för fel hög.",
  no_viewport_meta:
    "Inte mobilanpassad. Merparten av besökarna är på mobil och får zooma manuellt.",
  fixed_width:
    "Fast bredd — layouten bryts eller kräver sidscroll på telefon.",
  missing_title:
    "Saknar sidtitel. Google har ingen rubrik att visa i sökresultatet.",
  missing_meta_desc:
    "Saknar metabeskrivning, så Google hittar på egen text i sökresultatet.",
  missing_h1:
    "Saknar huvudrubrik. Google får svårt att förstå vad sidan handlar om.",
  no_schema:
    "Saknar strukturerad data. Öppettider, betyg och adress visas därför inte direkt i Google.",
  thin_content:
    "Mycket lite innehåll. Google har helt enkelt inget att ranka dem på.",
  no_favicon:
    "Ingen ikon i webbläsarfliken — liten sak, men ser oproffsigt ut.",
  no_contact_path:
    "Ingen tydlig kontaktväg. Besökare som vill boka hittar inte hur.",
  no_open_graph:
    "Delas länken i sociala medier visas varken bild eller beskrivning.",
  no_analytics:
    "Ingen webbanalys installerad — de vet inte hur många besökare de får eller varifrån.",
  psi_very_slow:
    "Mycket långsam i Googles mätning. Besökare hoppar av innan sidan laddat.",
  psi_slow:
    "Långsam laddning, vilket både tappar besökare och sänker Google-rankingen.",
};

export function issueArgument(code: string | null | undefined): string | null {
  if (!code) return null;
  return ISSUE_ARGUMENTS[code] ?? null;
}
