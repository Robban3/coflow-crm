// Localized text for the rule-based GEO findings used by the quick-scan
// (title/description/recommendation). Same check set as the full GEO analysis,
// but here the text follows the scan's language so the mini-report and email
// aren't hardcoded Swedish.

import { resolveLang, type Lang } from "./analysisText.ts";

interface FT { title: string; description: string; recommendation: string; }

interface GeoFindingText {
  faq: FT;
  orgSchema: FT;
  meta: (missing: number, total: number) => FT;
  thin: (thin: number, total: number) => FT;
  servicePages: FT;
  contact: FT;
  noindex: (count: number) => FT;
}

const GF: Record<Lang, GeoFindingText> = {
  sv: {
    faq: {
      title: "Saknar FAQ-sektion",
      description: "Ingen FAQ hittad. FAQ-innehåll är en av de viktigaste signalerna för AI-motorer.",
      recommendation: "Lägg till en FAQ-sida med vanliga frågor om era tjänster. Använd FAQPage-schema.",
    },
    orgSchema: {
      title: "Saknar Organization/Service schema",
      description: "Ingen strukturerad data för företaget. AI-motorer behöver schema.org för att referera korrekt.",
      recommendation: "Lägg till Organization eller LocalBusiness schema.",
    },
    meta: (m, t) => ({
      title: "Sidor saknar meta-beskrivning",
      description: `${m} av ${t} sidor saknar meta-beskrivning.`,
      recommendation: "Skriv unika meta-beskrivningar (120-160 tecken) per sida.",
    }),
    thin: (th, t) => ({
      title: "Tunt innehåll",
      description: `${th} av ${t} sidor har under 300 ord.`,
      recommendation: "Utöka innehållet med detaljerad information och definitioner.",
    }),
    servicePages: {
      title: "Saknar tjänstesidor",
      description: 'Inga dedikerade "Om oss" eller "Tjänster"-sidor hittades.',
      recommendation: "Skapa tydliga sidor som beskriver era tjänster i detalj.",
    },
    contact: {
      title: "Ingen dedikerad kontaktsida",
      description: "Ingen tydlig kontaktsida hittades.",
      recommendation: "Skapa en kontaktsida med adress, telefon och e-post.",
    },
    noindex: (c) => ({
      title: "Sidor blockerade från indexering",
      description: `${c} sida/sidor har noindex-taggar.`,
      recommendation: "Ta bort noindex från sidor som ska vara synliga.",
    }),
  },
  en: {
    faq: {
      title: "Missing FAQ section",
      description: "No FAQ found. FAQ content is one of the strongest signals for AI engines.",
      recommendation: "Add an FAQ page with common questions about your services. Use FAQPage schema.",
    },
    orgSchema: {
      title: "Missing Organization/Service schema",
      description: "No structured data for the company. AI engines need schema.org to reference it correctly.",
      recommendation: "Add Organization or LocalBusiness schema.",
    },
    meta: (m, t) => ({
      title: "Pages missing meta description",
      description: `${m} of ${t} pages are missing a meta description.`,
      recommendation: "Write unique meta descriptions (120-160 characters) per page.",
    }),
    thin: (th, t) => ({
      title: "Thin content",
      description: `${th} of ${t} pages have under 300 words.`,
      recommendation: "Expand the content with detailed information and definitions.",
    }),
    servicePages: {
      title: "Missing service pages",
      description: 'No dedicated "About" or "Services" pages were found.',
      recommendation: "Create clear pages describing your services in detail.",
    },
    contact: {
      title: "No dedicated contact page",
      description: "No clear contact page was found.",
      recommendation: "Create a contact page with address, phone and email.",
    },
    noindex: (c) => ({
      title: "Pages blocked from indexing",
      description: `${c} page(s) have noindex tags.`,
      recommendation: "Remove noindex from pages that should be visible.",
    }),
  },
  es: {
    faq: {
      title: "Falta sección de preguntas frecuentes (FAQ)",
      description: "No se encontró ninguna FAQ. El contenido de FAQ es una de las señales más importantes para los motores de IA.",
      recommendation: "Añade una página de FAQ con preguntas habituales sobre vuestros servicios. Usa el esquema FAQPage.",
    },
    orgSchema: {
      title: "Falta esquema Organization/Service",
      description: "No hay datos estructurados de la empresa. Los motores de IA necesitan schema.org para referenciarla correctamente.",
      recommendation: "Añade el esquema Organization o LocalBusiness.",
    },
    meta: (m, t) => ({
      title: "Páginas sin meta descripción",
      description: `${m} de ${t} páginas no tienen meta descripción.`,
      recommendation: "Escribe meta descripciones únicas (120-160 caracteres) por página.",
    }),
    thin: (th, t) => ({
      title: "Contenido escaso",
      description: `${th} de ${t} páginas tienen menos de 300 palabras.`,
      recommendation: "Amplía el contenido con información detallada y definiciones.",
    }),
    servicePages: {
      title: "Faltan páginas de servicios",
      description: 'No se encontraron páginas dedicadas de "Quiénes somos" o "Servicios".',
      recommendation: "Crea páginas claras que describan vuestros servicios en detalle.",
    },
    contact: {
      title: "Sin página de contacto dedicada",
      description: "No se encontró una página de contacto clara.",
      recommendation: "Crea una página de contacto con dirección, teléfono y correo.",
    },
    noindex: (c) => ({
      title: "Páginas bloqueadas para la indexación",
      description: `${c} página(s) tienen etiquetas noindex.`,
      recommendation: "Quita noindex de las páginas que deban ser visibles.",
    }),
  },
};

export function geoFindingText(language?: string | null): GeoFindingText {
  return GF[resolveLang(language)];
}
