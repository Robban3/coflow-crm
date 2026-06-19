#!/usr/bin/env python3
"""Batch 2 of Kurser: courses 4-8 (approach A). sv/en/es."""
import json, os
OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260619240000_courses_batch2.sql")
LBL = {
 "sv": ("Mål", "Modul", "Det här lär du dig", "Material", "Exempel", "Öva"),
 "en": ("Goal", "Module", "What you'll learn", "Material", "Example", "Practice"),
 "es": ("Meta", "Módulo", "Qué aprenderás", "Material", "Ejemplo", "Practica"),
}
def build(lang, goal, modules):
    g, modL, le, ma, ex, pr = LBL[lang]
    c = [{"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":g+": "},{"type":"text","text":goal}]}]
    for i, m in enumerate(modules, 1):
        c.append({"type":"heading","attrs":{"level":3},"content":[{"type":"text","text":f"{modL} {i} – {m[0]}"}]})
        for lbl, txt in ((le,m[1]),(ma,m[2]),(ex,m[3]),(pr,m[4])):
            c.append({"type":"paragraph","content":[{"type":"text","marks":[{"type":"bold"}],"text":lbl+": "},{"type":"text","text":txt}]})
    return json.dumps({"type":"doc","content":c}, ensure_ascii=False)
def jlit(lang, goal, mods): return "$j$"+build(lang,goal,mods)+"$j$::jsonb"
def slit(s): return "'"+s.replace("'","''")+"'"

C=[]
def add(svt,ent,est,ordn,gsv,gen,ges,msv,men,mes): C.append((svt,ent,est,ordn,gsv,gen,ges,msv,men,mes))

