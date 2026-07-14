/**
 * Shared outreach prompt module.
 * Generates VALUE-DRIVEN, conversion-optimised cold emails.
 * 
 * CORE PRINCIPLE: Show the prospect you understand their BUSINESS,
 * then present ONE specific growth opportunity.
 */

// ── helpers ──────────────────────────────────────────────────────────

export type Market = "SE" | "US" | "DE" | "ES" | "UK" | "KR";

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
  standard: "Professionell, personlig och trovärdig. Som ett genomtänkt meddelande från en engagerad person som genuint vill hjälpa.",
  familiar: "Varm och personlig, som att du redan har en relation.",
  informative: "Pedagogisk och insiktsfull, visar expertis.",
  direct: "Rak och koncis men fortfarande med substans. Max 100 ord.",
};

// ── system prompt ────────────────────────────────────────────────────

export function buildOutreachSystemPrompt(ctx: OutreachContext): string {
  const market: Market = ctx.market || "SE";
  if (ctx.context === "follow_up") {
    return buildFollowUpSystemPrompt(ctx);
  }
  // Non-Swedish markets use a streamlined market-specific prompt
  if (market === "KR") return buildUSSystemPrompt(ctx) + KR_LANGUAGE_OVERRIDE;
  if ((market === "US" || market === "UK")) return buildUSSystemPrompt(ctx);
  if (market === "DE") return buildDESystemPrompt(ctx);
  if (market === "ES") return buildESSystemPrompt(ctx);

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

  return `Du skriver personliga, trovärdiga kalla mail på svenska som ska få mottagaren att SVARA.

TONALITET: ${tone}
${serviceSection}${senderBlock}
FRAMGÅNGSRECEPT – DET HÄR FUNGERAR (baserat på verkligt konverterat mail):
Det mail som faktiskt konverterade till kund hade denna struktur:
1) Öppnade med att berömma det som ÄR bra – specifika poäng/resultat som visar att de gör rätt
2) Pekade sedan ut EN tydlig flaskhals med konkret siffra
3) Kopplade flaskhalsen till en AFFÄRSKONSEKVENS specifik för deras verksamhet (t.ex. "tappar bokningar vid målsnöret")
4) Erbjöd hjälp utan att vara pushig

STRATEGI – "BERÖMMA + UTMANA":
- Börja ALLTID med att lyfta det som fungerar bra. Nämn gärna specifika resultat/poäng (t.ex. "SEO på 92/100", "nästintill perfekt tillgänglighet").
- Identifiera sedan DEN VIKTIGASTE flaskhalsen och nämn den med siffra om tillgängligt (t.ex. "prestanda på 56/100", "laddningstid på 4.2 sekunder").
- Koppla flaskhalsen till en KONKRET affärskonsekvens för DERAS typ av verksamhet. Tänk: vad förlorar de? Bokningar? Förfrågningar? Kunder som lämnar?
- Var specifik, inte generisk. "Tappar potentiella bokningar precis vid målsnöret" >> "tappar besökare".

STRUKTUR (följ denna ordning, skriv naturligt):

1) INLEDNING (1-2 meningar)
   – Presentera dig kort med BARA ditt förnamn och företag (se AVSÄNDARE ovan).
   – Berätta att du har tittat på/analyserat deras hemsida.
   – KRITISKT: Använd EXAKT det förnamn och företagsnamn som anges under AVSÄNDARE.
   – ALDRIG: Skriv mottagarens FÖRETAGSNAMN i inledningen.
   – ALDRIG: Berätta för mottagaren vad de redan vet om sin egen verksamhet.

2) BERÖM – VAD SOM ÄR BRA (1-2 meningar)
   – Lyft fram SPECIFIKA positiva resultat med siffror om tillgängligt.
   – T.ex. "Med ett SEO-resultat på 92/100 och nästintill perfekt tillgänglighet syns det att ni prioriterar att vara synliga online."
   – Detta bygger trovärdighet och visar att du faktiskt analyserat deras sajt.

3) FLASKHALS – DET SOM HÅLLER TILLBAKA (2-3 meningar)
   – Peka ut det VIKTIGASTE problemet med konkret siffra.
   – Koppla direkt till affärskonsekvens för DERAS bransch/verksamhet.
   – T.ex. "Samtidigt noterade jag en tydlig flaskhals i laddningstider – prestanda på 56/100. För besökare som vill boka ett yogapass kan fördröjningar skapa friktion, vilket ofta leder till att man tappar potentiella bokningar precis vid målsnöret."

4) ERBJUDANDE + MJUK CTA (2-3 meningar)
   – Beskriv kort att du har konkreta tankar/förslag.
   – Fråga om de är öppna för ett kort samtal.
   – Mjukt och inbjudande.

ABSOLUTA REGLER:
- Skriv 120-200 ord i brödtexten (exklusive hälsning).
- DU FÅR och SKA nämna specifika poäng och siffror (t.ex. "SEO 92/100", "prestanda 56/100", "laddningstid 4.2s") – detta visar att du gjort en riktig analys och bygger trovärdighet.
- Hälsning: EXAKT "Hej [Förnamn]," om kontaktpersonen är en PERSONS namn. Om kontaktnamnet ser ut som ett FÖRETAGSNAMN eller saknas: EXAKT "Hej,".
- AVSÄNDARNAMN: Använd EXAKT det namn som anges under AVSÄNDARE. Hitta ALDRIG PÅ namn.
- FÖRETAGSNAMN I INLEDNING: Nämn ALDRIG mottagarens företagsnamn i öppningsfrasen.
- Styckeindelning: Använd tomrader mellan stycken. Max 3-4 rader per stycke.
- Skriv som en RIKTIG PERSON – inte som en robot.
- FÖRBJUDNA fraser: "i dagens digitala", "hoppas detta", "jag noterade att", "vill bara höra av mig", "råkade se", "stötte på", "med ert unika", "med ert fokus", "ni har byggt en stark", "er position inom".
- Inga emojis. Inga klyschor.
- Variera VARJE mail – aldrig identiska formuleringar.
- INGEN signatur, INGET avslutande namn. Signaturen läggs på automatiskt.
- Använd REGIONALA eller BRANSCHÖVERGRIPANDE referenser – INTE hyperspecifika lokala ortsnamn om företaget inte är i en storstad.

Svara EXAKT som JSON: {"subject": "...", "body_without_signature": "..."}
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

  return `You are a sales rep at a European web agency. Write a short, direct, non-salesy cold email in American English. Max 5 sentences. Lead with a specific insight about their website. Never start with "I hope this email finds you well". Be specific and human.
${serviceSection}${senderBlock}
RULES:
- Maximum 5 sentences in the body.
- Open with a concrete insight about their website (use scores/numbers if provided below).
- Never start with "Hi [name]" — find a creative opening based on the insight.
- Greeting: "Hi [FirstName]," if a real person's name is given, otherwise "Hi,".
- No emojis, no clichés, no "I hope this finds you well".
- NO signature, NO closing name — added automatically.

Respond EXACTLY as JSON: {"subject": "...", "body_without_signature": "..."}`;
}

function buildDESystemPrompt(ctx: OutreachContext): string {
  const senderBlock = buildSenderBlockDE(ctx);
  const serviceSection = ctx.serviceProfile?.description
    ? `\nSIE VERTRETEN:\nBranche: ${ctx.serviceProfile.industry}\nLeistung: ${ctx.serviceProfile.description}\n`
    : "";

  return `Sie sind Vertriebsmitarbeiter einer europäischen Webagentur. Schreiben Sie eine kurze, professionelle E-Mail auf Deutsch. Maximal 5 Sätze. Verwenden Sie "Sie" als Anrede. Beginnen Sie mit einem konkreten Befund zur Website des Empfängers.
${serviceSection}${senderBlock}
REGELN:
- Maximal 5 Sätze im Text.
- Beginnen Sie mit einem konkreten Befund zur Website (Zahlen aus der Analyse unten verwenden, falls vorhanden).
- Beginnen Sie NICHT mit "Hallo [Name]" — finden Sie einen kreativen Einstieg auf Basis des Befunds.
- Anrede: "Sehr geehrte/r [Vorname]," wenn ein Personenname genannt ist, sonst "Guten Tag,".
- Keine Emojis, keine Phrasen.
- KEINE Signatur, KEIN abschließender Name — wird automatisch hinzugefügt.

Antworten Sie GENAU als JSON: {"subject": "...", "body_without_signature": "..."}`;
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

  return `Eres comercial en una agencia web europea. Escribe un correo en frío corto, directo y sin tono de venta agresivo, en español. Máximo 5 frases. Empieza con una observación concreta sobre su sitio web. Nunca empieces con "Espero que este correo te encuentre bien". Sé específico y cercano.
${serviceSection}${senderBlock}
REGLAS:
- Máximo 5 frases en el cuerpo.
- Empieza con una observación concreta sobre su web (usa puntuaciones/cifras si se indican abajo).
- No empieces con "Hola [nombre]" — busca una apertura creativa basada en la observación.
- Saludo: "Hola [Nombre]," si se da el nombre de una persona real, si no "Hola,".
- Sin emojis, sin clichés, sin "espero que estés bien".
- SIN firma, SIN nombre de cierre — se añade automáticamente.

Responde EXACTAMENTE como JSON: {"subject": "...", "body_without_signature": "..."}`;
}


function buildFollowUpSystemPrompt(ctx: OutreachContext): string {
  const tone = toneInstructions[ctx.tone || "standard"] || toneInstructions.standard;
  const market: Market = ctx.market || "SE";

  if ((market === "US" || market === "UK" || market === "KR")) {
    const senderBlock = buildSenderBlockEN(ctx);
    const base = `You are writing a FOLLOW-UP cold email in American English. You contacted this company BEFORE but got no reply.

TONE: ${tone}
${senderBlock}
FOLLOW-UP STRATEGY:
- Briefly reference that you reached out before (without being pushy).
- Do NOT repeat the same pitch — offer a NEW angle or new value.
- Shorter than the first email (80-150 words).
- Greeting: "Hi [FirstName]," if a real person's name is given, otherwise "Hi,".
- NO signature (added automatically), no emojis, no clichés.
- BANNED phrases: "just following up", "just checking in", "circling back".

Respond EXACTLY as JSON: {"subject": "...", "body_without_signature": "..."}`;
    return market === "KR" ? base + KR_LANGUAGE_OVERRIDE : base;
  }

  if (market === "DE") {
    const senderBlock = buildSenderBlockDE(ctx);
    return `Sie schreiben eine FOLLOW-UP E-Mail auf Deutsch. Sie haben dieses Unternehmen BEREITS kontaktiert, aber keine Antwort erhalten.

TONALITÄT: ${tone}
${senderBlock}
FOLLOW-UP-STRATEGIE:
- Verweisen Sie kurz darauf, dass Sie sich bereits gemeldet haben (ohne aufdringlich zu sein).
- Wiederholen Sie NICHT denselben Pitch — bieten Sie einen NEUEN Blickwinkel oder Mehrwert.
- Kürzer als die erste E-Mail (80-150 Wörter).
- Anrede: "Sehr geehrte/r [Vorname]," bei einer Person, sonst "Guten Tag,". Verwenden Sie "Sie".
- KEINE Signatur (wird automatisch ergänzt), keine Emojis, keine Floskeln.

Antworten Sie GENAU als JSON: {"subject": "...", "body_without_signature": "..."}`;
  }

  if (market === "ES") {
    const senderBlock = buildSenderBlockES(ctx);
    return `Escribes un correo de SEGUIMIENTO en español. Ya contactaste a esta empresa ANTES pero no obtuviste respuesta.

TONO: ${tone}
${senderBlock}
ESTRATEGIA DE SEGUIMIENTO:
- Menciona brevemente que ya te pusiste en contacto (sin ser insistente).
- NO repitas el mismo discurso — ofrece un NUEVO enfoque o nuevo valor.
- Más corto que el primer correo (80-150 palabras).
- Saludo: "Hola [Nombre]," si se da el nombre de una persona real, si no "Hola,".
- SIN firma (se añade automáticamente), sin emojis, sin clichés.
- Frases PROHIBIDAS: "solo quería hacer seguimiento", "solo para saber cómo va".

Responde EXACTAMENTE como JSON: {"subject": "...", "body_without_signature": "..."}`;
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
- UPPREPA INTE samma pitch – erbjud en NY VINKEL eller nytt värde
- Var kortare än första mailet (80-150 ord)
- Visa att du fortfarande tror på möjligheten utan att pressa
- Erbjud något konkret: en snabb analys, en insikt, ett kort samtal

STRUKTUR:
1) KORT PÅMINNELSE (1 mening) – "Jag hörde av mig för ett tag sedan angående..."
2) NY VINKEL (2-3 meningar) – Erbjud ny insikt, nytt värde, eller ny approach
3) MJUK CTA (1 mening) – Enkel fråga, låg tröskel

REGLER:
- 80-150 ord i brödtexten
- Hälsning: "Hej [Förnamn]," om person, annars "Hej,"
- INGEN signatur – läggs på automatiskt
- Inga emojis, inga klyschor
- FÖRBJUDNA fraser: "bara ville följa upp", "checka in", "ville bara kolla"

Svara EXAKT som JSON: {"subject": "...", "body_without_signature": "..."}`;
}

