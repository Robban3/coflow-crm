// Localized, user-visible strings for the analysis edge functions (fallback
// summaries, default titles, error messages). These used to be hardcoded in
// Swedish and leaked into Spanish/English UIs. Each analysis function already
// receives a language (sv/en/es) or market (SE/US/DE/ES) — resolve it here and
// pick the right string.

export type Lang = "sv" | "en" | "es";

/** Accepts a UI language code, a language name, or a market code and returns sv/en/es. */
export function resolveLang(input?: string | null): Lang {
  const v = String(input ?? "").trim().toLowerCase();
  // Korean market has no fixed-string translations yet → fall back to English.
  if (["en", "eng", "engelska", "english", "us", "gb", "uk", "ca", "au", "ie", "kr", "ko", "korean", "koreanska"].includes(v)) return "en";
  if (["es", "spa", "spanska", "español", "espanol", "spanish"].includes(v)) return "es";
  // sv, svenska, se, and anything unknown → Swedish (app default)
  return "sv";
}

type Dict = Record<Lang, string>;

const S: Record<string, Dict> = {
  // analyze-seo
  seoFallbackSummary: {
    sv: "SEO-analysen kunde inte generera AI-insikter. Grundläggande on-page-data har samlats in.",
    en: "The SEO analysis could not generate AI insights. Basic on-page data has been collected.",
    es: "El análisis SEO no pudo generar insights con IA. Se han recopilado los datos on-page básicos.",
  },
  urlRequired: {
    sv: "URL krävs",
    en: "URL is required",
    es: "Se requiere una URL",
  },
  analysisDataRequired: {
    sv: "Analysdata krävs",
    en: "Analysis data is required",
    es: "Se requieren datos de análisis",
  },
  noSummaryGenerated: {
    sv: "Ingen sammanfattning genererad",
    en: "No summary generated",
    es: "No se generó ningún resumen",
  },
  genericError: {
    sv: "Ett fel uppstod",
    en: "An error occurred",
    es: "Se produjo un error",
  },
  // run-geo-analysis
  defaultActionTitle: {
    sv: "Åtgärd",
    en: "Action",
    es: "Acción",
  },
  // pagespeed-analyze — user-facing analysis errors
  couldNotAnalyze: {
    sv: "Kunde inte analysera webbplatsen. Försök igen om en stund.",
    en: "Could not analyse the website. Please try again shortly.",
    es: "No se pudo analizar el sitio web. Inténtalo de nuevo en un momento.",
  },
  siteTooSlow: {
    sv: "Webbplatsen svarade för långsamt. Försök igen om en stund.",
    en: "The website responded too slowly. Please try again shortly.",
    es: "El sitio web respondió demasiado lento. Inténtalo de nuevo en un momento.",
  },
  siteUnreachable: {
    sv: "Kunde inte nå webbplatsen. Kontrollera att adressen är korrekt.",
    en: "Could not reach the website. Check that the address is correct.",
    es: "No se pudo acceder al sitio web. Comprueba que la dirección sea correcta.",
  },
  domainNotFound: {
    sv: "Domänen kunde inte hittas. Kontrollera adressen.",
    en: "The domain could not be found. Check the address.",
    es: "No se encontró el dominio. Comprueba la dirección.",
  },
  invalidUrl: {
    sv: "Ogiltig URL. Kontrollera att adressen är korrekt formaterad.",
    en: "Invalid URL. Check that the address is correctly formatted.",
    es: "URL no válida. Comprueba que la dirección tenga el formato correcto.",
  },
  analysisFailed: {
    sv: "Analysen misslyckades. Försök igen senare.",
    en: "The analysis failed. Please try again later.",
    es: "El análisis falló. Inténtalo de nuevo más tarde.",
  },
};

/** Look up a localized analysis string by key. */
export function at(key: keyof typeof S, language?: string | null): string {
  const lang = resolveLang(language);
  return S[key][lang];
}
