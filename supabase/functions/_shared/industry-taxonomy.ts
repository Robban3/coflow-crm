// Branschtaxonomi — källan till sanning för hur en bransch matchas mot
// företagsregistret.
//
// Bakgrund: systemet har idag fyra oförenliga representationer av "bransch" —
// lead_pool.industry (fritext), lead_pool.sni_codes (text[]),
// company_registry.sni_codes (text, rå CSV-sträng) och sni_descriptions
// (fritext). Och `INDUSTRIES` i src/lib/swedishProspecting.ts, som är 15 svenska
// ILIKE-stammar. Ingen av dem är en nyckel man kan filtrera exakt på.
//
// Här definieras nycklarna en gång. `sniDivisions` är SNI:ns två första siffror
// (den grovhet en bransch faktiskt motsvarar) och används mot det indexerade
// company_registry.sni_division. `terms` är fallback via trigram mot
// sni_descriptions/business_description för rader som saknar SNI-kod — vilket
// gäller alla rader som kommit från Bolagsverket snarare än CSV-importen.
//
// Nycklarna speglar de 15 posterna i src/lib/swedishProspecting.ts så
// vokabulären känns igen. Etiketter bor i src/lib/industries.ts (frontend).

export type IndustryKey =
  | "bygg"
  | "restaurang"
  | "frisor"
  | "konsult"
  | "data"
  | "transport"
  | "handel"
  | "fastighet"
  | "vard"
  | "tillverkning"
  | "redovisning"
  | "reklam"
  | "stad"
  | "jordbruk"
  | "motorfordon";

export type IndustryDef = {
  /** SNI-divisioner (två första siffrorna) enligt SNI 2007. */
  sniDivisions: string[];
  /** Fallback-termer för trigrammatchning när SNI-kod saknas. */
  terms: string[];
};

export const INDUSTRY_TAXONOMY: Record<IndustryKey, IndustryDef> = {
  bygg: {
    sniDivisions: ["41", "42", "43"],
    terms: ["bygg", "anläggning", "entreprenad", "snickeri", "vvs", "elinstallation"],
  },
  restaurang: {
    sniDivisions: ["56"],
    terms: ["restaurang", "café", "catering", "pizzeria", "bar"],
  },
  frisor: {
    // 96 = andra konsumenttjänster, där frisör och skönhetsvård ligger.
    sniDivisions: ["96"],
    terms: ["frisör", "skönhet", "hårvård", "salong", "massage", "hudvård"],
  },
  konsult: {
    sniDivisions: ["70", "71", "74"],
    terms: ["konsult", "rådgivning", "management"],
  },
  data: {
    sniDivisions: ["62", "63"],
    terms: ["data", "it-", "programmering", "webb", "mjukvara", "system"],
  },
  transport: {
    sniDivisions: ["49", "50", "51", "52", "53"],
    terms: ["transport", "åkeri", "logistik", "budfirma", "spedition"],
  },
  handel: {
    sniDivisions: ["45", "46", "47"],
    terms: ["handel", "detaljhandel", "partihandel", "butik"],
  },
  fastighet: {
    sniDivisions: ["68"],
    terms: ["fastighet", "förvaltning", "mäklare", "uthyrning"],
  },
  vard: {
    sniDivisions: ["86", "87", "88"],
    terms: ["vård", "omsorg", "tandläkare", "klinik", "sjukgymnast", "terapi"],
  },
  tillverkning: {
    sniDivisions: ["10", "13", "16", "22", "23", "25", "31", "32", "33"],
    terms: ["tillverkning", "produktion", "industri", "verkstad"],
  },
  redovisning: {
    sniDivisions: ["69"],
    terms: ["redovisning", "revision", "bokföring", "juridik", "advokat"],
  },
  reklam: {
    sniDivisions: ["73"],
    terms: ["reklam", "marknadsföring", "media", "kommunikation", "byrå"],
  },
  stad: {
    sniDivisions: ["81"],
    terms: ["städ", "lokalvård", "fönsterputs", "sanering"],
  },
  jordbruk: {
    sniDivisions: ["01", "02", "03"],
    terms: ["jordbruk", "lantbruk", "skogsbruk", "trädgård", "odling"],
  },
  motorfordon: {
    sniDivisions: ["45"],
    terms: ["bilverkstad", "motorfordon", "bilhandel", "däck", "bilservice"],
  },
};

export const INDUSTRY_KEYS = Object.keys(INDUSTRY_TAXONOMY) as IndustryKey[];

export function isIndustryKey(v: unknown): v is IndustryKey {
  return typeof v === "string" && v in INDUSTRY_TAXONOMY;
}
