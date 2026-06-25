// Static sample data for the sandbox. Purely illustrative — never persisted.
//
// Localised via useSandboxData(): company/contact names, emails, phone numbers,
// amounts, cities and dates stay as-is (proper nouns / data), while statuses,
// priorities, titles, labels and descriptions are translated for sv/en/es.
// Tone classNames are embedded in the items so translating a label never breaks
// a colour lookup that used to be keyed on the Swedish string.

import { useTranslation } from "@/i18n/LanguageProvider";
import type { Language } from "@/i18n/translations";

type Tr = Record<Language, string>;
const pick = (m: Tr, lang: Language) => m[lang] ?? m.sv;

const TONE = {
  muted: "bg-muted text-muted-foreground",
  blue: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  violet: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
  amber: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  emerald: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  destructive: "bg-destructive/15 text-destructive",
} as const;

// Reusable status / priority label tables.
const STATUS = {
  notContacted: { sv: "Ej kontaktad", en: "Not contacted", es: "Sin contactar" } as Tr,
  contacted: { sv: "Kontaktad", en: "Contacted", es: "Contactado" } as Tr,
  meeting: { sv: "Möte bokat", en: "Meeting booked", es: "Reunión agendada" } as Tr,
  quoteSent: { sv: "Offert skickad", en: "Quote sent", es: "Presupuesto enviado" } as Tr,
  won: { sv: "Vunnen", en: "Won", es: "Ganado" } as Tr,
  active: { sv: "Aktiv", en: "Active", es: "Activo" } as Tr,
};
const PRIO = {
  urgent: { sv: "Brådskande", en: "Urgent", es: "Urgente" } as Tr,
  high: { sv: "Hög", en: "High", es: "Alta" } as Tr,
  normal: { sv: "Normal", en: "Normal", es: "Normal" } as Tr,
  low: { sv: "Låg", en: "Low", es: "Baja" } as Tr,
};
const REL = {
  today: { sv: "Idag", en: "Today", es: "Hoy" } as Tr,
  tomorrow: { sv: "Imorgon", en: "Tomorrow", es: "Mañana" } as Tr,
  yesterday: { sv: "Igår", en: "Yesterday", es: "Ayer" } as Tr,
  mon: { sv: "Mån", en: "Mon", es: "Lun" } as Tr,
  fri: { sv: "Fre", en: "Fri", es: "Vie" } as Tr,
  jun: { sv: "jun", en: "Jun", es: "jun" } as Tr,
};