# 4 Mötesbokning & kalla samtal
add("Mötesbokning & kalla samtal","Booking meetings & cold calls","Agendar reuniones y llamadas en frío",4,
 "Fyll kalendern med kvalificerade möten – med rätt mindset, ett vasst manus och bra uppföljning.",
 "Fill your calendar with qualified meetings – with the right mindset, a sharp script and good follow-up.",
 "Llena tu agenda de reuniones cualificadas: con la mentalidad correcta, un guion afilado y un buen seguimiento.",
 [("Mindset","ringa utan att vara rädd för nej.",
   "Målet med ett kallt samtal är inte att sälja – det är att boka mötet. Ett nej är inte personligt, det är statistik. Ju fler samtal, desto fler möten. Le när du ringer, det hörs.",
   "Tänk \"nästa\" efter ett nej istället för att gruva dig.","Sätt ett mål: X samtal per dag, oavsett utfall."),
  ("Öppningen & kroken","fånga uppmärksamheten på 30 sekunder.",
   "Säg vem du är, var kort och be om 30 sekunder. Följ med en konkret krok om deras bransch eller sajt. Avsluta öppningen med en fråga, inte en monolog.",
   "\"Hej [namn], [ditt namn] från Applabbet. Jag stör mitt i något – ge mig 30 sekunder så får du säga om det är intressant?\"","Skriv din egen 30-sekundersöppning och säg den högt tio gånger."),
  ("Hantera \"skicka info\"","behålla initiativet vid artiga avfärdningar.",
   "\"Skicka info\" är ofta ett vänligt nej. Acceptera men kvalificera: fråga vad som är viktigast för dem, så blir materialet relevant – och boka en kort återkoppling så du behåller initiativet.",
   "\"Absolut – vad är viktigast just nu: fler kunder, modernare sajt eller bättre synlighet? Så skickar jag rätt sak och stämmer av på fredag.\"","Skriv ditt svar på \"skicka info så återkommer vi\"."),
  ("Boka mötet & följ upp","stänga samtalet med en bokad tid.",
   "Föreslå två konkreta tider istället för en öppen fråga. Bekräfta tiden i kalender och mail direkt. Följ upp uteblivna svar – de flesta möten bokas på andra eller tredje försöket.",
   "\"Passar tisdag 10 eller torsdag 14?\" – lättare att svara på än \"när passar det?\"","Boka tre möten den här veckan och logga dem i CRM:t.")],
 [("Mindset","to call without fearing a no.",
   "The goal of a cold call isn't to sell – it's to book the meeting. A no isn't personal, it's statistics. More calls, more meetings. Smile when you call, it shows.",
   "Think \"next\" after a no instead of dwelling.","Set a goal: X calls a day, regardless of outcome."),
  ("The opening & the hook","to grab attention in 30 seconds.",
   "Say who you are, keep it short and ask for 30 seconds. Follow with a concrete hook about their industry or site. End the opening with a question, not a monologue.",
   "\"Hi [name], [your name] from Applabbet. I'm interrupting something – give me 30 seconds and you tell me if it's interesting?\"","Write your own 30-second opening and say it out loud ten times."),
  ("Handling \"send info\"","to keep the initiative on polite brush-offs.",
   "\"Send info\" is often a friendly no. Accept but qualify: ask what matters most to them so the material is relevant – and book a short follow-up so you keep the initiative.",
   "\"Absolutely – what matters most right now: more customers, a modern site or better visibility? Then I'll send the right thing and check in Friday.\"","Write your answer to \"send info and we'll get back to you\"."),
  ("Book the meeting & follow up","to close the call with a booked time.",
   "Offer two concrete times instead of an open question. Confirm the time in the calendar and by email right away. Follow up on no-replies – most meetings are booked on the second or third attempt.",
   "\"Does Tuesday at 10 or Thursday at 2 work?\" – easier to answer than \"when suits you?\"","Book three meetings this week and log them in the CRM.")],
 [("Mentalidad","a llamar sin miedo al no.",
   "El objetivo de una llamada en frío no es vender, es conseguir la reunión. Un no no es personal, es estadística. Más llamadas, más reuniones. Sonríe al llamar, se nota.",
   "Piensa \"siguiente\" tras un no en vez de darle vueltas.","Fíjate una meta: X llamadas al día, pase lo que pase."),
  ("La apertura y el gancho","a captar la atención en 30 segundos.",
   "Di quién eres, sé breve y pide 30 segundos. Sigue con un gancho concreto sobre su sector o web. Termina la apertura con una pregunta, no un monólogo.",
   "\"Hola [nombre], [tu nombre] de Applabbet. Te interrumpo: dame 30 segundos y me dices si te interesa.\"","Escribe tu apertura de 30 segundos y dila en voz alta diez veces."),
  ("Manejar \"envía info\"","a mantener la iniciativa ante rechazos corteses.",
   "\"Envía info\" suele ser un no amable. Acepta pero cualifica: pregunta qué les importa más para que el material sea relevante, y agenda un breve seguimiento para mantener la iniciativa.",
   "\"Claro: ¿qué es lo más importante ahora: más clientes, una web moderna o más visibilidad? Te mando lo adecuado y lo vemos el viernes.\"","Escribe tu respuesta a \"envía info y os contactamos\"."),
  ("Agenda la reunión y haz seguimiento","a cerrar la llamada con una hora agendada.",
   "Ofrece dos horas concretas en vez de una pregunta abierta. Confirma la hora en el calendario y por correo enseguida. Haz seguimiento de los que no responden: la mayoría de reuniones se agendan al segundo o tercer intento.",
   "\"¿Te va el martes a las 10 o el jueves a las 14?\": más fácil de responder que \"¿cuándo te viene bien?\"","Agenda tres reuniones esta semana y regístralas en el CRM.")])

