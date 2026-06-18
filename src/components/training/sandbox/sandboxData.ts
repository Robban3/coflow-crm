// Static sample data for the sandbox. Purely illustrative — never persisted.

export const sampleLeads = [
  { company: "Bygg & Co AB", contact: "Anna Lind", email: "anna@byggco.se", status: "Kontaktad", analyzed: true },
  { company: "Nordic Dental", contact: "Erik Holm", email: "erik@nordicdental.se", status: "Ej kontaktad", analyzed: true },
  { company: "Café Solsidan", contact: "Maria Ek", email: "maria@solsidan.se", status: "Möte bokat", analyzed: false },
  { company: "VVS-Experten", contact: "Johan Berg", email: "johan@vvsexperten.se", status: "Offert skickad", analyzed: true },
  { company: "Salong Lux", contact: "Sara Nyström", email: "sara@salonglux.se", status: "Ej kontaktad", analyzed: false },
];

export const statusTone: Record<string, string> = {
  "Ej kontaktad": "bg-muted text-muted-foreground",
  Kontaktad: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  "Möte bokat": "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  "Offert skickad": "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Vunnen: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
};

export const pipelineStages = [
  { name: "Aktiv", deals: [{ company: "Salong Lux", value: "12 000 kr" }, { company: "Café Solsidan", value: "8 500 kr" }] },
  { name: "Kontaktad", deals: [{ company: "Bygg & Co AB", value: "24 000 kr" }] },
  { name: "Möte bokat", deals: [{ company: "Nordic Dental", value: "35 000 kr" }] },
  { name: "Offert skickad", deals: [{ company: "VVS-Experten", value: "18 000 kr" }] },
  { name: "Vunnen", deals: [{ company: "Frisör Klipp", value: "21 000 kr" }] },
];

export const sampleEmails = [
  { from: "Anna Lind", subject: "Re: Förslag på ny hemsida", preview: "Tack för förslaget, det ser intressant ut...", time: "09:24", unread: true },
  { from: "Erik Holm", subject: "Offert tandklinik", preview: "Kan vi boka ett möte nästa vecka?", time: "Igår", unread: true },
  { from: "Maria Ek", subject: "Re: SEO-analys", preview: "Vilka konkreta steg rekommenderar ni?", time: "Igår", unread: false },
  { from: "Johan Berg", subject: "Tack för mötet", preview: "Trevligt att ses idag. Vi återkommer...", time: "Mån", unread: false },
];

export const sampleStats = [
  { label: "Mail idag", value: "12", sub: "+3 denna vecka" },
  { label: "Öppna tasks", value: "5", sub: "2 förfallna" },
  { label: "Leads", value: "148", sub: "+9 denna vecka" },
  { label: "Analyser", value: "37", sub: "den här månaden" },
];

export const powerCallLead = {
  company: "Nordic Dental",
  contact: "Erik Holm",
  phone: "+46 70 123 45 67",
  note: "Saknar bokningssystem på hemsidan. Visat intresse för SEO.",
  queue: 14,
  done: 6,
};

export const webAnalysisSite = "byggco.se";

export const webAnalysisScores = [
  { label: "SEO", value: 72 },
  { label: "Prestanda", value: 48 },
  { label: "Tillgänglighet", value: 85 },
  { label: "Bästa praxis", value: 64 },
];

export const webAnalysisFindings = [
  "Saknar metabeskrivningar på 4 sidor",
  "Bilder utan alt-text (12 st)",
  "Långsam laddningstid på mobil (4,2 s)",
  "Ingen HTTPS-omdirigering",
];

export const quoteSample = {
  number: "OFF-2026-014",
  customer: "Bygg & Co AB",
  lines: [
    { description: "Ny responsiv hemsida", qty: 1, price: 28000 },
    { description: "SEO-optimering (startpaket)", qty: 1, price: 9500 },
    { description: "Löpande drift & support / mån", qty: 12, price: 990 },
  ],
};

export const statsKpis = [
  { label: "Samtal denna vecka", value: "326" },
  { label: "Möten bokade", value: "18" },
  { label: "Vunna affärer", value: "7" },
  { label: "Omsättning", value: "214 000 kr" },
];

export const leaderboard = [
  { name: "Oliver", points: 1240 },
  { name: "Robert", points: 1115 },
  { name: "Sara", points: 980 },
  { name: "Johan", points: 870 },
];

export const sampleCustomers = [
  { company: "Frisör Klipp", contact: "Lena Ström", status: "Aktiv" },
  { company: "Bygg & Co AB", contact: "Anna Lind", status: "Aktiv" },
  { company: "Pizzeria Roma", contact: "Marco Rossi", status: "Aktiv" },
  { company: "Gamla Bilverkstan", contact: "Per Sand", status: "Avslutad" },
];

export const prospectingResults = [
  { company: "Thai Orchid", city: "Göteborg", hasWebsite: false },
  { company: "Optiker Syn", city: "Göteborg", hasWebsite: true },
  { company: "Blomsterboden", city: "Mölndal", hasWebsite: false },
  { company: "PT-Studion", city: "Göteborg", hasWebsite: true },
];

export const sampleTasks = [
  { title: "Ring upp Nordic Dental", due: "Idag 14:00", priority: "Hög", done: false },
  { title: "Skicka offert till Bygg & Co", due: "Idag 16:30", priority: "Brådskande", done: false },
  { title: "Följ upp mail – Café Solsidan", due: "Imorgon", priority: "Normal", done: false },
  { title: "Boka demo med Salong Lux", due: "Fre", priority: "Normal", done: true },
];

export const sampleTickets = [
  { title: "Hjälp med inloggning", type: "Support", status: "Öppen", priority: "Hög" },
  { title: "Förfrågan om prisplan", type: "Sälj", status: "Pågående", priority: "Normal" },
  { title: "Onboarding ny kund", type: "Onboarding", status: "Öppen", priority: "Normal" },
  { title: "Bugg i rapportvy", type: "Support", status: "Löst", priority: "Låg" },
];

export const sampleReports = [
  { title: "Webb & SEO-rapport – Bygg & Co", type: "GEO", date: "12 jun" },
  { title: "Tillväxtrapport Q2 – Nordic Dental", type: "Growth", date: "8 jun" },
  { title: "AI-synlighet – Café Solsidan", type: "GEO", date: "2 jun" },
];

export const sampleMeetings = [
  { title: "Demo av CRM", withWhom: "Erik Holm, Nordic Dental", time: "10:00", date: "Idag" },
  { title: "Uppföljning offert", withWhom: "Anna Lind, Bygg & Co", time: "13:30", date: "Idag" },
  { title: "Första möte", withWhom: "Maria Ek, Café Solsidan", time: "09:00", date: "Imorgon" },
];