export function useSandboxData() {
  const { language: lang } = useTranslation();
  const p = (m: Tr) => pick(m, lang);

  const sampleLeads = [
    { company: "Bygg & Co AB", contact: "Anna Lind", email: "anna@byggco.se", status: p(STATUS.contacted), statusTone: TONE.blue, analyzed: true },
    { company: "Nordic Dental", contact: "Erik Holm", email: "erik@nordicdental.se", status: p(STATUS.notContacted), statusTone: TONE.muted, analyzed: true },
    { company: "Café Solsidan", contact: "Maria Ek", email: "maria@solsidan.se", status: p(STATUS.meeting), statusTone: TONE.violet, analyzed: false },
    { company: "VVS-Experten", contact: "Johan Berg", email: "johan@vvsexperten.se", status: p(STATUS.quoteSent), statusTone: TONE.amber, analyzed: true },
    { company: "Salong Lux", contact: "Sara Nyström", email: "sara@salonglux.se", status: p(STATUS.notContacted), statusTone: TONE.muted, analyzed: false },
  ];

  const pipelineStages = [
    { name: p(STATUS.active), deals: [{ company: "Salong Lux", value: "12 000 kr" }, { company: "Café Solsidan", value: "8 500 kr" }] },
    { name: p(STATUS.contacted), deals: [{ company: "Bygg & Co AB", value: "24 000 kr" }] },
    { name: p(STATUS.meeting), deals: [{ company: "Nordic Dental", value: "35 000 kr" }] },
    { name: p(STATUS.quoteSent), deals: [{ company: "VVS-Experten", value: "18 000 kr" }] },
    { name: p(STATUS.won), deals: [{ company: "Frisör Klipp", value: "21 000 kr" }] },
  ];

  const sampleEmails = [
    { from: "Anna Lind", subject: p({ sv: "Re: Förslag på ny hemsida", en: "Re: New website proposal", es: "Re: Propuesta de nuevo sitio web" }), preview: p({ sv: "Tack för förslaget, det ser intressant ut...", en: "Thanks for the proposal, looks interesting...", es: "Gracias por la propuesta, parece interesante..." }), time: "09:24", unread: true },
    { from: "Erik Holm", subject: p({ sv: "Offert tandklinik", en: "Quote dental clinic", es: "Presupuesto clínica dental" }), preview: p({ sv: "Kan vi boka ett möte nästa vecka?", en: "Can we book a meeting next week?", es: "¿Podemos agendar una reunión la próxima semana?" }), time: p(REL.yesterday), unread: true },
    { from: "Maria Ek", subject: p({ sv: "Re: SEO-analys", en: "Re: SEO analysis", es: "Re: Análisis SEO" }), preview: p({ sv: "Vilka konkreta steg rekommenderar ni?", en: "What concrete steps do you recommend?", es: "¿Qué pasos concretos recomiendan?" }), time: p(REL.yesterday), unread: false },
    { from: "Johan Berg", subject: p({ sv: "Tack för mötet", en: "Thanks for the meeting", es: "Gracias por la reunión" }), preview: p({ sv: "Trevligt att ses idag. Vi återkommer...", en: "Nice meeting today. We'll be in touch...", es: "Encantado de vernos hoy. Nos pondremos en contacto..." }), time: p(REL.mon), unread: false },
  ];

  const sampleStats = [
    { label: p({ sv: "Mail idag", en: "Emails today", es: "Correos hoy" }), value: "12", sub: p({ sv: "+3 denna vecka", en: "+3 this week", es: "+3 esta semana" }) },
    { label: p({ sv: "Öppna tasks", en: "Open tasks", es: "Tareas abiertas" }), value: "5", sub: p({ sv: "2 förfallna", en: "2 overdue", es: "2 vencidas" }) },
    { label: "Leads", value: "148", sub: p({ sv: "+9 denna vecka", en: "+9 this week", es: "+9 esta semana" }) },
    { label: p({ sv: "Analyser", en: "Analyses", es: "Análisis" }), value: "37", sub: p({ sv: "den här månaden", en: "this month", es: "este mes" }) },
  ];

  const powerCallLead = {
    company: "Nordic Dental",
    contact: "Erik Holm",
    phone: "+46 70 123 45 67",
    note: p({ sv: "Saknar bokningssystem på hemsidan. Visat intresse för SEO.", en: "No booking system on the website. Shown interest in SEO.", es: "Sin sistema de reservas en el sitio. Ha mostrado interés en SEO." }),
    queue: 14,
    done: 6,
  };

  const webAnalysisSite = "byggco.se";

  const webAnalysisScores = [
    { label: "SEO", value: 72 },
    { label: p({ sv: "Prestanda", en: "Performance", es: "Rendimiento" }), value: 48 },
    { label: p({ sv: "Tillgänglighet", en: "Accessibility", es: "Accesibilidad" }), value: 85 },
    { label: p({ sv: "Bästa praxis", en: "Best practices", es: "Buenas prácticas" }), value: 64 },
  ];

  const webAnalysisFindings = [
    p({ sv: "Saknar metabeskrivningar på 4 sidor", en: "Missing meta descriptions on 4 pages", es: "Faltan meta descripciones en 4 páginas" }),
    p({ sv: "Bilder utan alt-text (12 st)", en: "Images without alt text (12)", es: "Imágenes sin texto alternativo (12)" }),
    p({ sv: "Långsam laddningstid på mobil (4,2 s)", en: "Slow load time on mobile (4.2 s)", es: "Carga lenta en móvil (4,2 s)" }),
    p({ sv: "Ingen HTTPS-omdirigering", en: "No HTTPS redirect", es: "Sin redirección HTTPS" }),
  ];

  const quoteSample = {
    number: "OFF-2026-014",
    customer: "Bygg & Co AB",
    lines: [
      { description: p({ sv: "Ny responsiv hemsida", en: "New responsive website", es: "Nuevo sitio web responsive" }), qty: 1, price: 28000 },
      { description: p({ sv: "SEO-optimering (startpaket)", en: "SEO optimization (starter)", es: "Optimización SEO (inicial)" }), qty: 1, price: 9500 },
      { description: p({ sv: "Löpande drift & support / mån", en: "Ongoing maintenance & support / mo", es: "Mantenimiento y soporte continuo / mes" }), qty: 12, price: 990 },
    ],
  };

  const statsKpis = [
    { label: p({ sv: "Samtal denna vecka", en: "Calls this week", es: "Llamadas esta semana" }), value: "326" },
    { label: p({ sv: "Möten bokade", en: "Meetings booked", es: "Reuniones agendadas" }), value: "18" },
    { label: p({ sv: "Vunna affärer", en: "Deals won", es: "Negocios ganados" }), value: "7" },
    { label: p({ sv: "Omsättning", en: "Revenue", es: "Ingresos" }), value: "214 000 kr" },
  ];

  const leaderboard = [
    { name: "Oliver", points: 1240 },
    { name: "Robert", points: 1115 },
    { name: "Sara", points: 980 },
    { name: "Johan", points: 870 },
  ];

  // status stays a stable key ("Aktiv"/"Avslutad") – the component translates it.
  const sampleCustomers = [
    { company: "Frisör Klipp", contact: "Lena Ström", status: "Aktiv" },
    { company: "Bygg & Co AB", contact: "Anna Lind", status: "Aktiv" },
    { company: "Pizzeria Roma", contact: "Marco Rossi", status: "Aktiv" },
    { company: "Gamla Bilverkstan", contact: "Per Sand", status: "Avslutad" },
  ];

  // company + city are proper nouns – left untranslated.
  const prospectingResults = [
    { company: "Thai Orchid", city: "Göteborg", hasWebsite: false },
    { company: "Optiker Syn", city: "Göteborg", hasWebsite: true },
    { company: "Blomsterboden", city: "Mölndal", hasWebsite: false },
    { company: "PT-Studion", city: "Göteborg", hasWebsite: true },
  ];

  const sampleTasks = [
    { title: p({ sv: "Ring upp Nordic Dental", en: "Call Nordic Dental", es: "Llamar a Nordic Dental" }), due: `${p(REL.today)} 14:00`, priority: p(PRIO.high), prioTone: TONE.amber, done: false },
    { title: p({ sv: "Skicka offert till Bygg & Co", en: "Send quote to Bygg & Co", es: "Enviar presupuesto a Bygg & Co" }), due: `${p(REL.today)} 16:30`, priority: p(PRIO.urgent), prioTone: TONE.destructive, done: false },
    { title: p({ sv: "Följ upp mail – Café Solsidan", en: "Follow up email – Café Solsidan", es: "Seguimiento correo – Café Solsidan" }), due: p(REL.tomorrow), priority: p(PRIO.normal), prioTone: TONE.muted, done: false },
    { title: p({ sv: "Boka demo med Salong Lux", en: "Book demo with Salong Lux", es: "Agendar demo con Salong Lux" }), due: p(REL.fri), priority: p(PRIO.normal), prioTone: TONE.muted, done: true },
  ];

  const sampleTickets = [
    { title: p({ sv: "Hjälp med inloggning", en: "Login help", es: "Ayuda con inicio de sesión" }), type: "Support", status: p({ sv: "Öppen", en: "Open", es: "Abierto" }), statusTone: TONE.blue, priority: p(PRIO.high) },
    { title: p({ sv: "Förfrågan om prisplan", en: "Pricing plan inquiry", es: "Consulta sobre plan de precios" }), type: p({ sv: "Sälj", en: "Sales", es: "Ventas" }), status: p({ sv: "Pågående", en: "In progress", es: "En curso" }), statusTone: TONE.amber, priority: p(PRIO.normal) },
    { title: p({ sv: "Onboarding ny kund", en: "New customer onboarding", es: "Onboarding nuevo cliente" }), type: "Onboarding", status: p({ sv: "Öppen", en: "Open", es: "Abierto" }), statusTone: TONE.blue, priority: p(PRIO.normal) },
    { title: p({ sv: "Bugg i rapportvy", en: "Bug in report view", es: "Error en vista de informe" }), type: "Support", status: p({ sv: "Löst", en: "Resolved", es: "Resuelto" }), statusTone: TONE.emerald, priority: p(PRIO.low) },
  ];

  const sampleReports = [
    { title: p({ sv: "Webb & SEO-rapport – Bygg & Co", en: "Web & SEO report – Bygg & Co", es: "Informe web y SEO – Bygg & Co" }), type: "GEO", date: `12 ${p(REL.jun)}` },
    { title: p({ sv: "Tillväxtrapport Q2 – Nordic Dental", en: "Growth report Q2 – Nordic Dental", es: "Informe de crecimiento Q2 – Nordic Dental" }), type: "Growth", date: `8 ${p(REL.jun)}` },
    { title: p({ sv: "AI-synlighet – Café Solsidan", en: "AI visibility – Café Solsidan", es: "Visibilidad IA – Café Solsidan" }), type: "GEO", date: `2 ${p(REL.jun)}` },
  ];

  const sampleMeetings = [
    { title: p({ sv: "Demo av CRM", en: "CRM demo", es: "Demo del CRM" }), withWhom: "Erik Holm, Nordic Dental", time: "10:00", date: p(REL.today) },
    { title: p({ sv: "Uppföljning offert", en: "Quote follow-up", es: "Seguimiento presupuesto" }), withWhom: "Anna Lind, Bygg & Co", time: "13:30", date: p(REL.today) },
    { title: p({ sv: "Första möte", en: "First meeting", es: "Primera reunión" }), withWhom: "Maria Ek, Café Solsidan", time: "09:00", date: p(REL.tomorrow) },
  ];

  return {
    sampleLeads, pipelineStages, sampleEmails, sampleStats, powerCallLead,
    webAnalysisSite, webAnalysisScores, webAnalysisFindings, quoteSample,
    statsKpis, leaderboard, sampleCustomers, prospectingResults, sampleTasks,
    sampleTickets, sampleReports, sampleMeetings,
  };
}