# 5 Digital spetskunskap: SEO & GEO
add("Digital spetskunskap: SEO & GEO","Digital expertise: SEO & GEO","Conocimiento digital: SEO y GEO",5,
 "Förstå och sälja SEO och GEO – de tjänster som ger återkommande intäkt och syns svart på vitt i rapporter.",
 "Understand and sell SEO and GEO – the services that bring recurring revenue and show up in black and white in reports.",
 "Entiende y vende SEO y GEO: los servicios que generan ingresos recurrentes y se ven negro sobre blanco en los informes.",
 [("Så funkar SEO","förklara SEO enkelt för en kund.",
   "SEO gör att en sajt rankar högre på Google. Det bygger på on-page (titlar, innehåll, fart), content och länkar. Det är långsiktigt – resultat på 3–6 månader – men trafiken kostar inget per klick.",
   "\"Era kunder googlar redan det ni säljer – SEO avgör om de hittar er eller konkurrenten.\"","Förklara SEO för en kollega på 30 sekunder."),
  ("Vad är GEO?","förklara AI-synlighet och varför det är nytt.",
   "GEO handlar om att synas och rekommenderas i AI-sök som ChatGPT och Perplexity. Allt fler frågar AI istället för Google. Syns ni inte där finns ni inte i svaret. Konkurrenterna är oftast inte med än – det är försprånget.",
   "\"Hur beskriver ChatGPT ert företag idag? Om svaret är tomt är det en möjlighet.\"","Fråga ChatGPT om en bransch och se vilka som nämns."),
  ("Mätbarhet & rapporter","använda siffror för att bygga förtroende.",
   "Det som mäts går att sälja. Visa ranking, trafik och leads i månadsrapporten. Mätbarheten är ditt bästa motargument mot skepsis – det är inte löften, det är data.",
   "\"Varje månad ser ni svart på vitt hur ni klättrar och hur många leads det gav.\"","Lista tre nyckeltal du kan visa en kund."),
  ("Sälj nuläge → potential","skapa köplust med en enkel analys.",
   "Börja med en kostnadsfri synlighetsanalys: visa var de rankar idag och var de kan vara om tre månader. Glappet mellan nu och potential är säljargumentet. Avsluta med ett konkret nästa steg.",
   "\"Ni ligger på sida två på ert viktigaste sökord – här är planen för att nå topp tre.\"","Gör en snabb synlighetskoll på ett företag och formulera potentialen.")],
 [("How SEO works","to explain SEO simply to a customer.",
   "SEO makes a site rank higher on Google. It's built on on-page (titles, content, speed), content and links. It's long-term – results in 3–6 months – but the traffic costs nothing per click.",
   "\"Your customers already google what you sell – SEO decides whether they find you or the competitor.\"","Explain SEO to a colleague in 30 seconds."),
  ("What is GEO?","to explain AI visibility and why it's new.",
   "GEO is about being seen and recommended in AI search like ChatGPT and Perplexity. More and more people ask AI instead of Google. If you're not there, you're not in the answer. Competitors usually aren't there yet – that's the head start.",
   "\"How does ChatGPT describe your company today? If the answer is blank, that's an opportunity.\"","Ask ChatGPT about an industry and see who's mentioned."),
  ("Measurability & reports","to use numbers to build trust.",
   "What gets measured can be sold. Show ranking, traffic and leads in the monthly report. Measurability is your best counter to skepticism – it's not promises, it's data.",
   "\"Every month you see in black and white how you climb and how many leads it produced.\"","List three metrics you can show a customer."),
  ("Sell current state → potential","to create desire with a simple analysis.",
   "Start with a free visibility analysis: show where they rank today and where they could be in three months. The gap between now and potential is the sales argument. End with a concrete next step.",
   "\"You're on page two for your most important keyword – here's the plan to reach the top three.\"","Do a quick visibility check on a company and frame the potential.")],
 [("Cómo funciona el SEO","a explicar el SEO de forma sencilla a un cliente.",
   "El SEO hace que una web posicione más alto en Google. Se basa en on-page (títulos, contenido, velocidad), contenido y enlaces. Es a largo plazo —resultados en 3–6 meses— pero el tráfico no cuesta nada por clic.",
   "\"Tus clientes ya buscan lo que vendes en Google: el SEO decide si te encuentran a ti o al competidor.\"","Explica el SEO a un compañero en 30 segundos."),
  ("¿Qué es el GEO?","a explicar la visibilidad en IA y por qué es nueva.",
   "El GEO trata de aparecer y ser recomendado en buscadores de IA como ChatGPT y Perplexity. Cada vez más gente pregunta a la IA en vez de a Google. Si no estás ahí, no estás en la respuesta. Los competidores normalmente aún no están: esa es la ventaja.",
   "\"¿Cómo describe ChatGPT tu empresa hoy? Si la respuesta está vacía, es una oportunidad.\"","Pregunta a ChatGPT por un sector y mira a quién menciona."),
  ("Medición e informes","a usar números para generar confianza.",
   "Lo que se mide se puede vender. Muestra ranking, tráfico y leads en el informe mensual. La medición es tu mejor argumento contra el escepticismo: no son promesas, son datos.",
   "\"Cada mes ves negro sobre blanco cómo subes y cuántos leads generó.\"","Enumera tres métricas que puedes mostrar a un cliente."),
  ("Vende situación actual → potencial","a crear deseo con un análisis simple.",
   "Empieza con un análisis de visibilidad gratuito: muestra dónde posicionan hoy y dónde podrían estar en tres meses. La brecha entre el ahora y el potencial es el argumento de venta. Termina con un siguiente paso concreto.",
   "\"Estáis en la segunda página de vuestra palabra clave más importante: este es el plan para llegar al top tres.\"","Haz una comprobación rápida de visibilidad de una empresa y formula el potencial.")])

