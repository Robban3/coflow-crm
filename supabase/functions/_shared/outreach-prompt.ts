/**
 * Shared outreach prompt module.
 * Generates VALUE-DRIVEN, conversion-optimised cold emails.
 * 
 * CORE PRINCIPLE: Show the prospect you understand their BUSINESS,
 * then present ONE specific growth opportunity.
 */

// ── helpers ──────────────────────────────────────────────────────────

export type Market = "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" | "AU" | "IE" | "MX" | "AR";

// Appended to the (reused) English prompt for the Korean market so the model
// writes the actual email in professional Korean regardless of the instruction
// language. Korean where it counts (the customer-facing copy); the scaffolding
// stays English.
const KR_LANGUAGE_OVERRIDE = `

LANGUAGE OVERRIDE (HIGHEST PRIORITY): Ignore any instruction above to write in English. Write BOTH the "subject" and the body ENTIRELY in natural, professional Korean (한국어), using formal business register (존댓말/하십시오체). Greeting: "[이름]님, 안녕하세요." when a real person's name is given, otherwise "안녕하세요,". No emojis, no clichés. Keep the exact JSON output format specified above.`;

export interface OutreachContext {
  companyName?: string;
  contactName?: string;
  customPrompt?: string;
  tone?: string;
  context?: "initial" | "follow_up";
  market?: Market;

  // analysis data (all optional)
  webAnalysis?: {
    performanceScore?: number;
    seoScore?: number;
    accessibilityScore?: number;
    bestPracticesScore?: number;
  };
  geoAnalysis?: {
    geoScore?: number;
    summary?: string;
    domain?: string;
  };
  seoIntelligence?: {
    visibilityScore?: number;
    summary?: string;
    opportunities?: string;
    keywords?: Array<{ keyword: string; position: number; volume: number }>;
  };
  fleetData?: {
    vehicleCount?: number;
    leasingCompany?: string;
    vehicles?: any[];
  };
  telephonyData?: {
    subscriptionCount?: number;
    operator?: string;
    phoneNumbers?: any[];
  };
  serviceProfile?: {
    industry: string;
    description: string;
  };
  websiteContent?: string;
  websiteInsights?: string[];

  // detected problems from auto-enrich scoring
  detectedProblems?: Array<{
    key: string;
    label: string;
    value: string | null;
    weight: number;
  }>;

  // business context from crawl
  businessSummary?: string;

  // sequence context (optional)
  stepNumber?: number;
  totalSteps?: number;
  stepPrompt?: string;

  // sender identity (for context, NOT for signature)
  senderName?: string;
  senderCompany?: string;
}

// Tone instructions
const toneInstructions: Record<string, string> = {
  standard: "Konsultativ, personlig och hjälpsam. Som en kunnig kollega som genuint vill hjälpa – aldrig säljig.",
  familiar: "Varm och personlig, som att du redan har en relation.",
  informative: "Pedagogisk och insiktsfull, visar expertis utan att bli en föreläsning.",
  direct: "Rak och koncis men fortfarande med substans och värme. Håll dig kort, ca 90 ord.",
};

// ── system prompt ────────────────────────────────────────────────────

