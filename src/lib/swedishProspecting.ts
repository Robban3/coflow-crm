// Curated option lists for company-registry prospecting filters.

// Postal "zones" = the first digit of a Swedish postnummer. This is the official
// regional grouping (approximate vs län, but accurate and simple for districts).
export const POSTAL_REGIONS: { digit: string; label: string }[] = [
  { digit: "1", label: "Stockholm med omnejd" },
  { digit: "2", label: "Skåne, Blekinge & södra Halland" },
  { digit: "3", label: "Småland, Halland & Öland" },
  { digit: "4", label: "Göteborg, Bohuslän & Skaraborg" },
  { digit: "5", label: "Östergötland & Västergötland" },
  { digit: "6", label: "Värmland, Örebro, Dalarna & Västmanland" },
  { digit: "7", label: "Uppland, Gävleborg & Dalarna" },
  { digit: "8", label: "Södra Norrland (Västernorrland, Jämtland)" },
  { digit: "9", label: "Norra Norrland (Västerbotten, Norrbotten)" },
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