# 6 Produktmästaren
add("Produktmästaren","The product master","El maestro de producto",6,
 "Kunna alla paket utantill och snabbt matcha rätt lösning mot kundens behov och budget.",
 "Know every package by heart and quickly match the right solution to the customer's need and budget.",
 "Conoce todos los paquetes de memoria y empareja rápido la solución adecuada con la necesidad y el presupuesto del cliente.",
 [("Hemsidor & appar","skilja på landningssida, hemsida, MVP, webbapp och mobilapp.",
   "Landningssida (från 9 000 kr) för en kampanj, företagshemsida (18 000 kr) för närvaro, MVP (från 29 000 kr) för att validera, webbapp (från 49 000 kr) för funktionalitet, mobilapp (från 79 000 kr) för fickan. Matcha mot behovet.",
   "Behöver kunden inloggning och data? Då är det webbapp, inte hemsida.","Para ihop fem kundbehov med rätt produkt."),
  ("E-handel","välja rätt e-handelsnivå.",
   "Start (från 19 000 kr + 1 490 kr/mån) för få produkter, Plus (från 35 000 kr + 2 490 kr/mån) för växande butiker, Pro (från 59 000 kr + 4 900 kr/mån) för stora kataloger, B2B och ERP. Välj efter sortiment och integrationsbehov.",
   "Behöver de Fortnox-koppling och B2B-priser? Då är det Pro.","Motivera vilken nivå tre olika butiker borde ha."),
  ("SEO, GEO & design","sälja de löpande tjänsterna.",
   "SEO (från 4 900 kr/mån) och GEO (från 6 900 kr/mån) ger synlighet och återkommande intäkt. Designpartner (från 9 000 kr/mån) ger löpande design. Logotyp & varumärke (från 12 000 kr) är en bra dörröppnare.",
   "Efter en levererad hemsida är SEO/GEO den naturliga uppföljningen.","Föreslå en löpande tjänst till tre tidigare kunder."),
  ("Kombinationer & paket","öka affären med smarta kombinationer.",
   "Paketera ihop tjänster: Startpaket (hemsida + SEO), Tillväxtpaket (hemsida + SEO + GEO), MVP-paket (MVP + designpartner). Kombinationer höjer ordervärdet och ger kunden en helhet.",
   "\"Vill ni både synas och konvertera från dag ett? Då är Startpaketet rätt.\"","Sätt ihop ett eget paket för en påhittad kund.")],
 [("Websites & apps","to tell apart a landing page, website, MVP, web app and mobile app.",
   "Landing page (from SEK 9,000) for a campaign, business website (SEK 18,000) for presence, MVP (from SEK 29,000) to validate, web app (from SEK 49,000) for functionality, mobile app (from SEK 79,000) for the pocket. Match to the need.",
   "Does the customer need login and data? Then it's a web app, not a website.","Match five customer needs with the right product."),
  ("E-commerce","to choose the right e-commerce tier.",
   "Start (from SEK 19,000 + SEK 1,490/mo) for few products, Plus (from SEK 35,000 + SEK 2,490/mo) for growing stores, Pro (from SEK 59,000 + SEK 4,900/mo) for large catalogues, B2B and ERP. Choose by range and integration needs.",
   "Do they need a Fortnox connection and B2B pricing? Then it's Pro.","Justify which tier three different stores should have."),
  ("SEO, GEO & design","to sell the recurring services.",
   "SEO (from SEK 4,900/mo) and GEO (from SEK 6,900/mo) give visibility and recurring revenue. A design partner (from SEK 9,000/mo) gives ongoing design. Logo & brand (from SEK 12,000) is a great door-opener.",
   "After a delivered website, SEO/GEO is the natural follow-up.","Propose a recurring service to three past customers."),
  ("Combinations & bundles","to grow the deal with smart combinations.",
   "Bundle services: Starter bundle (website + SEO), Growth bundle (website + SEO + GEO), MVP bundle (MVP + design partner). Combinations raise the order value and give the customer a whole.",
   "\"Want to both be seen and convert from day one? Then the Starter bundle is right.\"","Put together your own bundle for an imagined customer.")],
 [("Webs y apps","a distinguir página de aterrizaje, web, MVP, app web y app móvil.",
   "Página de aterrizaje (desde 9 000 SEK) para una campaña, web corporativa (18 000 SEK) para presencia, MVP (desde 29 000 SEK) para validar, app web (desde 49 000 SEK) para funcionalidad, app móvil (desde 79 000 SEK) para el bolsillo. Empareja con la necesidad.",
   "¿El cliente necesita inicio de sesión y datos? Entonces es una app web, no una web.","Empareja cinco necesidades de cliente con el producto adecuado."),
  ("E-commerce","a elegir el nivel de e-commerce adecuado.",
   "Start (desde 19 000 SEK + 1 490 SEK/mes) para pocos productos, Plus (desde 35 000 SEK + 2 490 SEK/mes) para tiendas en crecimiento, Pro (desde 59 000 SEK + 4 900 SEK/mes) para catálogos grandes, B2B y ERP. Elige según catálogo y necesidades de integración.",
   "¿Necesitan conexión con Fortnox y precios B2B? Entonces es Pro.","Justifica qué nivel deberían tener tres tiendas distintas."),
  ("SEO, GEO y diseño","a vender los servicios recurrentes.",
   "SEO (desde 4 900 SEK/mes) y GEO (desde 6 900 SEK/mes) dan visibilidad e ingresos recurrentes. Un socio de diseño (desde 9 000 SEK/mes) da diseño continuo. Logotipo y marca (desde 12 000 SEK) es un buen abrepuertas.",
   "Tras entregar una web, el SEO/GEO es el seguimiento natural.","Propón un servicio recurrente a tres clientes anteriores."),
  ("Combinaciones y paquetes","a aumentar la venta con combinaciones inteligentes.",
   "Empaqueta servicios: Paquete inicial (web + SEO), Paquete de crecimiento (web + SEO + GEO), Paquete MVP (MVP + socio de diseño). Las combinaciones suben el valor del pedido y dan al cliente un conjunto.",
   "\"¿Queréis aparecer y convertir desde el primer día? Entonces el Paquete inicial es el adecuado.\"","Crea tu propio paquete para un cliente imaginario.")])

