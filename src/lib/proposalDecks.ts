// Registry of proposal decks served as standalone HTML from public/proposal/.
// Each deck file is /proposal/proposal-<slug>-<lang>.html and is its own
// self-contained presentation (10 slides, PDF export via the deck's P key).
// Add an entry here whenever a new deck file is added so it shows up in the
// "Förslag" tab under Priser & paket.

export type DeckLang = "sv" | "en" | "es";

export interface ProposalDeck {
  slug: string;
  name: string;       // display name (Swedish; matches the pricing package)
  category: string;
  langs: DeckLang[];   // which language files exist
}

const ALL: DeckLang[] = ["sv", "en", "es"];

export const PROPOSAL_DECKS: ProposalDeck[] = [
  { slug: "landningssida", name: "Landningssida", category: "Hemsidor", langs: ALL },
  { slug: "foretagshemsida", name: "Företagshemsida", category: "Hemsidor", langs: ALL },
  { slug: "dynamisk-hemsida", name: "Dynamisk hemsida", category: "Hemsidor", langs: ALL },
  { slug: "e-handel-start", name: "E-handel Start", category: "E-handel", langs: ALL },
  { slug: "e-handel-plus", name: "E-handel Plus", category: "E-handel", langs: ALL },
  { slug: "e-handel-pro", name: "E-handel Pro", category: "E-handel", langs: ALL },
  { slug: "mvp", name: "MVP", category: "Produktbolag", langs: ALL },
  { slug: "webbapp", name: "Webbapp", category: "Produktbolag", langs: ALL },
  { slug: "mobilapp", name: "Mobilapp", category: "Produktbolag", langs: ALL },
  { slug: "seo-start", name: "SEO Start", category: "SEO & GEO", langs: ALL },
  { slug: "seo-tillvaxt", name: "SEO Tillväxt", category: "SEO & GEO", langs: ALL },
  { slug: "geo-ai", name: "GEO / AI-synlighet", category: "SEO & GEO", langs: ALL },
  { slug: "designpartner", name: "Designpartner", category: "Design", langs: ALL },
  { slug: "logotyp-varumarke", name: "Logotyp & varumärke", category: "Design", langs: ALL },
  { slug: "startpaket", name: "Startpaket", category: "Paket", langs: ALL },
  { slug: "tillvaxtpaket", name: "Tillväxtpaket", category: "Paket", langs: ALL },
  { slug: "mvp-paket", name: "MVP-paket", category: "Paket", langs: ALL },
  { slug: "full-digital-narvaro", name: "Full digital närvaro", category: "Paket", langs: ALL },
];

export const deckUrl = (slug: string, lang: DeckLang) =>
  `/proposal/proposal-${slug}-${lang}.html`;

export const LANG_LABEL: Record<DeckLang, string> = { sv: "SV", en: "EN", es: "ES" };
