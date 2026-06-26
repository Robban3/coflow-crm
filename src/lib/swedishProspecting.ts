// Curated option lists for company-registry prospecting filters.

// Swedish counties (län) approximated from the first two digits of the postnummer.
// Postal codes don't align perfectly with county borders, so a handful of
// companies near a border may be mis-classified — good enough for districting.
// `code` is the official county letter; `prefixes` are 2-digit postnummer prefixes.
export const COUNTIES: { code: string; name: string; prefixes: string[] }[] = [
  { code: "AB", name: "Stockholms län", prefixes: ["10", "11", "12", "13", "14", "15", "16", "17", "18", "19"] },
  { code: "C", name: "Uppsala län", prefixes: ["74", "75"] },
  { code: "D", name: "Södermanlands län", prefixes: ["61", "63", "64"] },
  { code: "E", name: "Östergötlands län", prefixes: ["58", "59", "60"] },
  { code: "F", name: "Jönköpings län", prefixes: ["33", "55", "56", "57"] },
  { code: "G", name: "Kronobergs län", prefixes: ["34", "35", "36"] },
  { code: "H", name: "Kalmar län", prefixes: ["38", "39"] },
  { code: "I", name: "Gotlands län", prefixes: ["62"] },
  { code: "K", name: "Blekinge län", prefixes: ["37"] },
  { code: "M", name: "Skåne län", prefixes: ["20", "21", "22", "23", "24", "25", "26", "27", "28", "29"] },
  { code: "N", name: "Hallands län", prefixes: ["30", "31", "43"] },
  { code: "O", name: "Västra Götalands län", prefixes: ["40", "41", "42", "44", "45", "46", "47", "50", "51", "52", "53", "54"] },
  { code: "S", name: "Värmlands län", prefixes: ["65", "66", "67", "68", "69"] },
  { code: "T", name: "Örebro län", prefixes: ["70", "71"] },
  { code: "U", name: "Västmanlands län", prefixes: ["72", "73"] },
  { code: "W", name: "Dalarnas län", prefixes: ["77", "78", "79"] },
  { code: "X", name: "Gävleborgs län", prefixes: ["80", "81", "82"] },
  { code: "Y", name: "Västernorrlands län", prefixes: ["85", "86", "87", "88", "89"] },
  { code: "Z", name: "Jämtlands län", prefixes: ["83", "84"] },
  { code: "AC", name: "Västerbottens län", prefixes: ["90", "91", "92", "93"] },
  { code: "BD", name: "Norrbottens län", prefixes: ["94", "95", "96", "97", "98"] },
];

// Each value is an ILIKE keyword matched against company_form (a substring that
// is safe across the small spelling variations in the registry data).
export const COMPANY_FORMS: { value: string; label: string }[] = [
  { value: "Aktiebolag", label: "Aktiebolag (AB)" },
  { value: "Handelsbolag", label: "Handelsbolag (HB)" },
  { value: "Kommanditbolag", label: "Kommanditbolag (KB)" },
  { value: "Enskild", label: "Enskild firma" },
  { value: "Ekonomisk förening", label: "Ekonomisk förening" },
  { value: "Bostadsrättsförening", label: "Bostadsrättsförening" },
  { value: "Ideell förening", label: "Ideell förening" },
  { value: "Stiftelse", label: "Stiftelse" },
  { value: "Filial", label: "Filial" },
];

// Common industries; value is an ILIKE keyword matched against sni_descriptions.
export const INDUSTRIES: { value: string; label: string }[] = [
  { value: "bygg", label: "Bygg & anläggning" },
  { value: "restaurang", label: "Restaurang & café" },
  { value: "frisör", label: "Frisör & skönhet" },
  { value: "konsult", label: "Konsultverksamhet" },
  { value: "data", label: "IT & data" },
  { value: "transport", label: "Transport & logistik" },
  { value: "handel", label: "Handel & detaljhandel" },
  { value: "fastighet", label: "Fastighet" },
  { value: "vård", label: "Vård & hälsa" },
  { value: "tillverkning", label: "Tillverkning & industri" },
  { value: "redovisning", label: "Redovisning & ekonomi" },
  { value: "reklam", label: "Reklam & marknadsföring" },
  { value: "städ", label: "Städ & fastighetsservice" },
  { value: "jordbruk", label: "Jordbruk & skog" },
  { value: "motorfordon", label: "Bil & verkstad" },
];