export function buildOutreachSystemPrompt(ctx: OutreachContext): string {
  const market: Market = ctx.market || "SE";
  if (ctx.context === "follow_up") {
    return buildFollowUpSystemPrompt(ctx);
  }
  // Non-Swedish markets use a streamlined market-specific prompt
  if (market === "KR") return buildUSSystemPrompt(ctx) + KR_LANGUAGE_OVERRIDE;
  if ((market === "US" || market === "UK" || market === "CA" || market === "AU" || market === "IE")) return buildUSSystemPrompt(ctx);
  if (market === "DE") return buildDESystemPrompt(ctx);
  if (market === "ES" || market === "MX" || market === "AR") return buildESSystemPrompt(ctx);

  const tone = toneInstructions[ctx.tone || "standard"] || toneInstructions.standard;

  const serviceSection = ctx.serviceProfile?.description
    ? `\nDU REPRESENTERAR:\nBransch: ${ctx.serviceProfile.industry}\nTjänst: ${ctx.serviceProfile.description}\n`
    : "";

  // Build sender identity block
  const senderFullName = ctx.senderName || "";
  const senderFirstName = senderFullName.split(" ")[0] || "";
  const senderCompany = ctx.senderCompany || "";
  let senderBlock = "";
  if (senderFirstName || senderCompany) {
    senderBlock = `\nAVSÄNDARE (använd EXAKT dessa uppgifter i inledningen):`;
    if (senderFirstName) senderBlock += `\nFörnamn: ${senderFirstName}`;
    if (senderCompany) senderBlock += `\nFöretag: ${senderCompany}`;
    senderBlock += `\nVIKTIGT: Använd BARA förnamnet i presentationen – ALDRIG efternamn. Det blir mer personligt och mindre stelt.`;
    senderBlock += `\nHITTA ALDRIG PÅ namn eller företagsnamn. Använd EXAKT det som står ovan.\n`;
  }

  return `Du skriver personliga, hjälpsamma kalla mail på svenska som ska få mottagaren att vilja ta ett kort möte.

TONALITET: ${tone}
${serviceSection}${senderBlock}
GRUNDIDÉ – "KONSULTATIV & NYFIKEN":
Skriv som en kunnig kollega som råkat titta på deras verksamhet, sett något specifikt och har EN konkret idé – inte som en säljare och inte som en oombedd revision. Målet är ett kort möte, men mailet ska kännas som att du vill hjälpa, inte sälja.

SÅ HÄR SKRIVER DU:
- Öppna med en ÄKTA, SPECIFIK observation om deras sajt/verksamhet i vanlig text. Något du faktiskt lagt märke till – inte en generisk komplimang.
- Undvik sifferbetyg som huvudpoäng. Skriv hellre "sidan laddar lite trögt på mobilen" än "prestanda 56/100". En siffra får nämnas lättsamt om den gör observationen mer konkret, men aldrig som ett facit eller en lista med poäng.
- Föreslå EN konkret idé eller möjlighet, formulerad som ett förslag ("en sak som ofta gör skillnad är …"), och antyd kort vad den skulle ge dem (fler förfrågningar, enklare för kunder att boka, osv). Formulera det som en möjlighet – aldrig som ett problem, fel eller "flaskhals".
- Var specifik för DERAS bransch, inte generisk.

STRUKTUR (skriv naturligt, inga rubriker):

1) INLEDNING + OBSERVATION (2-3 meningar)
   – Presentera dig kort med BARA ditt förnamn och företag (se AVSÄNDARE ovan).
   – Väv in din specifika observation om deras sajt/verksamhet.
   – ALDRIG: skriv mottagarens FÖRETAGSNAMN i öppningsfrasen.
   – ALDRIG: berätta för mottagaren sånt de redan vet om sig själva.

2) KONKRET IDÉ (2-3 meningar)
   – Dela EN konkret idé eller möjlighet kopplad till observationen.
   – Antyd kort vad det skulle ge dem – konkret och branschnära.

3) LÅG-TRÖSKEL MÖTESFRÅGA (1-2 meningar)
   – Fråga rakt men lättsamt om ett kort möte, t.ex. "Har du 15 minuter nästa vecka så visar jag hur jag tänker?"
   – Låg tröskel, ingen press, lätt att tacka ja till.

ABSOLUTA REGLER:
- Skriv ca 110-140 ord i brödtexten (exklusive hälsning).
- Hälsning: EXAKT "Hej [Förnamn]," om kontaktpersonen är en PERSONS namn. Om kontaktnamnet ser ut som ett FÖRETAGSNAMN eller saknas: EXAKT "Hej,".
- AVSÄNDARNAMN: Använd EXAKT det namn som anges under AVSÄNDARE. Hitta ALDRIG PÅ namn.
- FÖRETAGSNAMN I INLEDNING: Nämn ALDRIG mottagarens företagsnamn i öppningsfrasen.
- Styckeindelning: Använd tomrader mellan stycken. Max 3-4 rader per stycke.
- Skriv som en RIKTIG PERSON – ledigt och äkta, inte som en robot och inte som en broschyr.
- FÖRBJUDNA fraser (säljklyschor och slitna öppningar): "i dagens digitala", "hoppas detta", "jag noterade att", "vill bara höra av mig", "råkade se", "stötte på", "med ert unika", "med ert fokus", "ni har byggt en stark", "er position inom", "revolutionera", "ta er till nästa nivå", "boosta", "vi är experter på", "kostnadsfri analys", "unik möjlighet", "lyfta er verksamhet".
- Inga emojis. Inga klyschor. Inget överdrivet beröm.
- Variera VARJE mail – aldrig identiska formuleringar.
- INGEN signatur, INGET avslutande namn. Signaturen läggs på automatiskt.
- Använd REGIONALA eller BRANSCHÖVERGRIPANDE referenser – INTE hyperspecifika lokala ortsnamn om företaget inte är i en storstad.

Svara EXAKT som JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}
body_without_signature = ren text med \\n för radbrytningar, UTAN signatur/namn.`;
}

// ── market-specific system prompts (US / DE) ─────────────────────────

