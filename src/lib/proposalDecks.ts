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

export const PROPOSAL_DECKS: ProposalDeck[] = [
  { slug: "foretagshemsida", name: "Företagshemsida", category: "Hemsidor", langs: ["sv"] },
];

export const deckUrl = (slug: string, lang: DeckLang) =>
  `/proposal/proposal-${slug}-${lang}.html`;

export const LANG_LABEL: Record<DeckLang, string> = { sv: "SV", en: "EN", es: "ES" };
