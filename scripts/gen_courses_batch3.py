#!/usr/bin/env python3
"""Batch 3: expand each course with 3 more modules (modules 5-7), appended to the
existing TipTap body (sv/en/es). Emits 20260620130000_courses_batch3.sql.
Each course is a single training_item whose body.content holds the module nodes;
we concatenate new heading+paragraph nodes onto body->'content'. Idempotent via a
NOT LIKE guard on the first new (Swedish) module heading."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260620130000_courses_batch3.sql")
LBL = {
 "sv": ("Modul", "Det här lär du dig", "Material", "Exempel", "Öva"),
 "en": ("Module", "What you'll learn", "Material", "Example", "Practice"),
 "es": ("Módulo", "Qué aprenderás", "Material", "Ejemplo", "Practica"),
}
START_INDEX = 5  # existing courses have modules 1-4

def nodes(lang, modules):
    modL, le, ma, ex, pr = LBL[lang]
    out = []
    for i, m in enumerate(modules, START_INDEX):
        out.append({"type": "heading", "attrs": {"level": 3},
                    "content": [{"type": "text", "text": f"{modL} {i} – {m[0]}"}]})
        for lbl, txt in ((le, m[1]), (ma, m[2]), (ex, m[3]), (pr, m[4])):
            out.append({"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": lbl + ": "},
                {"type": "text", "text": txt}]})
    return json.dumps(out, ensure_ascii=False)

def jnodes(lang, modules): return "$j$" + nodes(lang, modules) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

COURSES = []
def add(title_sv, sv, en, es): COURSES.append((title_sv, sv, en, es))

# 1. Grundkurs
add("Grundkurs: Sälj från A till Ö",
 [("Prospektering på djupet","var och hur du hittar kvalificerade leads.",
   "Leta i Google Maps, LinkedIn, branschregister och via tips. Kvalificera direkt: rätt storlek, tydligt behov och beslutsfattare. Hellre tio rätt företag än hundra slumpvisa.",
   "Sök 'takläggare [stad]' på Google och notera vilka som saknas eller har dålig sajt.","Bygg en lista på tio kvalificerade företag."),
  ("Förslag & offert","bygga ett tydligt förslag som leder till avtal.",
   "Koppla varje del till behovet du hittade, håll det enkelt och visa ett tydligt pris och nästa steg. En offert ska vara lätt att säga ja till.",
   "\"Du sa att ni tappar jobb till X – därför föreslår jag Startpaketet, så här ser det ut.\"","Skriv ett förslag i tre punkter för en påhittad kund."),
  ("Uppföljning","följa upp tills du får ett besked.",
   "De flesta affärer kräver flera kontakter. Boka alltid nästa steg och följ upp offerter inom några dagar. Tystnad är inte ett nej.",
   "\"Hej, hörde du tittat på förslaget – vilka tankar har du?\"","Lägg en uppföljningsuppgift på varje öppen offert.")],
 [("Prospecting in depth","where and how to find qualified leads.",
   "Search Google Maps, LinkedIn, industry registers and referrals. Qualify right away: right size, clear need and a decision maker. Better ten right companies than a hundred random ones.",
   "Search 'roofer [city]' on Google and note who's missing or has a poor site.","Build a list of ten qualified companies."),
  ("Proposal & quote","to build a clear proposal that leads to an agreement.",
   "Tie each part to the need you found, keep it simple and show a clear price and next step. A quote should be easy to say yes to.",
   "\"You said you lose jobs to X – so I propose the Starter bundle, here's how it looks.\"","Write a three-point proposal for an imagined customer."),
  ("Follow-up","to follow up until you get an answer.",
   "Most deals need several contacts. Always book the next step and follow up on quotes within a few days. Silence isn't a no.",
   "\"Hi, saw you looked at the proposal – what are your thoughts?\"","Add a follow-up task to every open quote.")],
 [("Prospección en profundidad","dónde y cómo encontrar leads cualificados.",
   "Busca en Google Maps, LinkedIn, registros del sector y referencias. Cualifica enseguida: tamaño adecuado, necesidad clara y decisor. Mejor diez empresas correctas que cien al azar.",
   "Busca 'instalador de tejados [ciudad]' en Google y anota quién falta o tiene mala web.","Crea una lista de diez empresas cualificadas."),
  ("Propuesta y presupuesto","a construir una propuesta clara que lleve a un acuerdo.",
   "Conecta cada parte con la necesidad detectada, mantenlo simple y muestra un precio claro y el siguiente paso. Un presupuesto debe ser fácil de aceptar.",
   "\"Dijiste que pierdes trabajos frente a X, por eso propongo el Paquete inicial, así queda.\"","Escribe una propuesta de tres puntos para un cliente imaginario."),
  ("Seguimiento","a hacer seguimiento hasta obtener una respuesta.",
   "La mayoría de ventas requieren varios contactos. Agenda siempre el siguiente paso y haz seguimiento de los presupuestos en pocos días. El silencio no es un no.",
   "\"Hola, vi que miraste la propuesta, ¿qué te parece?\"","Añade una tarea de seguimiento a cada presupuesto abierto.")])

# 2. Behovsanalys & frågeteknik
add("Behovsanalys & frågeteknik",
 [("De fyra frågetyperna","strukturera dina frågor.",
   "Situationsfrågor (läget idag), problemfrågor (vad skaver), konsekvensfrågor (vad det kostar) och nyttofrågor (värdet av en lösning). Konsekvensfrågorna gör behovet känsligt.",
   "\"Vad kostar det er att tappa de där förfrågningarna varje månad?\"","Skriv en fråga av varje typ inför nästa möte."),
  ("Tystnadens kraft","använda pauser medvetet.",
   "Efter en bra fråga – var tyst. Tystnad känns obekvämt men får kunden att fylla i och tänka högt. Avbryt inte.",
   "Ställ en konsekvensfråga och räkna tyst till tre innan du säger något mer.","Öva på att pausera tre sekunder efter varje fråga."),
  ("Sammanfatta & få ja","stänga behovsanalysen innan pitchen.",
   "Sammanfatta vad du hört och be kunden bekräfta. Ett 'ja, precis' innan pitchen gör att förslaget landar som en lösning, inte en gissning.",
   "\"Så om jag förstått rätt är X viktigast och Y skaver mest – stämmer det?\"","Avsluta nästa behovsanalys med en sammanfattning.")],
 [("The four question types","to structure your questions.",
   "Situation questions (the current state), problem questions (what chafes), implication questions (what it costs) and need-payoff questions (the value of a solution). Implication questions make the need urgent.",
   "\"What does it cost you to lose those enquiries every month?\"","Write one question of each type before your next meeting."),
  ("The power of silence","to use pauses deliberately.",
   "After a good question – stay silent. Silence feels uncomfortable but makes the customer fill in and think out loud. Don't interrupt.",
   "Ask an implication question and count to three silently before saying more.","Practise pausing three seconds after each question."),
  ("Summarise & get a yes","to close the needs analysis before the pitch.",
   "Summarise what you heard and ask the customer to confirm. A 'yes, exactly' before the pitch makes the proposal land as a solution, not a guess.",
   "\"So if I understood right, X matters most and Y chafes most – correct?\"","End your next needs analysis with a summary.")],
 [("Los cuatro tipos de pregunta","a estructurar tus preguntas.",
   "Preguntas de situación (el estado actual), de problema (qué molesta), de implicación (qué cuesta) y de beneficio (el valor de una solución). Las de implicación hacen urgente la necesidad.",
   "\"¿Cuánto os cuesta perder esas solicitudes cada mes?\"","Escribe una pregunta de cada tipo antes de tu próxima reunión."),
  ("El poder del silencio","a usar las pausas a propósito.",
   "Tras una buena pregunta, guarda silencio. Incomoda, pero hace que el cliente rellene y piense en voz alta. No interrumpas.",
   "Haz una pregunta de implicación y cuenta hasta tres en silencio antes de seguir.","Practica pausar tres segundos tras cada pregunta."),
  ("Resume y consigue un sí","a cerrar el análisis antes del pitch.",
   "Resume lo que oíste y pide al cliente que lo confirme. Un 'sí, exacto' antes del pitch hace que la propuesta caiga como solución, no como suposición.",
   "\"Si entendí bien, X es lo más importante e Y lo que más molesta, ¿correcto?\"","Termina tu próximo análisis con un resumen.")])

# 3. Invändningshantering & förhandling
add("Invändningshantering & förhandling",
 [("Förebygg invändningar","ta udden av invändningar innan de kommer.",
   "Ta upp pris och vanliga farhågor proaktivt, så känns de mindre laddade. Den som adresserar elefanten i rummet bygger förtroende.",
   "\"Många undrar om det är värt pengarna – låt mig visa hur det betalar sig.\"","Lista tre farhågor du kan ta upp proaktivt."),
  ("De vanligaste invändningarna","känna igen och bemöta de åtta vanliga.",
   "För dyrt, har redan hemsida, gör det själva, ingen tid, skicka info, nöjd med leverantör, funkar SEO/GEO, måste tänka på det. Kan du svaren i sömnen tappar du aldrig tempo.",
   "Dra en kollega och låt hen skjuta invändningar – svara direkt.","Skriv ett kort svar på var och en av de åtta."),
  ("Förhandlingsteknik","förhandla utan att tappa värde.",
   "Ankra med ditt ordinarie pris, ge aldrig utan att få något tillbaka och våga vara tyst efter ett bud. Den som pratar först efter ett bud förlorar ofta.",
   "\"Jag kan lösa det priset om vi skriver ett längre avtal – funkar det?\"","Bestäm i förväg vad du kan ge och vad du vill ha tillbaka.")],
 [("Prevent objections","to take the edge off objections before they arise.",
   "Raise price and common concerns proactively, so they feel less charged. Addressing the elephant in the room builds trust.",
   "\"Many wonder if it's worth the money – let me show how it pays off.\"","List three concerns you can raise proactively."),
  ("The most common objections","to recognise and meet the eight common ones.",
   "Too expensive, already have a site, do it themselves, no time, send info, happy with supplier, does SEO/GEO work, need to think. Know the answers cold and you never lose momentum.",
   "Grab a colleague and have them fire objections – answer instantly.","Write a short reply to each of the eight."),
  ("Negotiation technique","to negotiate without losing value.",
   "Anchor with your standard price, never give without getting something back, and dare to be silent after an offer. Whoever speaks first after an offer often loses.",
   "\"I can do that price if we sign a longer contract – works?\"","Decide in advance what you can give and what you want back.")],
 [("Previene objeciones","a quitar fuerza a las objeciones antes de que surjan.",
   "Plantea el precio y las preocupaciones comunes de forma proactiva, así pesan menos. Quien aborda el elefante en la sala genera confianza.",
   "\"Muchos se preguntan si vale la pena, déjame mostrar cómo se amortiza.\"","Enumera tres preocupaciones que puedes plantear proactivamente."),
  ("Las objeciones más comunes","a reconocer y responder las ocho habituales.",
   "Demasiado caro, ya tienen web, lo hacen ellos, sin tiempo, envía info, contentos con su proveedor, ¿funciona SEO/GEO?, tienen que pensarlo. Sabértelas de memoria evita perder ritmo.",
   "Pide a un compañero que dispare objeciones y responde al instante.","Escribe una respuesta corta a cada una de las ocho."),
  ("Técnica de negociación","a negociar sin perder valor.",
   "Ancla con tu precio estándar, nunca cedas sin recibir algo a cambio y atrévete a callar tras una oferta. Quien habla primero tras una oferta suele perder.",
   "\"Puedo hacer ese precio si firmamos un contrato más largo, ¿te va?\"","Decide de antemano qué puedes ceder y qué quieres a cambio.")])

# 4. Mötesbokning & kalla samtal
add("Mötesbokning & kalla samtal",
 [("Förbered samtalet","komma förberedd till varje pass.",
   "Ha en lista, ditt manus och ett tydligt mål framför dig. Ring i fokuserade pass och stör inte med annat. Förberedelse ger självförtroende.",
   "Sätt ett mål: 20 samtal och 2 bokade möten på en timme.","Förbered en ringlista på 20 företag inför nästa pass."),
  ("Ta dig förbi gatekeepern","hantera växel och assistenter artigt.",
   "Var trevlig, kort och rak. Be om personen vid namn om du kan, och behandla gatekeepern som en allierad, inte ett hinder.",
   "\"Hej, kan du hjälpa mig till den som ansvarar för er hemsida?\"","Skriv en mening för att artigt be att bli kopplad."),
  ("Mät och förbättra","följa upp dina egna siffror.",
   "Räkna samtal, kontakter och bokade möten. När du vet din konverteringsgrad vet du också hur många samtal ett möte kostar – och kan förbättra delarna.",
   "20 samtal → 5 samtal med rätt person → 2 möten = din tratt.","Logga dagens samtal och möten och räkna ut din boknings­grad.")],
 [("Prepare the call","to come prepared to every session.",
   "Have a list, your script and a clear goal in front of you. Call in focused blocks and don't multitask. Preparation gives confidence.",
   "Set a goal: 20 calls and 2 booked meetings in an hour.","Prepare a call list of 20 companies for your next session."),
  ("Get past the gatekeeper","to handle switchboards and assistants politely.",
   "Be friendly, short and direct. Ask for the person by name if you can, and treat the gatekeeper as an ally, not an obstacle.",
   "\"Hi, can you help me reach whoever's responsible for your website?\"","Write a line to politely ask to be put through."),
  ("Measure and improve","to track your own numbers.",
   "Count calls, contacts and booked meetings. Once you know your conversion rate you know how many calls a meeting costs – and can improve the parts.",
   "20 calls → 5 calls with the right person → 2 meetings = your funnel.","Log today's calls and meetings and calculate your booking rate.")],
 [("Prepara la llamada","a llegar preparado a cada sesión.",
   "Ten una lista, tu guion y un objetivo claro delante. Llama en bloques enfocados y no hagas varias cosas a la vez. La preparación da confianza.",
   "Fíjate una meta: 20 llamadas y 2 reuniones agendadas en una hora.","Prepara una lista de 20 empresas para tu próxima sesión."),
  ("Pasa al gatekeeper","a tratar con centralitas y asistentes con cortesía.",
   "Sé amable, breve y directo. Pide a la persona por su nombre si puedes y trata al gatekeeper como un aliado, no un obstáculo.",
   "\"Hola, ¿puedes ayudarme a llegar al responsable de vuestra web?\"","Escribe una frase para pedir amablemente que te pasen."),
  ("Mide y mejora","a seguir tus propios números.",
   "Cuenta llamadas, contactos y reuniones agendadas. Cuando sabes tu tasa de conversión sabes cuántas llamadas cuesta una reunión, y puedes mejorar las partes.",
   "20 llamadas → 5 con la persona correcta → 2 reuniones = tu embudo.","Registra las llamadas y reuniones de hoy y calcula tu tasa de agenda.")])

# 5. Digital spetskunskap: SEO & GEO
add("Digital spetskunskap: SEO & GEO",
 [("Nyckelord","hitta vad kunderna faktiskt söker på.",
   "Utgå från kundens språk, inte ditt eget. Kombinera tjänst och plats ('takläggare Göteborg') och leta efter ord med köpavsikt. Rätt nyckelord styr hela SEO-arbetet.",
   "'pris takbyte' visar köpavsikt; 'vad är ett tak' gör det inte.","Lista fem nyckelord en kund i din bransch skulle googla."),
  ("Teknisk SEO","förstå grunderna som påverkar ranking.",
   "Fart, mobilanpassning, säker anslutning (HTTPS) och tydlig struktur. Google belönar sajter som är snabba och lätta att förstå – det är delvis därför vi bygger i Astro/React.",
   "En sajt som laddar på 1 sekund slår en som tar 5.","Testa en kunds sajt i Googles PageSpeed och notera betyget."),
  ("GEO i praktiken","optimera för att nämnas av AI.",
   "AI väljer källor som är tydliga, trovärdiga och välstrukturerade. Tydligt innehåll, vanliga frågor och omnämnanden på andra sajter ökar chansen att bli rekommenderad.",
   "Fråga ChatGPT 'bästa webbyrå i [stad]' och se vilka som nämns.","Skriv tre vanliga frågor en kunds sajt borde besvara.")],
 [("Keywords","to find what customers actually search for.",
   "Start from the customer's language, not your own. Combine service and place ('roofer Gothenburg') and look for words with buying intent. The right keywords steer all SEO work.",
   "'price roof replacement' shows buying intent; 'what is a roof' doesn't.","List five keywords a customer in your industry would google."),
  ("Technical SEO","to understand the basics that affect ranking.",
   "Speed, mobile-friendliness, secure connection (HTTPS) and clear structure. Google rewards sites that are fast and easy to understand – partly why we build in Astro/React.",
   "A site that loads in 1 second beats one that takes 5.","Test a customer's site in Google PageSpeed and note the score."),
  ("GEO in practice","to optimise for being mentioned by AI.",
   "AI picks sources that are clear, credible and well-structured. Clear content, FAQs and mentions on other sites raise the chance of being recommended.",
   "Ask ChatGPT 'best web agency in [city]' and see who's mentioned.","Write three FAQs a customer's site should answer.")],
 [("Palabras clave","a encontrar lo que los clientes buscan de verdad.",
   "Parte del lenguaje del cliente, no del tuyo. Combina servicio y lugar ('instalador de tejados Gotemburgo') y busca palabras con intención de compra. Las palabras clave guían todo el SEO.",
   "'precio cambio de tejado' muestra intención; 'qué es un tejado' no.","Lista cinco palabras que un cliente de tu sector buscaría."),
  ("SEO técnico","a entender lo básico que afecta al ranking.",
   "Velocidad, adaptación a móvil, conexión segura (HTTPS) y estructura clara. Google premia los sitios rápidos y fáciles de entender, en parte por eso construimos en Astro/React.",
   "Un sitio que carga en 1 segundo supera a uno que tarda 5.","Prueba la web de un cliente en Google PageSpeed y anota la nota."),
  ("GEO en la práctica","a optimizar para ser mencionado por la IA.",
   "La IA elige fuentes claras, creíbles y bien estructuradas. Contenido claro, preguntas frecuentes y menciones en otros sitios aumentan la probabilidad de ser recomendado.",
   "Pregunta a ChatGPT 'mejor agencia web en [ciudad]' y mira a quién menciona.","Escribe tres preguntas frecuentes que la web de un cliente debería responder.")])

# 6. Produktmästaren
add("Produktmästaren",
 [("Astro eller React","välja rätt teknik för kunden.",
   "Statisk sajt i Astro för verksamheter som mest presenterar (hantverk, restaurang, konsult). Dynamiskt i React när det behövs inloggning, bokning eller realtidsdata. Behovet styr tekniken.",
   "Bokningssystem → React. Snygg broschyrsajt → Astro.","Para ihop tre kunder med rätt teknikval."),
  ("Kombinationspaket","sälja helheter istället för delar.",
   "Startpaket (hemsida + SEO), Tillväxtpaket (hemsida + SEO + GEO) och MVP-paket (MVP + designpartner) höjer ordervärdet och ger kunden en helhet.",
   "\"Vill ni synas och konvertera från dag ett? Tillväxtpaketet löser båda.\"","Föreslå ett kombinationspaket för en påhittad kund."),
  ("Räkna hem värdet","motivera priset med ROI.",
   "Sätt priset i relation till vad en kund är värd. En sajt för 18 000 kr som drar in två kunder i månaden betalar sig snabbt. Sälj investering, inte kostnad.",
   "\"Vad är en ny kund värd? Då ser ni hur snabbt sajten betalar sig.\"","Räkna ut återbetalningstiden för ett paket åt en kund.")],
 [("Astro or React","to choose the right tech for the customer.",
   "Static site in Astro for businesses that mostly present (trades, restaurant, consultant). Dynamic in React when login, booking or real-time data is needed. The need drives the tech.",
   "Booking system → React. A sharp brochure site → Astro.","Match three customers with the right tech choice."),
  ("Combination bundles","to sell wholes instead of parts.",
   "Starter bundle (website + SEO), Growth bundle (website + SEO + GEO) and MVP bundle (MVP + design partner) raise the order value and give the customer a whole.",
   "\"Want to be seen and convert from day one? The Growth bundle does both.\"","Propose a combination bundle for an imagined customer."),
  ("Make the value add up","to justify the price with ROI.",
   "Set the price against what a customer is worth. A SEK 18,000 site that brings in two customers a month pays off fast. Sell investment, not cost.",
   "\"What is a new customer worth? Then you see how fast the site pays off.\"","Calculate the payback time of a package for a customer.")],
 [("Astro o React","a elegir la tecnología adecuada para el cliente.",
   "Sitio estático en Astro para negocios que sobre todo presentan (oficios, restaurante, consultor). Dinámico en React cuando hace falta login, reservas o datos en tiempo real. La necesidad guía la tecnología.",
   "Sistema de reservas → React. Web folleto atractiva → Astro.","Empareja tres clientes con la elección técnica adecuada."),
  ("Paquetes combinados","a vender conjuntos en vez de partes.",
   "Paquete inicial (web + SEO), Paquete de crecimiento (web + SEO + GEO) y Paquete MVP (MVP + socio de diseño) suben el valor del pedido y dan al cliente un conjunto.",
   "\"¿Queréis aparecer y convertir desde el primer día? El Paquete de crecimiento hace ambas.\"","Propón un paquete combinado para un cliente imaginario."),
  ("Haz que el valor cuadre","a justificar el precio con el ROI.",
   "Pon el precio frente a lo que vale un cliente. Una web de 18 000 SEK que trae dos clientes al mes se amortiza rápido. Vende inversión, no coste.",
   "\"¿Cuánto vale un cliente nuevo? Así ves lo rápido que se paga la web.\"","Calcula el periodo de amortización de un paquete para un cliente.")])

# 7. Storytelling & pitch
add("Storytelling & pitch",
 [("Hjälteresan i sälj","göra kunden till hjälten.",
   "Kunden är hjälten, du är guiden. Berätta om var de är nu, vart de vill, och hur du hjälper dem dit. Ställ aldrig dig själv i centrum.",
   "\"Ni vill nå dit – så här tar vi er dit, steg för steg.\"","Skriv en mening där kunden är hjälten och du guiden."),
  ("Sociala bevis","använda case och omdömen.",
   "Människor litar på andra människor. Ett kort kundcase, ett omdöme eller en siffra övertygar mer än dina egna påståenden.",
   "\"En liknande kund fördubblade sina förfrågningar på tre månader.\"","Samla tre konkreta bevis du kan använda."),
  ("Ord som säljer","välja rätt språk i pitchen.",
   "Konkreta, enkla ord slår jargong. Säg 'fler kunder' istället för 'ökad konvertering'. Undvik svepande superlativ – var specifik istället.",
   "'Ni får fler förfrågningar' slår 'vi maximerar er digitala potential'.","Skriv om en jargong-mening till enkelt språk.")],
 [("The hero's journey in sales","to make the customer the hero.",
   "The customer is the hero, you are the guide. Tell where they are now, where they want to go, and how you help them get there. Never put yourself at the centre.",
   "\"You want to get there – here's how we take you there, step by step.\"","Write a sentence where the customer is the hero and you the guide."),
  ("Social proof","to use cases and testimonials.",
   "People trust other people. A short customer case, a testimonial or a number convinces more than your own claims.",
   "\"A similar customer doubled their enquiries in three months.\"","Collect three concrete proofs you can use."),
  ("Words that sell","to choose the right language in the pitch.",
   "Concrete, simple words beat jargon. Say 'more customers' instead of 'increased conversion'. Avoid sweeping superlatives – be specific instead.",
   "'You get more enquiries' beats 'we maximise your digital potential'.","Rewrite a jargon sentence into plain language.")],
 [("El viaje del héroe en ventas","a convertir al cliente en el héroe.",
   "El cliente es el héroe, tú eres el guía. Cuenta dónde están, a dónde quieren ir y cómo les ayudas a llegar. Nunca te pongas en el centro.",
   "\"Queréis llegar ahí: así os llevamos, paso a paso.\"","Escribe una frase donde el cliente sea el héroe y tú el guía."),
  ("Prueba social","a usar casos y testimonios.",
   "La gente confía en otras personas. Un caso breve, un testimonio o un número convencen más que tus propias afirmaciones.",
   "\"Un cliente parecido duplicó sus solicitudes en tres meses.\"","Reúne tres pruebas concretas que puedas usar."),
  ("Palabras que venden","a elegir el lenguaje adecuado en el pitch.",
   "Las palabras concretas y simples superan la jerga. Di 'más clientes' en vez de 'mayor conversión'. Evita superlativos vagos, sé específico.",
   "'Tendréis más solicitudes' supera a 'maximizamos vuestro potencial digital'.","Reescribe una frase con jerga en lenguaje sencillo.")])

# 8. CRM-mästaren
add("CRM-mästaren",
 [("Pipeline-stadier","flytta affärer framåt steg för steg.",
   "En affär rör sig genom stadier: ny lead, kontaktad, möte bokat, offert skickad, vunnen eller förlorad. Varje lead ska alltid ha ett aktuellt stadium och ett nästa steg.",
   "En offert som legat i 'skickad' i två veckor behöver en uppföljning.","Sätt rätt stadium på varje aktiv lead i din pipeline."),
  ("Daglig rutin","jobba systematiskt varje dag.",
   "Börja dagen med att kolla dagens uppgifter och möten, jobba av dem och boka nästa steg. En enkel daglig rutin gör att inget faller mellan stolarna.",
   "Morgon: kolla uppgifter. Dagen: ring och boka. Kväll: logga och planera.","Skriv din egen tre-stegs dagsrutin i CRM:t."),
  ("Rapporter & nyckeltal","mäta det som driver resultat.",
   "Följ samtal, bokade möten, skickade offerter och vunna affärer. Siffrorna visar var det stockar sig och vad du ska göra mer av.",
   "Få möten men inga avslut? Då är det pitchen eller offerten som skaver.","Lista de fyra nyckeltal du vill följa varje vecka.")],
 [("Pipeline stages","to move deals forward step by step.",
   "A deal moves through stages: new lead, contacted, meeting booked, quote sent, won or lost. Every lead should always have a current stage and a next step.",
   "A quote stuck in 'sent' for two weeks needs a follow-up.","Set the right stage on every active lead in your pipeline."),
  ("Daily routine","to work systematically every day.",
   "Start the day by checking today's tasks and meetings, work through them and book the next step. A simple daily routine keeps things from slipping through the cracks.",
   "Morning: check tasks. Day: call and book. Evening: log and plan.","Write your own three-step daily routine in the CRM."),
  ("Reports & metrics","to measure what drives results.",
   "Track calls, booked meetings, quotes sent and deals won. The numbers show where things get stuck and what to do more of.",
   "Lots of meetings but no closes? Then the pitch or quote is the issue.","List the four metrics you want to track every week.")],
 [("Etapas del pipeline","a mover ventas hacia adelante paso a paso.",
   "Una venta avanza por etapas: lead nuevo, contactado, reunión agendada, presupuesto enviado, ganada o perdida. Cada lead debe tener siempre una etapa actual y un siguiente paso.",
   "Un presupuesto en 'enviado' dos semanas necesita seguimiento.","Pon la etapa correcta a cada lead activo de tu pipeline."),
  ("Rutina diaria","a trabajar de forma sistemática cada día.",
   "Empieza el día revisando tareas y reuniones, resuélvelas y agenda el siguiente paso. Una rutina diaria sencilla evita que algo se pierda.",
   "Mañana: revisa tareas. Día: llama y agenda. Tarde: registra y planifica.","Escribe tu propia rutina diaria de tres pasos en el CRM."),
  ("Informes y métricas","a medir lo que impulsa resultados.",
   "Sigue llamadas, reuniones agendadas, presupuestos enviados y ventas ganadas. Los números muestran dónde se atasca y qué hacer más.",
   "¿Muchas reuniones pero sin cierres? Entonces el pitch o el presupuesto falla.","Enumera las cuatro métricas que quieres seguir cada semana.")])

# ── Emit one UPDATE per course (append nodes; idempotent guard) ──────────────
parts = []
for title_sv, sv, en, es in COURSES:
    marker = f"Modul {START_INDEX} – {sv[0][0]}"  # sv heading of first new module
    parts.append(f"""UPDATE public.training_items ti
SET body    = jsonb_set(ti.body,    '{{content}}', (ti.body->'content')    || {jnodes('sv', sv)}),
    body_en = jsonb_set(ti.body_en, '{{content}}', (ti.body_en->'content') || {jnodes('en', en)}),
    body_es = jsonb_set(ti.body_es, '{{content}}', (ti.body_es->'content') || {jnodes('es', es)})
FROM public.training_categories cat
WHERE ti.category_id = cat.id AND cat.slug = 'kurser'
  AND ti.title = {slit(title_sv)}
  AND ti.body::text NOT LIKE {slit('%' + marker + '%')};""")

sql = ("-- Batch 3: append 3 more modules (5-7) to each course body (sv/en/es).\n"
       "-- Idempotent: skips a course whose first new module heading already exists.\n\n"
       + "\n\n".join(parts) + "\n")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

import re
arrs = re.findall(r"\$j\$(.*?)\$j\$", sql, re.S)
for a in arrs:
    assert isinstance(json.loads(a), list)
print("wrote", os.path.basename(OUT), "with", len(COURSES), "courses x 3 modules,",
      len(arrs), "node-arrays")