function buildSenderBlockEN(ctx: OutreachContext): string {
  const firstName = (ctx.senderName || "").split(" ")[0] || "";
  const company = ctx.senderCompany || "";
  if (!firstName && !company) return "";
  let s = `\nSENDER (use EXACTLY these details):`;
  if (firstName) s += `\nFirst name: ${firstName}`;
  if (company) s += `\nCompany: ${company}`;
  s += `\nIMPORTANT: Use ONLY the first name. Never invent names or companies.\n`;
  return s;
}

function buildSenderBlockDE(ctx: OutreachContext): string {
  const firstName = (ctx.senderName || "").split(" ")[0] || "";
  const company = ctx.senderCompany || "";
  if (!firstName && !company) return "";
  let s = `\nABSENDER (verwenden Sie GENAU diese Angaben):`;
  if (firstName) s += `\nVorname: ${firstName}`;
  if (company) s += `\nUnternehmen: ${company}`;
  s += `\nWICHTIG: Verwenden Sie NUR den Vornamen. Erfinden Sie niemals Namen oder Unternehmen.\n`;
  return s;
}

function buildUSSystemPrompt(ctx: OutreachContext): string {
  const senderBlock = buildSenderBlockEN(ctx);
  const serviceSection = ctx.serviceProfile?.description
    ? `\nYOU REPRESENT:\nIndustry: ${ctx.serviceProfile.industry}\nService: ${ctx.serviceProfile.description}\n`
    : "";

  return `You write personal, genuinely helpful cold emails in American English. Write like a knowledgeable colleague who looked at their business, noticed something specific, and has ONE concrete idea — not like a salesperson and not like an unsolicited audit. The goal is a short meeting, but the email should feel like you want to help, not sell.
${serviceSection}${senderBlock}
HOW TO WRITE:
- Open with a GENUINE, SPECIFIC observation about their site/business in plain language — something you actually noticed, not a generic compliment.
- Don't lead with numeric scores. Prefer "your site loads a little slowly on mobile" over "performance 56/100". A number can be mentioned lightly if it makes the observation concrete, never as a scorecard or a list of ratings.
- Offer ONE concrete idea or opportunity, framed as a suggestion ("one thing that often helps is …"), and hint at what it would give them (more enquiries, easier for customers to book, etc). Frame it as an opportunity — never as a problem or fault.
- Be specific to THEIR industry, not generic.

STRUCTURE (write naturally, no headers): (1) short intro + specific observation, (2) one concrete idea and what it would give them, (3) a low-friction meeting ask.

RULES:
- Around 110-140 words in the body.
- End with a concrete, low-threshold meeting ask, e.g. "Do you have 15 minutes next week and I'll walk you through my thinking?".
- Greeting: "Hi [FirstName]," if a real person's name is given, otherwise "Hi,".
- Write like a REAL PERSON — relaxed and genuine, not a robot or a brochure.
- No emojis, no clichés, no "I hope this finds you well". Avoid salesy phrases: "revolutionize", "take you to the next level", "boost", "we are experts in", "free audit", "unique opportunity".
- NO signature, NO closing name — added automatically.

Respond EXACTLY as JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
}

function buildDESystemPrompt(ctx: OutreachContext): string {
  const senderBlock = buildSenderBlockDE(ctx);
  const serviceSection = ctx.serviceProfile?.description
    ? `\nSIE VERTRETEN:\nBranche: ${ctx.serviceProfile.industry}\nLeistung: ${ctx.serviceProfile.description}\n`
    : "";

  return `Sie schreiben persönliche, wirklich hilfreiche Kaltakquise-E-Mails auf Deutsch. Schreiben Sie wie ein sachkundiger Kollege, der sich das Unternehmen angesehen, etwas Konkretes bemerkt hat und EINE konkrete Idee hat — nicht wie ein Verkäufer und nicht wie ein unaufgefordertes Audit. Ziel ist ein kurzes Gespräch, aber die E-Mail soll hilfsbereit wirken, nicht verkäuferisch. Verwenden Sie durchgehend die Anrede "Sie".
${serviceSection}${senderBlock}
SO SCHREIBEN SIE:
- Beginnen Sie mit einer ECHTEN, KONKRETEN Beobachtung zur Website/zum Unternehmen in einfacher Sprache — etwas, das Ihnen wirklich aufgefallen ist, kein generisches Kompliment.
- Führen Sie NICHT mit Zahlenwerten. Lieber "Ihre Seite lädt auf dem Handy etwas langsam" als "Performance 56/100". Eine Zahl darf beiläufig fallen, nie als Zeugnis oder Punkteliste.
- Bieten Sie EINE konkrete Idee oder Chance an, als Vorschlag formuliert ("was oft hilft, ist …"), und deuten Sie den Nutzen an. Als Chance formulieren — nie als Problem oder Fehler.
- Konkret für DEREN Branche, nicht generisch.

STRUKTUR (natürlich schreiben, keine Überschriften): (1) kurze Einleitung + konkrete Beobachtung, (2) eine konkrete Idee und ihr Nutzen, (3) eine niedrigschwellige Gesprächsanfrage.

REGELN:
- Etwa 110-140 Wörter im Text.
- Schließen Sie mit einer konkreten, niedrigschwelligen Gesprächsanfrage, z. B. "Haben Sie nächste Woche 15 Minuten, dann zeige ich Ihnen meinen Gedanken?".
- Anrede: "Sehr geehrte/r [Vorname]," wenn ein Personenname genannt ist, sonst "Guten Tag,".
- Schreiben Sie wie ein ECHTER MENSCH — locker und echt, nicht wie ein Roboter oder eine Broschüre.
- Keine Emojis, keine Floskeln. Vermeiden Sie Verkaufsphrasen: "revolutionieren", "auf das nächste Level", "boosten", "wir sind Experten für", "kostenlose Analyse", "einzigartige Chance".
- KEINE Signatur, KEIN abschließender Name — wird automatisch hinzugefügt.

Antworten Sie GENAU als JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
}

