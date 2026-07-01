// Google Lighthouse localises audit titles server-side (via the PageSpeed
// `locale` param) and we store that localized string on each analysis. That
// means an analysis fetched in Swedish keeps Swedish titles forever — and the
// same stored analysis is shown to users of any UI language. To make the
// DISPLAY always follow the current UI language (and to fix already-stored
// analyses without re-running them), we map the common Lighthouse audit IDs to
// our own translations and look them up by ID at render time.
//
// Unmapped audits fall back to the stored (Lighthouse-provided) title.

type Lang = "sv" | "en" | "es";

const AUDIT_TITLES: Record<string, Record<Lang, string>> = {
  "render-blocking-resources": {
    sv: "Eliminera renderingsblockerande resurser",
    en: "Eliminate render-blocking resources",
    es: "Elimina los recursos que bloquean el renderizado",
  },
  "unused-css-rules": {
    sv: "Minska oanvänd CSS",
    en: "Reduce unused CSS",
    es: "Reduce el CSS sin usar",
  },
  "unused-javascript": {
    sv: "Minska oanvänd JavaScript",
    en: "Reduce unused JavaScript",
    es: "Reduce el JavaScript sin usar",
  },
  "unminified-css": {
    sv: "Minifiera CSS",
    en: "Minify CSS",
    es: "Minifica el CSS",
  },
  "unminified-javascript": {
    sv: "Minifiera JavaScript",
    en: "Minify JavaScript",
    es: "Minifica el JavaScript",
  },
  "modern-image-formats": {
    sv: "Visa bilder i moderna format",
    en: "Serve images in next-gen formats",
    es: "Publica imágenes en formatos de nueva generación",
  },
  "uses-optimized-images": {
    sv: "Koda bilder effektivt",
    en: "Efficiently encode images",
    es: "Codifica las imágenes de forma eficiente",
  },
  "uses-responsive-images": {
    sv: "Anpassa bildernas storlek",
    en: "Properly size images",
    es: "Ajusta el tamaño de las imágenes adecuadamente",
  },
  "offscreen-images": {
    sv: "Skjut upp bilder utanför skärmen",
    en: "Defer offscreen images",
    es: "Aplaza la carga de imágenes que están fuera de la pantalla",
  },
  "uses-text-compression": {
    sv: "Aktivera textkomprimering",
    en: "Enable text compression",
    es: "Habilita la compresión de texto",
  },
  "server-response-time": {
    sv: "Minska serverns initiala svarstid",
    en: "Reduce initial server response time",
    es: "Reduce el tiempo de respuesta inicial del servidor",
  },
  "redirects": {
    sv: "Undvik flera omdirigeringar",
    en: "Avoid multiple page redirects",
    es: "Evita los redireccionamientos de varias páginas",
  },
  "uses-rel-preconnect": {
    sv: "Föranslut till nödvändiga origins",
    en: "Preconnect to required origins",
    es: "Preconéctate a los orígenes necesarios",
  },
  "uses-rel-preload": {
    sv: "Förladda viktiga resurser",
    en: "Preload key requests",
    es: "Precarga las solicitudes clave",
  },
  "efficient-animated-content": {
    sv: "Använd videoformat för animerat innehåll",
    en: "Use video formats for animated content",
    es: "Usa formatos de vídeo para el contenido animado",
  },
  "duplicated-javascript": {
    sv: "Ta bort dubbletter i JavaScript-paket",
    en: "Remove duplicate modules in JavaScript bundles",
    es: "Quita los módulos duplicados de los paquetes de JavaScript",
  },
  "legacy-javascript": {
    sv: "Undvik äldre JavaScript till moderna webbläsare",
    en: "Avoid serving legacy JavaScript to modern browsers",
    es: "Evita enviar JavaScript antiguo a los navegadores modernos",
  },
  "prioritize-lcp-image": {
    sv: "Förladda LCP-bilden",
    en: "Preload Largest Contentful Paint image",
    es: "Precarga la imagen de Largest Contentful Paint",
  },
  "total-byte-weight": {
    sv: "Undvik enorma nätverksnyttolaster",
    en: "Avoid enormous network payloads",
    es: "Evita las cargas útiles de red enormes",
  },
  "dom-size": {
    sv: "Undvik en för stor DOM",
    en: "Avoid an excessive DOM size",
    es: "Evita un tamaño del DOM excesivo",
  },
  "third-party-summary": {
    sv: "Minska tredjepartskodens påverkan",
    en: "Reduce the impact of third-party code",
    es: "Reduce el impacto del código de terceros",
  },
  "bootup-time": {
    sv: "Minska JavaScript-körningstiden",
    en: "Reduce JavaScript execution time",
    es: "Reduce el tiempo de ejecución de JavaScript",
  },
  "mainthread-work-breakdown": {
    sv: "Minimera arbetet i huvudtråden",
    en: "Minimize main-thread work",
    es: "Minimiza el trabajo del hilo principal",
  },
  "font-display": {
    sv: "Se till att text visas medan webbfonter laddas",
    en: "Ensure text remains visible during webfont load",
    es: "Garantiza que el texto permanezca visible durante la carga de la fuente web",
  },
  "uses-long-cache-ttl": {
    sv: "Använd en effektiv cachepolicy för statiska resurser",
    en: "Serve static assets with an efficient cache policy",
    es: "Publica recursos estáticos con una política de caché eficaz",
  },
  "network-rtt": {
    sv: "Nätverkets tur-och-retur-tider",
    en: "Network round trip times",
    es: "Tiempos de ida y vuelta de la red",
  },
};

/**
 * Returns the audit title in the given UI language, mapped by Lighthouse audit
 * id. Falls back to the stored title when the id isn't in our map, so nothing
 * ever breaks or goes blank.
 */
export function localizedAuditTitle(id: string, fallback: string, language: string): string {
  const lang: Lang = language === "en" ? "en" : language === "es" ? "es" : "sv";
  return AUDIT_TITLES[id]?.[lang] ?? fallback;
}