// ── user prompt ──────────────────────────────────────────────────────

export function buildOutreachUserPrompt(ctx: OutreachContext): string {
  const market: Market = ctx.market || "SE";
  const parts: string[] = [];

  if (ctx.context === "follow_up") {
    parts.push(
      (market === "US" || market === "UK" || market === "KR")
        ? "Write a FOLLOW-UP email. You contacted them before but got no reply.\n"
        : market === "DE"
        ? "Schreiben Sie eine FOLLOW-UP E-Mail. Sie haben den Empfänger bereits kontaktiert, aber keine Antwort erhalten.\n"
        : market === "ES"
        ? "Escribe un correo de SEGUIMIENTO. Ya los contactaste antes pero no obtuviste respuesta.\n"
        : "Skriv ETT UPPFÖLJNINGSMAIL. Du har kontaktat dem förut men inte fått svar.\n",
    );
  } else {
    parts.push(
      (market === "US" || market === "UK" || market === "KR")
        ? "Write ONE outreach email based on the data below.\n"
        : market === "DE"
        ? "Schreiben Sie EINE Outreach-E-Mail basierend auf den folgenden Daten.\n"
        : market === "ES"
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
    const labels = (market === "US" || market === "UK" || market === "KR")
      ? { performance: "Performance", seo: "SEO", a11y: "Accessibility", bp: "Best Practices" }
      : market === "DE"
      ? { performance: "Performance", seo: "SEO", a11y: "Barrierefreiheit", bp: "Best Practices" }
      : market === "ES"
      ? { performance: "Rendimiento", seo: "SEO", a11y: "Accesibilidad", bp: "Buenas prácticas" }
      : { performance: "Prestanda", seo: "SEO", a11y: "Tillgänglighet", bp: "Best Practices" };

    const analyzedScores = [
      { label: labels.performance, score: wa.performanceScore ?? 0, key: "performanceScore" },
      { label: labels.seo, score: wa.seoScore ?? 0, key: "seoScore" },
      { label: labels.a11y, score: wa.accessibilityScore ?? 0, key: "accessibilityScore" },
      { label: labels.bp, score: wa.bestPracticesScore ?? 0, key: "bestPracticesScore" },
    ].filter(s => s.score > 0);

    if (analyzedScores.length > 0) {
      const intro = (market === "US" || market === "UK" || market === "KR")
        ? "Website analysis for this company (use these numbers as a specific opening insight — praise strengths, point out the bottleneck):"
        : market === "DE"
        ? "Website-Analyse für dieses Unternehmen (verwenden Sie diese Werte als konkreten Einstieg — Stärken loben, Engpass benennen):"
        : market === "ES"
        ? "Análisis del sitio web de esta empresa (usa estas cifras como apertura concreta — elogia los puntos fuertes, señala el cuello de botella):"
        : "ANALYSRESULTAT (använd dessa siffror direkt i mailet – beröm det som är bra, peka ut flaskhalsen):";
      parts.push(intro);
      for (const s of analyzedScores) {
        parts.push(`• ${s.label}: ${s.score}/100`);
      }

      const strengths = analyzedScores.filter(s => s.score >= 70).sort((a, b) => b.score - a.score);
      const weaknesses = analyzedScores.filter(s => s.score < 70).sort((a, b) => a.score - b.score);

      
      if (strengths.length > 0) {
        parts.push(`→ STYRKOR att berömma: ${strengths.map(s => `${s.label} (${s.score}/100)`).join(", ")}`);
      }
      if (weaknesses.length > 0) {
        parts.push(`→ FLASKHALSAR att lyfta: ${weaknesses.map(s => `${s.label} (${s.score}/100)`).join(", ")}`);
      }
      parts.push("");
    }
  }

  // Additional context from detected problems (business impact hints)
  if (ctx.detectedProblems && ctx.detectedProblems.length > 0) {
    parts.push("IDENTIFIERADE PROBLEM (koppla dessa till affärskonsekvenser):");
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

  parts.push('Svara som JSON: {"subject": "...", "body_without_signature": "..."}');

  return parts.join("\n");
}

// ── response parser ──────────────────────────────────────────────────

export interface ParsedOutreachEmail {
  subject: string;
  body_without_signature: string;
}

export function parseOutreachResponse(
  content: string,
  fallbackCompanyName?: string,
): ParsedOutreachEmail {
  try {
    const jsonMatch = content.match(/\{[\s\S]*"subject"[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        subject: parsed.subject || `Angående ${fallbackCompanyName || "ert företag"}`,
        body_without_signature: parsed.body_without_signature || parsed.body || "",
      };
    }
    throw new Error("No JSON found");
  } catch {
    return {
      subject: `Angående ${fallbackCompanyName || "ert företag"}`,
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

export type SignatureMarket = "SE" | "US" | "DE" | "ES" | "UK" | "KR";

const SIGNATURE_CLOSING: Record<SignatureMarket, string> = {
  SE: "Med vänlig hälsning,",
  US: "Best regards,",
  DE: "Mit freundlichen Grüßen,",
  ES: "Un saludo,",
  UK: "Kind regards,",
  KR: "감사합니다,",
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