function buildSenderBlockES(ctx: OutreachContext): string {
  const firstName = (ctx.senderName || "").split(" ")[0] || "";
  const company = ctx.senderCompany || "";
  if (!firstName && !company) return "";
  let s = `\nREMITENTE (usa EXACTAMENTE estos datos):`;
  if (firstName) s += `\nNombre: ${firstName}`;
  if (company) s += `\nEmpresa: ${company}`;
  s += `\nIMPORTANTE: Usa SOLO el nombre de pila. Nunca inventes nombres ni empresas.\n`;
  return s;
}

function buildESSystemPrompt(ctx: OutreachContext): string {
  const senderBlock = buildSenderBlockES(ctx);
  const serviceSection = ctx.serviceProfile?.description
    ? `\nREPRESENTAS A:\nSector: ${ctx.serviceProfile.industry}\nServicio: ${ctx.serviceProfile.description}\n`
    : "";

  return `Escribes correos en frío personales y genuinamente útiles en español. Escribe como un colega con conocimiento que miró su negocio, notó algo específico y tiene UNA idea concreta — no como un comercial ni como una auditoría no solicitada. El objetivo es una reunión corta, pero el correo debe sentirse como que quieres ayudar, no vender.
${serviceSection}${senderBlock}
CÓMO ESCRIBIR:
- Empieza con una observación GENUINA y ESPECÍFICA sobre su web/negocio en lenguaje sencillo — algo que realmente notaste, no un cumplido genérico.
- No lideres con puntuaciones numéricas. Mejor "tu web carga un poco lenta en el móvil" que "rendimiento 56/100". Un número puede mencionarse de pasada si hace la observación más concreta, nunca como una nota o lista de puntajes.
- Ofrece UNA idea u oportunidad concreta, formulada como sugerencia ("algo que suele marcar la diferencia es …"), e insinúa qué les daría. Formúlalo como oportunidad — nunca como problema o fallo.
- Sé específico para SU sector, no genérico.

ESTRUCTURA (escribe con naturalidad, sin encabezados): (1) intro breve + observación específica, (2) una idea concreta y qué les daría, (3) una petición de reunión de baja fricción.

REGLAS:
- Alrededor de 110-140 palabras en el cuerpo.
- Cierra con una petición de reunión concreta y de baja exigencia, p. ej. "¿Tienes 15 minutos la próxima semana y te enseño cómo lo veo?".
- Saludo: "Hola [Nombre]," si se da el nombre de una persona real, si no "Hola,".
- Escribe como una PERSONA REAL — cercano y auténtico, no como un robot ni un folleto.
- Sin emojis, sin clichés. Evita frases de venta: "revolucionar", "llevaros al siguiente nivel", "impulsar", "somos expertos en", "análisis gratuito", "oportunidad única".
- SIN firma, SIN nombre de cierre — se añade automáticamente.

Responde EXACTAMENTE como JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
}


function buildFollowUpSystemPrompt(ctx: OutreachContext): string {
  const tone = toneInstructions[ctx.tone || "standard"] || toneInstructions.standard;
  const market: Market = ctx.market || "SE";

  if ((market === "US" || market === "UK" || market === "KR" || market === "CA" || market === "AU" || market === "IE")) {
    const senderBlock = buildSenderBlockEN(ctx);
    const base = `You are writing a FOLLOW-UP cold email in American English. You contacted this company BEFORE but got no reply.

TONE: ${tone}
${senderBlock}
FOLLOW-UP STRATEGY:
- Briefly reference that you reached out before (without being pushy).
- Do NOT repeat the same pitch — share a NEW concrete observation or idea, framed as an opportunity.
- Shorter than the first email (80-150 words). Keep it helpful and low-key, never salesy.
- End with a low-threshold meeting ask, e.g. "Do you have 15 minutes this week?".
- Greeting: "Hi [FirstName]," if a real person's name is given, otherwise "Hi,".
- NO signature (added automatically), no emojis, no clichés.
- BANNED phrases: "just following up", "just checking in", "circling back".

Respond EXACTLY as JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
    return market === "KR" ? base + KR_LANGUAGE_OVERRIDE : base;
  }

  if (market === "DE") {
    const senderBlock = buildSenderBlockDE(ctx);
    return `Sie schreiben eine FOLLOW-UP E-Mail auf Deutsch. Sie haben dieses Unternehmen BEREITS kontaktiert, aber keine Antwort erhalten.

TONALITÄT: ${tone}
${senderBlock}
FOLLOW-UP-STRATEGIE:
- Verweisen Sie kurz darauf, dass Sie sich bereits gemeldet haben (ohne aufdringlich zu sein).
- Wiederholen Sie NICHT dasselbe — teilen Sie eine NEUE konkrete Beobachtung oder Idee, als Chance formuliert.
- Kürzer als die erste E-Mail (80-150 Wörter). Hilfsbereit und zurückhaltend, nie verkäuferisch.
- Schließen Sie mit einer niedrigschwelligen Gesprächsanfrage, z. B. "Haben Sie diese Woche 15 Minuten?".
- Anrede: "Sehr geehrte/r [Vorname]," bei einer Person, sonst "Guten Tag,". Verwenden Sie "Sie".
- KEINE Signatur (wird automatisch ergänzt), keine Emojis, keine Floskeln.

Antworten Sie GENAU als JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
  }

  if (market === "ES" || market === "MX" || market === "AR") {
    const senderBlock = buildSenderBlockES(ctx);
    return `Escribes un correo de SEGUIMIENTO en español. Ya contactaste a esta empresa ANTES pero no obtuviste respuesta.

TONO: ${tone}
${senderBlock}
ESTRATEGIA DE SEGUIMIENTO:
- Menciona brevemente que ya te pusiste en contacto (sin ser insistente).
- NO repitas lo mismo — comparte una NUEVA observación o idea concreta, formulada como oportunidad.
- Más corto que el primer correo (80-150 palabras). Útil y discreto, nunca comercial.
- Cierra con una petición de reunión de baja exigencia, p. ej. "¿Tienes 15 minutos esta semana?".
- Saludo: "Hola [Nombre]," si se da el nombre de una persona real, si no "Hola,".
- SIN firma (se añade automáticamente), sin emojis, sin clichés.
- Frases PROHIBIDAS: "solo quería hacer seguimiento", "solo para saber cómo va".

Responde EXACTAMENTE como JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
  }

  const senderFullName = ctx.senderName || "";
  const senderFirstName = senderFullName.split(" ")[0] || "";
  const senderCompany = ctx.senderCompany || "";
  let senderBlock = "";
  if (senderFirstName || senderCompany) {
    senderBlock = `\nAVSÄNDARE:`;
    if (senderFirstName) senderBlock += `\nFörnamn: ${senderFirstName}`;
    if (senderCompany) senderBlock += `\nFöretag: ${senderCompany}`;
    senderBlock += `\n`;
  }

  return `Du skriver ett UPPFÖLJNINGSMAIL på svenska. Du har kontaktat detta företag TIDIGARE men inte fått svar.

TONALITET: ${tone}
${senderBlock}
VIKTIGT – UPPFÖLJNINGSSTRATEGI:
- Referera kort till att du hört av dig tidigare (utan att vara påträngande)
- UPPREPA INTE samma sak – kom med en NY konkret observation eller idé, formulerad som en möjlighet
- Var kortare än första mailet (80-150 ord)
- Håll det hjälpsamt och lågmält – aldrig säljigt eller pressande

STRUKTUR:
1) KORT PÅMINNELSE (1 mening) – "Jag hörde av mig för ett tag sedan angående..."
2) NY VINKEL (2-3 meningar) – En ny konkret idé eller observation, formulerad som en möjlighet
3) LÅG-TRÖSKEL MÖTESFRÅGA (1 mening) – Enkel fråga om ett kort möte, t.ex. "Har du 15 minuter i veckan?"

REGLER:
- 80-150 ord i brödtexten
- Hälsning: "Hej [Förnamn]," om person, annars "Hej,"
- INGEN signatur – läggs på automatiskt
- Inga emojis, inga klyschor, inget säljspråk
- FÖRBJUDNA fraser: "bara ville följa upp", "checka in", "ville bara kolla"

Svara EXAKT som JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}`;
}

