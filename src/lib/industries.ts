// Branschetiketter för UI:t.
//
// Matchningsreglerna (SNI-divisioner och fallback-termer) bor i
// supabase/functions/_shared/industry-taxonomy.ts och är källan till sanning.
// Här finns bara visningsnamnen, så reglerna inte dupliceras på två ställen.
//
// Nycklarna speglar `INDUSTRIES` i src/lib/swedishProspecting.ts, som fortsatt
// används av den befintliga prospekteringssökningen.

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

export const INDUSTRY_LABELS: Record<IndustryKey, string> = {
  bygg: "Bygg & anläggning",
  restaurang: "Restaurang & café",
  frisor: "Frisör & skönhet",
  konsult: "Konsultverksamhet",
  data: "IT & data",
  transport: "Transport & logistik",
  handel: "Handel",
  fastighet: "Fastighet",
  vard: "Vård & omsorg",
  tillverkning: "Tillverkning",
  redovisning: "Redovisning & juridik",
  reklam: "Reklam & media",
  stad: "Städ & lokalvård",
  jordbruk: "Jordbruk & skog",
  motorfordon: "Motorfordon",
};

export const INDUSTRY_OPTIONS: { value: IndustryKey; label: string }[] =
  (Object.keys(INDUSTRY_LABELS) as IndustryKey[]).map((value) => ({
    value,
    label: INDUSTRY_LABELS[value],
  }));

export function industryLabel(key: string | null | undefined): string {
  if (!key) return "—";
  return INDUSTRY_LABELS[key as IndustryKey] ?? key;
}