# 7 Storytelling & pitch
add("Storytelling & pitch","Storytelling & pitch","Storytelling y pitch",7,
 "Bygga en pitch som inger förtroende och får kunden att tänka \"jag måste ha detta\".",
 "Build a pitch that inspires trust and makes the customer think \"I must have this\".",
 "Construye un pitch que inspire confianza y haga que el cliente piense \"tengo que tener esto\".",
 [("Problem → lösning → resultat","strukturera en pitch som fastnar.",
   "Börja i kundens problem, visa lösningen, måla resultatet. Människor minns berättelser, inte funktionslistor. Sälj förändringen – från hur det är nu till hur det blir.",
   "\"Idag tappar ni kunder till en snabbare sajt. Med en ny hemsida vänder vi det – fler förfrågningar redan första månaden.\"","Skriv en pitch i tre meningar enligt problem–lösning–resultat."),
  ("Använd kundens egna ord","skräddarsy pitchen efter behovsanalysen.",
   "Den bästa pitchen ekar det kunden själv sagt. Anteckna nyckelord i mötet och spegla tillbaka dem. Då känner kunden sig förstådd och pitchen känns gjord för dem.",
   "\"Du sa att tid är er flaskhals – det här tar bort det manuella jobbet.\"","Ta tre kundcitat och bygg en mening kring varje."),
  ("Konkreta exempel & bevis","göra värdet trovärdigt.",
   "Abstrakta löften övertygar ingen. Använd siffror, exempel och referenser. \"En extra kund i månaden betalar sajten\" slår \"det blir bra\". Visa hellre än berätta.",
   "\"En liknande kund gick från sida två till topp tre på tre månader.\"","Hitta tre konkreta bevis du kan använda i en pitch."),
  ("Avsluta med en fråga","föra pitchen mot ett nästa steg.",
   "Avsluta aldrig en pitch med tystnad – avsluta med en fråga som öppnar för nästa steg. Det håller samtalet levande och visar att du leder. Frågan ska vara lätt att säga ja till.",
   "\"Ska jag ta fram ett förslag så går vi igenom det tillsammans på fredag?\"","Skriv tre avslutsfrågor som leder mot ett möte eller offert.")],
 [("Problem → solution → result","to structure a pitch that sticks.",
   "Start in the customer's problem, show the solution, paint the result. People remember stories, not feature lists. Sell the change – from how it is now to how it'll be.",
   "\"Today you lose customers to a faster site. With a new website we turn that around – more enquiries the very first month.\"","Write a three-sentence pitch using problem–solution–result."),
  ("Use the customer's own words","to tailor the pitch to the needs analysis.",
   "The best pitch echoes what the customer said themselves. Note keywords in the meeting and mirror them back. Then the customer feels understood and the pitch feels made for them.",
   "\"You said time is your bottleneck – this removes the manual work.\"","Take three customer quotes and build a sentence around each."),
  ("Concrete examples & proof","to make the value credible.",
   "Abstract promises convince no one. Use numbers, examples and references. \"One extra customer a month pays for the site\" beats \"it'll be great\". Show rather than tell.",
   "\"A similar customer went from page two to the top three in three months.\"","Find three concrete proofs you can use in a pitch."),
  ("End with a question","to move the pitch toward a next step.",
   "Never end a pitch with silence – end with a question that opens the next step. It keeps the conversation alive and shows you're leading. The question should be easy to say yes to.",
   "\"Shall I prepare a proposal and we go through it together on Friday?\"","Write three closing questions that lead toward a meeting or quote.")],
 [("Problema → solución → resultado","a estructurar un pitch que se quede.",
   "Empieza en el problema del cliente, muestra la solución, pinta el resultado. La gente recuerda historias, no listas de funciones. Vende el cambio: de cómo es ahora a cómo será.",
   "\"Hoy perdéis clientes ante una web más rápida. Con una web nueva lo revertimos: más solicitudes ya el primer mes.\"","Escribe un pitch de tres frases con problema–solución–resultado."),
  ("Usa las palabras del cliente","a adaptar el pitch al análisis de necesidades.",
   "El mejor pitch repite lo que el cliente dijo. Anota palabras clave en la reunión y refléjalas. Así el cliente se siente comprendido y el pitch parece hecho para él.",
   "\"Dijiste que el tiempo es vuestro cuello de botella: esto elimina el trabajo manual.\"","Toma tres citas del cliente y construye una frase con cada una."),
  ("Ejemplos concretos y pruebas","a hacer creíble el valor.",
   "Las promesas abstractas no convencen a nadie. Usa números, ejemplos y referencias. \"Un cliente extra al mes paga la web\" supera a \"quedará genial\". Muestra en vez de contar.",
   "\"Un cliente parecido pasó de la segunda página al top tres en tres meses.\"","Encuentra tres pruebas concretas para usar en un pitch."),
  ("Termina con una pregunta","a llevar el pitch hacia un siguiente paso.",
   "Nunca termines un pitch en silencio: termina con una pregunta que abra el siguiente paso. Mantiene viva la conversación y muestra que tú diriges. La pregunta debe ser fácil de responder con un sí.",
   "\"¿Preparo una propuesta y la repasamos juntos el viernes?\"","Escribe tres preguntas de cierre que lleven a una reunión o presupuesto.")])