// ── user prompt ──────────────────────────────────────────────────────

export function buildOutreachUserPrompt(ctx: OutreachContext): string {
  const market: Market = ctx.market || "SE";
  const parts: string[] = [];

  if (ctx.context === "follow_up") {
    parts.push(
      (market === "US" || market === "UK" || market === "KR" || market === "CA" || market === "AU" || market === "IE")
        ? "Write a FOLLOW-UP email. You contacted them before but got no reply.\n"
        : market === "DE"
        ? "Schreiben Sie eine FOLLOW-UP E-Mail. Sie haben den Empfänger bereits kontaktiert, aber keine Antwort erhalten.\n"
        : (market === "ES" || market === "MX" || market === "AR")
        ? "Escribe un correo de SEGUIMIENTO. Ya los contactaste antes pero no obtuviste respuesta.\n"
        : "Skriv ETT UPPFÖLJNINGSMAIL. Du har kontaktat dem förut men inte fått svar.\n",
    );
  } else {
    parts.push(
      (market === "US" || market === "UK" || market === "KR" || market === "CA" || market === "AU" || market === "IE")
        ? "Write ONE outreach email based on the data below.\n"
        : market === "DE"
        ? "Schreiben Sie EINE Outreach-E-Mail basierend auf den folgenden Daten.\n"
        : (market === "ES" || market === "MX" || market === "AR")
        ? "Escribe UN correo de prospección basado en los datos siguientes.\n"
        : "Skriv ETT outreach-mail baserat på nedan.\n",
    );
  }

  if (ctx.contactName) {
    // Check if contactName looks like a company name rather than a person
    const looksLikeCompany = /\b(AB|HB|KB|Inc|Ltd|GmbH|Oy|AS|ApS|Handelsbolag|Aktiebolag|Restaurang|Hotell|Fastighets|Bygg|Städ|Service|Konsult)\b/i.test(ctx.contactName)
      || (ctx.companyName && ctx.contactName.toLowerCase().trim() === ctx.companyName.toLowerCase().trim());
    if (looksLikeCompany) {
      parts.push(`Kontaktperson: SAKNAS (OBS: "${ctx.contactName}" är ett FÖRETAGSNAMN, INTE en person – använd "Hej," utan namn)`);
    } else {
      parts.push(`Kontaktperson: ${ctx.contactName}`);
    }
  }
  parts.push(`Företag: ${ctx.companyName || "Okänt företag"}`);

  // Custom directive
  if (ctx.customPrompt) {
    parts.push(`EXTRA DIREKTIV: "${ctx.customPrompt}"\n`);
  }

  // Sequence context
  if (ctx.stepNumber && ctx.totalSteps) {
    parts.push(`Mail ${ctx.stepNumber} av ${ctx.totalSteps} i en sekvens.`);
    if (ctx.stepNumber === 1) parts.push("Första kontakten.\n");
    else if (ctx.stepNumber === ctx.totalSteps) parts.push("Sista försöket.\n");
    else parts.push("Uppföljning.\n");
    if (ctx.stepPrompt) parts.push(`Instruktion: "${ctx.stepPrompt}"\n`);
  }

  // Service profile
  if (ctx.serviceProfile?.description) {
    parts.push(`DIN TJÄNST (${ctx.serviceProfile.industry}):`);
    parts.push(`${ctx.serviceProfile.description}\n`);
  }

  // Business summary – MOST IMPORTANT
  if (ctx.businessSummary) {
    parts.push("OM FÖRETAGET:");
    parts.push(ctx.businessSummary);
    parts.push("→ Använd detta för att personalisera mailet.\n");
  }

  // Website content as secondary context
  if (ctx.websiteContent) {
    parts.push("HEMSIDEINNEHÅLL (bakgrund, nämn inte att du läst den):");
    parts.push(ctx.websiteContent.substring(0, 600));
    parts.push("");
  }

  // ── ANALYSIS DATA: Give AI the raw scores to use in "praise + challenge" format ──
  if (ctx.webAnalysis) {
    const wa = ctx.webAnalysis;
    const labels = (market === "US" || market === "UK" || market === "KR" || market === "CA" || market === "AU" || market === "IE")
      ? { performance: "Performance", seo: "SEO", a11y: "Accessibility", bp: "Best Practices" }
      : market === "DE"
      ? { performance: "Performance", seo: "SEO", a11y: "Barrierefreiheit", bp: "Best Practices" }
      : (market === "ES" || market === "MX" || market === "AR")
      ? { performance: "Rendimiento", seo: "SEO", a11y: "Accesibilidad", bp: "Buenas prácticas" }
      : { performance: "Prestanda", seo: "SEO", a11y: "Tillgänglighet", bp: "Best Practices" };

    const analyzedScores = [
      { label: labels.performance, score: wa.performanceScore ?? 0, key: "performanceScore" },
      { label: labels.seo, score: wa.seoScore ?? 0, key: "seoScore" },
      { label: labels.a11y, score: wa.accessibilityScore ?? 0, key: "accessibilityScore" },
      { label: labels.bp, score: wa.bestPracticesScore ?? 0, key: "bestPracticesScore" },
    ].filter(s => s.score > 0);

    if (analyzedScores.length > 0) {
      const intro = (market === "US" || market === "UK" || market === "KR" || market === "CA" || market === "AU" || market === "IE")
        ? "Website analysis (OPTIONAL context — turn at most ONE of these into a genuine, plain-language observation; do NOT list scores or use them as a report card):"
        : market === "DE"
        ? "Website-Analyse (OPTIONALER Kontext — machen Sie aus HÖCHSTENS einem Punkt eine echte Beobachtung in einfacher Sprache; KEINE Punkteliste, kein Zeugnis):"
        : (market === "ES" || market === "MX" || market === "AR")
        ? "Análisis del sitio (contexto OPCIONAL — convierte como mucho UNO en una observación genuina y sencilla; no enumeres puntuaciones ni las uses como boletín):"
        : "ANALYSDATA (VALFRI bakgrund – gör HÖGST en av dessa till en äkta observation i vanlig text; lista INTE poäng och använd dem INTE som betyg):";
      parts.push(intro);
      for (const s of analyzedScores) {
        parts.push(`• ${s.label}: ${s.score}/100`);
      }

      const strengths = analyzedScores.filter(s => s.score >= 70).sort((a, b) => b.score - a.score);
      const weaknesses = analyzedScores.filter(s => s.score < 70).sort((a, b) => a.score - b.score);

      
      if (strengths.length > 0) {
        parts.push(`→ Verkar fungera bra (valfri bakgrund, inget att rabbla): ${strengths.map(s => s.label).join(", ")}`);
      }
      if (weaknesses.length > 0) {
        parts.push(`→ Möjlig ingång till EN observation/idé (formulera som möjlighet, inte problem): ${weaknesses.map(s => s.label).join(", ")}`);
      }
      parts.push("");
    }
  }

  // Additional context from detected problems (business impact hints)
  if (ctx.detectedProblems && ctx.detectedProblems.length > 0) {
    parts.push("MÖJLIGA OBSERVATIONER (valfri bakgrund – välj HÖGST en och formulera som en möjlighet, inte ett problem):");
    for (const p of ctx.detectedProblems) {
      switch (p.key) {
        case "no_ssl":
          parts.push("• Saknar säkerhetscertifikat – besökare kan få varningar");
          break;
        case "slow_load":
          parts.push(`• Långsam laddning (${p.value}) – besökare lämnar`);
          break;
        case "poor_mobile":
          parts.push("• Dålig mobilupplevelse – de flesta söker via telefon");
          break;
        case "old_design":
          parts.push(`• Design ej uppdaterad sedan ${p.value?.replace("© ", "")}`);
          break;
        case "bad_seo":
          parts.push("• Svag SEO – stora möjligheter att synas bättre");
          break;
        case "no_cta":
          parts.push("• Saknar tydliga kontaktvägar/handlingsuppmaningar");
          break;
        case "no_geo":
          parts.push("• Syns inte i lokala sökresultat/kartor");
          break;
      }
    }
    parts.push("");
  }

  // From GEO analysis
  if (ctx.geoAnalysis?.geoScore !== undefined) {
    parts.push(`GEO/AI-SYNLIGHET: ${ctx.geoAnalysis.geoScore}/100`);
    if (ctx.geoAnalysis.summary) parts.push(`Sammanfattning: ${ctx.geoAnalysis.summary}`);
    parts.push("");
  }

  // From SEO intelligence
  if (ctx.seoIntelligence?.visibilityScore !== undefined) {
    parts.push(`SEO INTELLIGENCE: Synlighetspoäng ${ctx.seoIntelligence.visibilityScore}`);
    if (ctx.seoIntelligence.opportunities) parts.push(`Möjligheter: ${ctx.seoIntelligence.opportunities}`);
    parts.push("");
  }

  if (ctx.fleetData && (ctx.fleetData.vehicleCount ?? 0) > 0) {
    parts.push(`Fordonsflotta: ${ctx.fleetData.vehicleCount} fordon`);
    if (ctx.fleetData.leasingCompany) parts.push(`Leasing: ${ctx.fleetData.leasingCompany}`);
    parts.push("");
  }

  if (ctx.telephonyData && (ctx.telephonyData.subscriptionCount ?? 0) > 0) {
    parts.push(`Telefonabonnemang: ${ctx.telephonyData.subscriptionCount}`);
    if (ctx.telephonyData.operator) parts.push(`Operatör: ${ctx.telephonyData.operator}`);
    parts.push("");
  }

  const hasAnyData = ctx.businessSummary || ctx.websiteContent || ctx.webAnalysis || ctx.geoAnalysis || ctx.seoIntelligence || ctx.detectedProblems?.length;
  if (!hasAnyData) {
    parts.push("INGEN DETALJERAD DATA TILLGÄNGLIG.");
    parts.push("Skriv ett kort, nyfikenhetsväckande mail.\n");
  }

  parts.push('SUBJECT LINES: "subject_a" and "subject_b" must be TWO DISTINCT subject angles (each max ~60 chars). "preheader" is a 40-90 char preview line that COMPLEMENTS the subject (never repeats it). Write subjects and preheader in the SAME language as the email body.');
  parts.push('Svara som JSON: {"subject_a": "...", "subject_b": "...", "preheader": "...", "body_without_signature": "..."}');

  return parts.join("\n");
}

