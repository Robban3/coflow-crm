// ─── Report Schema Types ───────────────────────────────────────────────────

export interface ReportMeta {
  companyName: string;
  domain: string | null;
  createdAt: string;
  generatedBy: "system" | "user";
  reportType: "geo" | "web" | "combined";
  scores: {
    geo: number | null;
    web: number | null;
  };
}

export interface ReportHero {
  title: string;
  subtitle: string;
  badges: string[];
}

export type SectionType =
  | "summary"
  | "scorecards"
  | "actions"
  | "findings"
  | "table"
  | "cta"
  | "text";

export interface ReportSection {
  id: string;
  type: SectionType;
  title: string;
  content: any;
}

export interface ReportSchema {
  meta: ReportMeta;
  hero: ReportHero;
  sections: ReportSection[];
}

// ─── Runtime Validation ────────────────────────────────────────────────────

export function validateReportSchema(data: unknown): data is ReportSchema {
  if (!data || typeof data !== "object") return false;
  const d = data as any;

  if (!d.meta || typeof d.meta.companyName !== "string") return false;
  if (!d.hero || typeof d.hero.title !== "string") return false;
  if (!Array.isArray(d.sections)) return false;

  for (const s of d.sections) {
    if (typeof s.id !== "string" || typeof s.type !== "string" || typeof s.title !== "string") {
      return false;
    }
  }
  return true;
}