# 8 CRM-mästaren
add("CRM-mästaren","The CRM master","El maestro del CRM",8,
 "Jobba effektivt i CRM:t så att ingen affär faller mellan stolarna – alltid med ett tydligt nästa steg.",
 "Work effectively in the CRM so no deal slips through the cracks – always with a clear next step.",
 "Trabaja con eficacia en el CRM para que ninguna venta se pierda: siempre con un siguiente paso claro.",
 [("Lägg in & jobba leads","skapa och underhålla leads rätt.",
   "Skapa en lead så fort du ser en möjlighet – med företagsnamn, kontakt och din observation. En lead som inte finns i CRM:t glöms bort. Uppdatera status löpande.",
   "Direkt efter ett samtal: logga vad som sades och nästa steg.","Lägg in fem leads och fyll i alla fält ordentligt."),
  ("Uppgifter & möten","använda CRM:t för att aldrig tappa en tråd.",
   "Lägg en uppgift eller boka ett möte för varje lead. Sätt datum så systemet påminner dig. Det är skillnaden mellan att jaga och att ha kontroll.",
   "Lovade du återkomma på fredag? Lägg en uppgift direkt så glöms det inte.","Skapa en uppgift för varje aktiv lead du har."),
  ("Alltid ett nästa steg","hålla varje affär i rörelse.",
   "En lead utan nästa steg dör. Avsluta varje kontakt med att boka nästa: ett möte, en återkoppling, en offert. Pipeline är inte en lista – det är affärer i rörelse.",
   "Innan du avslutar ett samtal: \"Nästa steg är… ska vi säga [datum]?\"","Gå igenom din pipeline och säkerställ att varje lead har ett nästa steg."),
  ("Öva i Sandbox","testa funktioner utan risk.",
   "Osäker på hur något fungerar? Sandbox-fliken är en kopia av CRM:t där inget sparas. Klicka runt, prova, lär dig – sen kör du skarpt med säkra händer.",
   "Innan du skickar ditt första mail på riktigt: testa flödet i Sandbox.","Gå igenom varje flik i Sandbox en gång.")],
 [("Add & work leads","to create and maintain leads properly.",
   "Create a lead as soon as you spot an opportunity – with company name, contact and your observation. A lead that's not in the CRM gets forgotten. Update the status continuously.",
   "Right after a call: log what was said and the next step.","Add five leads and fill in every field properly."),
  ("Tasks & meetings","to use the CRM so you never lose a thread.",
   "Add a task or book a meeting for every lead. Set a date so the system reminds you. It's the difference between chasing and being in control.",
   "Promised to get back on Friday? Add a task right away so it's not forgotten.","Create a task for every active lead you have."),
  ("Always a next step","to keep every deal moving.",
   "A lead with no next step dies. End every contact by booking the next one: a meeting, a follow-up, a quote. A pipeline isn't a list – it's deals in motion.",
   "Before you end a call: \"The next step is… shall we say [date]?\"","Go through your pipeline and make sure every lead has a next step."),
  ("Practise in Sandbox","to test features risk-free.",
   "Unsure how something works? The Sandbox tab is a copy of the CRM where nothing is saved. Click around, try, learn – then go live with confidence.",
   "Before you send your first email for real: test the flow in Sandbox.","Go through every tab in Sandbox once.")],
 [("Añade y trabaja leads","a crear y mantener leads correctamente.",
   "Crea un lead en cuanto veas una oportunidad: con nombre de empresa, contacto y tu observación. Un lead que no está en el CRM se olvida. Actualiza el estado de forma continua.",
   "Justo tras una llamada: registra lo que se dijo y el siguiente paso.","Añade cinco leads y rellena bien cada campo."),
  ("Tareas y reuniones","a usar el CRM para no perder nunca un hilo.",
   "Añade una tarea o agenda una reunión para cada lead. Pon fecha para que el sistema te recuerde. Es la diferencia entre perseguir y tener el control.",
   "¿Prometiste contactar el viernes? Añade una tarea enseguida para no olvidarlo.","Crea una tarea para cada lead activo que tengas."),
  ("Siempre un siguiente paso","a mantener cada venta en movimiento.",
   "Un lead sin siguiente paso muere. Termina cada contacto agendando el siguiente: una reunión, un seguimiento, un presupuesto. Un pipeline no es una lista: son ventas en movimiento.",
   "Antes de terminar una llamada: \"El siguiente paso es… ¿decimos [fecha]?\"","Revisa tu pipeline y asegúrate de que cada lead tenga un siguiente paso."),
  ("Practica en Sandbox","a probar funciones sin riesgo.",
   "¿No sabes cómo funciona algo? La pestaña Sandbox es una copia del CRM donde no se guarda nada. Haz clic, prueba, aprende, y luego trabaja en real con seguridad.",
   "Antes de enviar tu primer correo de verdad: prueba el flujo en Sandbox.","Recorre cada pestaña de Sandbox una vez.")])

rows=[]
for svt,ent,est,ordn,gsv,gen,ges,msv,men,mes in C:
    rows.append(f"  ({slit(svt)}, {slit(ent)}, {slit(est)}, {jlit('sv',gsv,msv)}, {jlit('en',gen,men)}, {jlit('es',ges,mes)}, {ordn})")
values=",\n".join(rows)
sql=f"""-- Seed courses 4-8 (approach A) into the Kurser category, sv/en/es.
INSERT INTO public.training_items
  (category_id, title, title_en, title_es, body, body_en, body_es, sort_order, is_published)
SELECT cat.id, v.title, v.title_en, v.title_es, v.body, v.body_en, v.body_es, v.ord, true
FROM (VALUES
{values}
) AS v(title, title_en, title_es, body, body_en, body_es, ord)
JOIN public.training_categories cat ON cat.slug = 'kurser'
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_items ti
  WHERE ti.category_id = cat.id AND ti.title = v.title
);
"""
open(OUT,"w",encoding="utf-8").write(sql)
import re
docs=re.findall(r"\$j\$(.*?)\$j\$",sql,re.S)
for d in docs: json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(C), "courses,", len(docs), "json docs")
