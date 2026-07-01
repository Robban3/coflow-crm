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

type Lang = "sv" | "en" | "es";
const pickLang = (l?: string): Lang => (l === "en" ? "en" : l === "es" ? "es" : "sv");

// Localized labels for the GEO report chrome (titles, CTA, fallbacks). The
// findings/actions text itself is AI-generated in the right language upstream.
const L: Record<Lang, Record<string, string>> = {
  sv: {
    unknownCompany: "Okänt företag", summary: "Sammanfattning",
    noSummary: "Ingen sammanfattning tillgänglig. Kör om analysen för att generera en.",
    score: "Poäng", geoLabel: "GEO / AI-synlighet",
    geoDesc: "Hur väl webbplatsen är optimerad för AI-sökmotorer",
    recActions: "Rekommenderade åtgärder", quickWins: "Snabba vinster", medium: "Medel", longTerm: "Långsiktigt",
    noActions: "Inga åtgärder registrerade – kör om analysen eller kontrollera crawl.",
    problems: "Identifierade problem",
    noFindings: "Inga fynd registrerade – kör om analysen eller kontrollera crawl.",
    nextStep: "Nästa steg", ctaHeading: "Vill du förbättra din AI-synlighet?",
    ctaDesc: "Boka en kostnadsfri genomgång där vi går igenom rapporten och tar fram en konkret plan.",
    ctaButton: "Boka genomgång", reportTitle: "GEO-rapport", subtitlePrefix: "AI-synlighetsanalys för",
    theSite: "webbplatsen", geoNotCalc: "GEO: ej beräknad", findingsWord: "fynd", actionsWord: "åtgärder",
  },
  en: {
    unknownCompany: "Unknown company", summary: "Summary",
    noSummary: "No summary available. Re-run the analysis to generate one.",
    score: "Score", geoLabel: "GEO / AI visibility",
    geoDesc: "How well the website is optimised for AI search engines",
    recActions: "Recommended actions", quickWins: "Quick wins", medium: "Medium", longTerm: "Long-term",
    noActions: "No actions recorded – re-run the analysis or check the crawl.",
    problems: "Identified problems",
    noFindings: "No findings recorded – re-run the analysis or check the crawl.",
    nextStep: "Next step", ctaHeading: "Want to improve your AI visibility?",
    ctaDesc: "Book a free review where we go through the report and build a concrete plan.",
    ctaButton: "Book a review", reportTitle: "GEO report", subtitlePrefix: "AI visibility analysis for",
    theSite: "the website", geoNotCalc: "GEO: not calculated", findingsWord: "findings", actionsWord: "actions",
  },
  es: {
    unknownCompany: "Empresa desconocida", summary: "Resumen",
    noSummary: "No hay resumen disponible. Vuelve a ejecutar el análisis para generarlo.",
    score: "Puntuación", geoLabel: "GEO / Visibilidad IA",
    geoDesc: "Qué tan bien está optimizado el sitio web para los motores de búsqueda con IA",
    recActions: "Acciones recomendadas", quickWins: "Victorias rápidas", medium: "Media", longTerm: "A largo plazo",
    noActions: "No hay acciones registradas: vuelve a ejecutar el análisis o revisa el rastreo.",
    problems: "Problemas identificados",
    noFindings: "No hay hallazgos registrados: vuelve a ejecutar el análisis o revisa el rastreo.",
    nextStep: "Siguiente paso", ctaHeading: "¿Quieres mejorar tu visibilidad en IA?",
    ctaDesc: "Reserva una revisión gratuita en la que repasamos el informe y creamos un plan concreto.",
    ctaButton: "Reservar revisión", reportTitle: "Informe GEO", subtitlePrefix: "Análisis de visibilidad IA para",
    theSite: "el sitio web", geoNotCalc: "GEO: sin calcular", findingsWord: "hallazgos", actionsWord: "acciones",
  },
};

export function buildGeoReportPayload(
  lead: LeadInfo,
  geo: GeoAnalysis,
  findings: GeoFinding[],
  actions: GeoAction[],
  language: string = "sv"
): ReportSchema {
  const tr = L[pickLang(language)];
  const companyName = lead.company_name || tr.unknownCompany;

  const sections: ReportSection[] = [];

  // Summary
  sections.push({
    id: "summary",
    type: "summary",
    title: tr.summary,
    content: {
      text: geo.summary || tr.noSummary,
    },
  });

  // Scorecards
  sections.push({
    id: "scores",
    type: "scorecards",
    title: tr.score,
    content: {
      cards: [
        {
          label: tr.geoLabel,
          value: geo.geo_score,
          max: 100,
          description: tr.geoDesc,
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
      title: tr.recActions,
      content: {
        groups: [
          { priority: "quick_win", label: tr.quickWins, items: groupedActions.quick_win },
          { priority: "medium", label: tr.medium, items: groupedActions.medium },
          { priority: "long_term", label: tr.longTerm, items: groupedActions.long_term },
        ].filter((g) => g.items.length > 0),
      },
    });
  } else {
    sections.push({
      id: "actions",
      type: "text",
      title: tr.recActions,
      content: {
        text: tr.noActions,
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
      title: tr.problems,
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
      title: tr.problems,
      content: {
        text: tr.noFindings,
      },
    });
  }

  // CTA
  sections.push({
    id: "cta",
    type: "cta",
    title: tr.nextStep,
    content: {
      heading: tr.ctaHeading,
      description: tr.ctaDesc,
      buttonText: tr.ctaButton,
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
      title: `${tr.reportTitle}: ${companyName}`,
      subtitle: `${tr.subtitlePrefix} ${geo.domain || lead.website || tr.theSite}`,
      badges: [
        geo.geo_score !== null ? `GEO: ${geo.geo_score}/100` : tr.geoNotCalc,
        `${findings.length} ${tr.findingsWord}`,
        `${actions.length} ${tr.actionsWord}`,
      ],
    },
    sections,
  };
}