// ── response parser ──────────────────────────────────────────────────

export interface ParsedOutreachEmail {
  subject: string;        // = subject_a (kept for back-compat with all callers)
  subject_a: string;
  subject_b: string;      // falls back to subject_a when the model returns one
  preheader: string;      // "" when absent
  body_without_signature: string;
}

export function parseOutreachResponse(
  content: string,
  fallbackCompanyName?: string,
): ParsedOutreachEmail {
  const fallbackSubject = `Angående ${fallbackCompanyName || "ert företag"}`;
  try {
    // Match new (subject_a) or legacy (subject) JSON shapes.
    const jsonMatch = content.match(/\{[\s\S]*"(subject_a|subject)"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const subject_a = parsed.subject_a || parsed.subject || fallbackSubject;
      const subject_b = parsed.subject_b || subject_a;
      const preheader = typeof parsed.preheader === "string" ? parsed.preheader : "";
      return {
        subject: subject_a,
        subject_a,
        subject_b,
        preheader,
        body_without_signature: parsed.body_without_signature || parsed.body || "",
      };
    }
    throw new Error("No JSON found");
  } catch {
    return {
      subject: fallbackSubject,
      subject_a: fallbackSubject,
      subject_b: fallbackSubject,
      preheader: "",
      body_without_signature: content.replace(/```json|```/g, "").trim(),
    };
  }
}

// ── signature builder ────────────────────────────────────────────────

export interface ProfileSignature {
  email_signature?: string | null;
  email_footer?: string | null;
  full_name?: string | null;
}

export type SignatureMarket = "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" | "AU" | "IE" | "MX" | "AR";

const SIGNATURE_CLOSING: Record<SignatureMarket, string> = {
  SE: "Med vänlig hälsning,",
  US: "Best regards,",
  DE: "Mit freundlichen Grüßen,",
  ES: "Un saludo,",
  UK: "Kind regards,",
  KR: "감사합니다,",
  CA: "Best regards,",
  AU: "Best regards,",
  IE: "Kind regards,",
  MX: "Un saludo,",
  AR: "Un saludo,",
};

const SIGNATURE_FALLBACK_NAME = "CoFlow";

/**
 * Heuristic: detects a Swedish-language signature so we can skip it when the
 * outreach is being sent in English/German. Users typically save their
 * signature once (in Swedish) and we don't want that leaking into US/DE mail.
 */
function looksSwedish(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("med vänlig") ||
    t.includes("vänliga hälsningar") ||
    t.includes("mvh") ||
    t.includes("hälsningar")
  );
}

export function appendSignature(
  bodyWithoutSignature: string,
  profile: ProfileSignature | null,
  market: SignatureMarket = "SE",
): string {
  const sigParts: string[] = [];
  const closing = SIGNATURE_CLOSING[market] ?? SIGNATURE_CLOSING.SE;

  // Use the saved signature only when it matches the target market's language.
  // For SE we always trust it; for US/DE we skip Swedish signatures and
  // synthesize a localized one instead.
  const savedSig = profile?.email_signature?.trim();
  if (savedSig && (market === "SE" || !looksSwedish(savedSig))) {
    sigParts.push(savedSig);
  } else {
    const name = profile?.full_name || SIGNATURE_FALLBACK_NAME;
    sigParts.push(`${closing}\n${name}`);
  }

  const footer = profile?.email_footer?.trim();
  if (footer && (market === "SE" || !looksSwedish(footer))) {
    sigParts.push(footer);
  }

  return bodyWithoutSignature + "\n\n" + sigParts.join("\n\n");
}
