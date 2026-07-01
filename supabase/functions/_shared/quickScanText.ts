// Localized strings for the public GEO quick-scan chain (progress labels, the
// AI mini-summary, the result/failure emails, and the public view errors).
// The scan stores the creator's UI language, so every async step reads it here.

import { resolveLang, type Lang } from "./analysisText.ts";

interface QS {
  langName: string; // for the AI prompt ("write in ...")
  // progress
  receiving: string; fetching: string; building: string; done: string;
  fetchError: string;
  // quality (email + fallback summary)
  strong: string; potential: string; low: string;
  fallbackSummary: (domain: string, score: number, problems: number, pages: number) => string;
  // success email
  emailEyebrow: string; findingsHeading: string; actionsHeading: string;
  openReport: string; bookReview: string; opensInBrowser: string; footerScan: string;
  subject: (score: number) => string;
  // failure email
  failHeading: string; failBody: (domain: string) => string; failCta: string; failSubject: string;
  // public view errors
  invalidToken: string; notAvailable: string; expired: string; serverError: string;
}

const QS_TEXT: Record<Lang, QS> = {
  sv: {
    langName: "svenska",
    receiving: "Tar emot uppgifter", fetching: "Hämtar innehåll från webbplatsen",
    building: "Skapar mini-rapport", done: "Klar",
    fetchError: "Kunde inte hämta webbplatsinnehåll",
    strong: "Stark AI-synlighet", potential: "Bra potential", low: "Låg AI-synlighet",
    fallbackSummary: (d, s, p, pg) =>
      `${d} har ${s >= 80 ? "stark" : s >= 50 ? "medel" : "låg"} AI-synlighet (${s}/100). ${p} problem identifierade under snabbscanningen av ${pg} sidor.`,
    emailEyebrow: "GEO-Rapport", findingsHeading: "Identifierade problem",
    actionsHeading: "Rekommenderade åtgärder", openReport: "Öppna din rapport →",
    bookReview: "Boka 15 min genomgång", opensInBrowser: "Öppnas i webbläsaren",
    footerScan: "Snabbscan av Kod & Co · ",
    subject: (s) => `Din AI-synlighet: ${s}/100 – mini-rapport`,
    failHeading: "Vi kunde inte analysera webbplatsen",
    failBody: (d) => `Vi kunde inte automatiskt analysera <strong style="color:#cbd5e1;">${d}</strong>. Det kan bero på att webbplatsen blockerar automatiska besök.`,
    failCta: "Boka genomgång istället", failSubject: "Vi kunde inte analysera webbplatsen automatiskt",
    invalidToken: "Ogiltig token", notAvailable: "Rapport ej tillgänglig",
    expired: "Rapporten har gått ut", serverError: "Serverfel",
  },
  en: {
    langName: "engelska",
    receiving: "Receiving details", fetching: "Fetching website content",
    building: "Creating mini report", done: "Done",
    fetchError: "Could not fetch website content",
    strong: "Strong AI visibility", potential: "Good potential", low: "Low AI visibility",
    fallbackSummary: (d, s, p, pg) =>
      `${d} has ${s >= 80 ? "strong" : s >= 50 ? "moderate" : "low"} AI visibility (${s}/100). ${p} issues identified during the quick scan of ${pg} pages.`,
    emailEyebrow: "GEO report", findingsHeading: "Identified problems",
    actionsHeading: "Recommended actions", openReport: "Open your report →",
    bookReview: "Book a 15-min review", opensInBrowser: "Opens in your browser",
    footerScan: "Quick scan by Kod & Co · ",
    subject: (s) => `Your AI visibility: ${s}/100 – mini report`,
    failHeading: "We couldn't analyse the website",
    failBody: (d) => `We couldn't automatically analyse <strong style="color:#cbd5e1;">${d}</strong>. The website may be blocking automated visits.`,
    failCta: "Book a review instead", failSubject: "We couldn't analyse the website automatically",
    invalidToken: "Invalid token", notAvailable: "Report not available",
    expired: "The report has expired", serverError: "Server error",
  },
  es: {
    langName: "spanska",
    receiving: "Recibiendo datos", fetching: "Obteniendo el contenido del sitio web",
    building: "Creando el mini-informe", done: "Listo",
    fetchError: "No se pudo obtener el contenido del sitio web",
    strong: "Fuerte visibilidad IA", potential: "Buen potencial", low: "Baja visibilidad IA",
    fallbackSummary: (d, s, p, pg) =>
      `${d} tiene una visibilidad en IA ${s >= 80 ? "fuerte" : s >= 50 ? "media" : "baja"} (${s}/100). ${p} problemas identificados durante el escaneo rápido de ${pg} páginas.`,
    emailEyebrow: "Informe GEO", findingsHeading: "Problemas identificados",
    actionsHeading: "Acciones recomendadas", openReport: "Abre tu informe →",
    bookReview: "Reserva una revisión de 15 min", opensInBrowser: "Se abre en el navegador",
    footerScan: "Escaneo rápido de Kod & Co · ",
    subject: (s) => `Tu visibilidad en IA: ${s}/100 – mini-informe`,
    failHeading: "No pudimos analizar el sitio web",
    failBody: (d) => `No pudimos analizar automáticamente <strong style="color:#cbd5e1;">${d}</strong>. Puede que el sitio bloquee las visitas automatizadas.`,
    failCta: "Reserva una revisión", failSubject: "No pudimos analizar el sitio web automáticamente",
    invalidToken: "Token no válido", notAvailable: "Informe no disponible",
    expired: "El informe ha caducado", serverError: "Error del servidor",
  },
};

export function qs(language?: string | null): QS {
  return QS_TEXT[resolveLang(language)];
}
