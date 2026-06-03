import type { ReportSchema, ReportSection } from "./reportSchema";

interface GeoAnalysis {
  id: string;
  domain: string;
  geo_score: number | null;
  summary: string | null;
  completed_at: string | null;
  created_at: string;
}

interface GeoFinding {
  id: string;
  category: string;
  severity: string;
  title: string;
  description: string | null;
  recommendation: string | null;
}

interface GeoAction {
  id: string;
  priority: string;
  title: string;
  steps: string | null;
  estimated_impact: string | null;
  estimated_effort: string | null;
}

interface LeadInfo {
  company_name: string | null;
  website: string | null;
}

export function buildGeoReportPayload(
  lead: LeadInfo,
  geo: GeoAnalysis,
  findings: GeoFinding[],
  actions: GeoAction[]
): ReportSchema {
  const companyName = lead.company_name || "Okänt företag";

  const sections: ReportSection[] = [];

  // Summary
  sections.push({
    id: "summary",
    type: "summary",
    title: "Sammanfattning",
    content: {
      text: geo.summary || "Ingen sammanfattning tillgänglig. Kör om analysen för att generera en.",
    },
  });

  // Scorecards
  sections.push({
    id: "scores",
    type: "scorecards",
    title: "Poäng",
    content: {
      cards: [
        {
          label: "GEO / AI-synlighet",
          value: geo.geo_score,
          max: 100,
          description: "Hur väl webbplatsen är optimerad för AI-sökmotorer",
        },
      ],
    },
  });

  // Actions grouped by priority
  const groupedActions: Record<string, GeoAction[]> = {
    quick_win: [],
    medium: [],
    long_term: [],
  };
  for (const a of actions) {
    const key = a.priority in groupedActions ? a.priority : "medium";
    groupedActions[key].push(a);
  }

  if (actions.length > 0) {
    sections.push({
      id: "actions",
      type: "actions",
      title: "Rekommenderade åtgärder",
      content: {
        groups: [
          { priority: "quick_win", label: "Quick Wins", items: groupedActions.quick_win },
          { priority: "medium", label: "Medium", items: groupedActions.medium },
          { priority: "long_term", label: "Långsiktigt", items: groupedActions.long_term },
        ].filter((g) => g.items.length > 0),
      },
    });
  } else {
    sections.push({
      id: "actions",
      type: "text",
      title: "Rekommenderade åtgärder",
      content: {
        text: "Inga åtgärder registrerade – kör om analysen eller kontrollera crawl.",
      },
    });
  }

  // Findings table
  const sortedFindings = [...findings].sort((a, b) => {
    const order: Record<string, number> = { high: 0, medium: 1, low: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  if (sortedFindings.length > 0) {
    sections.push({
      id: "findings",
      type: "findings",
      title: "Identifierade problem",
      content: {
        items: sortedFindings.map((f) => ({
          severity: f.severity,
          category: f.category,
          title: f.title,
          description: f.description,
          recommendation: f.recommendation,
        })),
      },
    });
  } else {
    sections.push({
      id: "findings",
      type: "text",
      title: "Identifierade problem",
      content: {
        text: "Inga fynd registrerade – kör om analysen eller kontrollera crawl.",
      },
    });
  }

  // CTA
  sections.push({
    id: "cta",
    type: "cta",
    title: "Nästa steg",
    content: {
      heading: "Vill du förbättra din AI-synlighet?",
      description:
        "Boka en kostnadsfri genomgång där vi går igenom rapporten och tar fram en konkret plan.",
      buttonText: "Boka genomgång",
      buttonUrl: "#contact",
    },
  });

  return {
    meta: {
      companyName,
      domain: geo.domain || lead.website,
      createdAt: new Date().toISOString(),
      generatedBy: "system",
      reportType: "geo",
      scores: {
        geo: geo.geo_score,
        web: null,
      },
    },
    hero: {
      title: `GEO-rapport: ${companyName}`,
      subtitle: `AI-synlighetsanalys för ${geo.domain || lead.website || "webbplatsen"}`,
      badges: [
        geo.geo_score !== null ? `GEO: ${geo.geo_score}/100` : "GEO: ej beräknad",
        `${findings.length} fynd`,
        `${actions.length} åtgärder`,
      ],
    },
    sections,
  };
}
