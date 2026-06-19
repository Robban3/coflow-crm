#!/usr/bin/env python3
"""Seed Quiz: one quiz item per course, multiple-choice questions with the
correct answer + a short explanation. sv/en/es."""
import json, os
OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260619250000_quiz_seed.sql")
QL = {"sv": ("Fråga", "Rätt svar"), "en": ("Question", "Correct answer"),
      "es": ("Pregunta", "Respuesta correcta")}

def build(lang, questions):
    qL, aL = QL[lang]
    content = []
    for i, (q, opts, correct, expl) in enumerate(questions, 1):
        content.append({"type": "paragraph", "content": [
            {"type": "text", "marks": [{"type": "bold"}], "text": f"{qL} {i}: "},
            {"type": "text", "text": q}]})
        items = []
        for j, opt in enumerate(opts):
            items.append({"type": "listItem", "content": [{"type": "paragraph",
                "content": [{"type": "text", "text": f"{chr(65+j)}) {opt}"}]}]})
        content.append({"type": "bulletList", "content": items})
        content.append({"type": "paragraph", "content": [
            {"type": "text", "marks": [{"type": "bold"}], "text": f"{aL}: "},
            {"type": "text", "text": f"{chr(65+correct)} – {expl}"}]})
    return json.dumps({"type": "doc", "content": content}, ensure_ascii=False)

def jlit(lang, qs): return "$j$" + build(lang, qs) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

Q = []
def add(svt, ent, est, ordn, sv, en, es): Q.append((svt, ent, est, ordn, sv, en, es))

# 1
add("Quiz: Grundkurs", "Quiz: Foundation course", "Quiz: Curso base", 1,
 [("Vad är målet med ett kallt samtal?", ["Att stänga affären direkt","Att boka ett möte","Att skicka en offert"], 1, "Målet är att boka mötet – inte att sälja i telefon."),
  ("Vilket steg avgör oftast affären?", ["Behovsanalysen","Prospekteringen","Överlämningen"], 0, "I behovsanalysen förstår du vad du ska lösa."),
  ("Vad bör du alltid ha med vid första kontakten?", ["En färdig offert","En konkret observation om dem","Ett rabatterbjudande"], 1, "En konkret krok visar att du gjort din läxa."),
  ("Vem kontaktar kunden efter att avtalet är påskrivet?", ["Säljaren fortsätter ansvara","Bygg-teamet tar över","Ingen, kunden hör av sig själv"], 1, "Efter avtal tar bygg-teamet över och kontaktar kunden.")],
 [("What's the goal of a cold call?", ["To close the deal right away","To book a meeting","To send a quote"], 1, "The goal is to book the meeting – not to sell on the phone."),
  ("Which step usually decides the deal?", ["The needs analysis","The prospecting","The handover"], 0, "In the needs analysis you understand what to solve."),
  ("What should you always bring to a first contact?", ["A finished quote","A concrete observation about them","A discount offer"], 1, "A concrete hook shows you've done your homework."),
  ("Who contacts the customer after the agreement is signed?", ["The salesperson stays responsible","The build team takes over","No one, the customer reaches out"], 1, "After the agreement the build team takes over and contacts the customer.")],
 [("¿Cuál es el objetivo de una llamada en frío?", ["Cerrar la venta de inmediato","Agendar una reunión","Enviar un presupuesto"], 1, "El objetivo es agendar la reunión, no vender por teléfono."),
  ("¿Qué paso suele decidir la venta?", ["El análisis de necesidades","La prospección","El traspaso"], 0, "En el análisis de necesidades entiendes qué resolver."),
  ("¿Qué debes llevar siempre a un primer contacto?", ["Un presupuesto cerrado","Una observación concreta sobre ellos","Una oferta de descuento"], 1, "Un gancho concreto muestra que has hecho los deberes."),
  ("¿Quién contacta al cliente tras firmar el acuerdo?", ["El vendedor sigue a cargo","El equipo de construcción toma el relevo","Nadie, el cliente contacta solo"], 1, "Tras el acuerdo, el equipo de construcción toma el relevo y contacta al cliente.")])

# 2
add("Quiz: Behovsanalys & frågeteknik", "Quiz: Needs analysis & questioning", "Quiz: Análisis de necesidades", 2,
 [("Hur stor andel öppna frågor bör du ställa i behovsanalysen?", ["Cirka 20 %","Cirka 50 %","Cirka 80 %"], 2, "Tumregeln är ca 80 % öppna frågor."),
  ("Vilken fråga är öppen?", ["Är ni nöjda med er hemsida?","Hur får ni in nya kunder idag?","Har ni en budget?"], 1, "Öppna frågor börjar med Hur/Vad/Varför och får kunden att prata."),
  ("Varför ska du anteckna kundens nyckelord?", ["För att fylla tiden","För att använda dem i pitchen","För att visa att du skriver"], 1, "Du speglar tillbaka kundens egna ord i pitchen."),
  ("Hur mycket bör du lyssna jämfört med att prata?", ["Prata mest","Ungefär lika","Lyssna mest"], 2, "Lyssna mer än du pratar – ca 70 %.")],
 [("What share of open questions should you ask in the needs analysis?", ["About 20%","About 50%","About 80%"], 2, "Rule of thumb is about 80% open questions."),
  ("Which question is open?", ["Are you happy with your website?","How do you get new customers today?","Do you have a budget?"], 1, "Open questions start with How/What/Why and get the customer talking."),
  ("Why should you note the customer's keywords?", ["To fill the time","To use them in the pitch","To show you're writing"], 1, "You mirror the customer's own words back in the pitch."),
  ("How much should you listen versus talk?", ["Talk most","About equal","Listen most"], 2, "Listen more than you talk – about 70%.")],
 [("¿Qué proporción de preguntas abiertas deberías hacer en el análisis?", ["Un 20%","Un 50%","Un 80%"], 2, "La regla general es alrededor del 80% de preguntas abiertas."),
  ("¿Qué pregunta es abierta?", ["¿Estáis contentos con vuestra web?","¿Cómo conseguís clientes hoy?","¿Tenéis presupuesto?"], 1, "Las preguntas abiertas empiezan con Cómo/Qué/Por qué y hacen hablar al cliente."),
  ("¿Por qué deberías anotar las palabras clave del cliente?", ["Para rellenar el tiempo","Para usarlas en el pitch","Para mostrar que escribes"], 1, "Reflejas las propias palabras del cliente en el pitch."),
  ("¿Cuánto deberías escuchar frente a hablar?", ["Hablar más","Más o menos igual","Escuchar más"], 2, "Escucha más de lo que hablas, alrededor del 70%.")])

# 3
add("Quiz: Invändningshantering & förhandling", "Quiz: Objection handling & negotiation", "Quiz: Manejo de objeciones", 3,
 [("Vad står metoden \"bekräfta – vänd – fråga\" för?", ["Tre steg för att hantera en invändning","En prismodell","En typ av offert"], 0, "Bekräfta känslan, vänd till värde, avsluta med en fråga."),
  ("Vad betyder \"det är för dyrt\" oftast?", ["Kunden saknar pengar","Kunden ser inte värdet än","Kunden vill avsluta"], 1, "Oftast är värdet inte tydligt än."),
  ("Vad bör du helst sänka istället för priset?", ["Kvaliteten","Omfånget","Supporten"], 1, "Sänk omfånget hellre än priset – ge inte bort värde gratis."),
  ("Vad gör du med en invändning som \"skicka info\"?", ["Släpper taget","Behåller initiativet och föreslår en återkoppling","Sänker priset"], 1, "Behåll initiativet och boka en kort återkoppling eller möte.")],
 [("What does the \"acknowledge – turn – ask\" method stand for?", ["Three steps to handle an objection","A pricing model","A type of quote"], 0, "Acknowledge the feeling, turn to value, end with a question."),
  ("What does \"it's too expensive\" usually mean?", ["The customer lacks money","The customer doesn't see the value yet","The customer wants to end"], 1, "Usually the value just isn't clear yet."),
  ("What should you preferably lower instead of the price?", ["The quality","The scope","The support"], 1, "Lower the scope rather than the price – don't give value away for free."),
  ("What do you do with an objection like \"send info\"?", ["Let go","Keep the initiative and propose a follow-up","Lower the price"], 1, "Keep the initiative and book a short follow-up or meeting.")],
 [("¿Qué significa el método \"reconoce – gira – pregunta\"?", ["Tres pasos para manejar una objeción","Un modelo de precios","Un tipo de presupuesto"], 0, "Reconoce la emoción, gira hacia el valor, termina con una pregunta."),
  ("¿Qué suele significar \"es demasiado caro\"?", ["Al cliente le falta dinero","El cliente aún no ve el valor","El cliente quiere terminar"], 1, "Normalmente el valor todavía no está claro."),
  ("¿Qué deberías reducir preferiblemente en vez del precio?", ["La calidad","El alcance","El soporte"], 1, "Reduce el alcance antes que el precio: no regales valor."),
  ("¿Qué haces con una objeción como \"envía info\"?", ["Soltar","Mantener la iniciativa y proponer un seguimiento","Bajar el precio"], 1, "Mantén la iniciativa y agenda un breve seguimiento o reunión.")])

# 4
add("Quiz: Mötesbokning & kalla samtal", "Quiz: Booking meetings & cold calls", "Quiz: Agendar reuniones y llamadas", 4,
 [("Hur bör du föreslå mötestid?", ["Fråga öppet \"när passar det?\"","Föreslå två konkreta tider","Vänta på att kunden föreslår"], 1, "Två konkreta tider är lättare att svara på."),
  ("Hur ser du på ett nej i ett kallt samtal?", ["Som ett personligt misslyckande","Som statistik på vägen till ett ja","Som ett skäl att sluta ringa"], 1, "Ett nej är statistik – fler samtal ger fler möten."),
  ("Hur lång tid bör du be om i öppningen?", ["30 sekunder","5 minuter","Ingen tidsangivelse"], 0, "Be om 30 sekunder – lågtröskel och respektfullt."),
  ("På vilket försök bokas de flesta möten?", ["Första","Andra eller tredje","Aldrig, de ringer själva"], 1, "De flesta möten bokas på andra eller tredje försöket – följ upp.")],
 [("How should you propose a meeting time?", ["Ask openly \"when suits you?\"","Offer two concrete times","Wait for the customer to suggest"], 1, "Two concrete times are easier to answer."),
  ("How should you view a no in a cold call?", ["As a personal failure","As statistics on the way to a yes","As a reason to stop calling"], 1, "A no is statistics – more calls mean more meetings."),
  ("How much time should you ask for in the opening?", ["30 seconds","5 minutes","No time mentioned"], 0, "Ask for 30 seconds – low threshold and respectful."),
  ("On which attempt are most meetings booked?", ["The first","The second or third","Never, they call themselves"], 1, "Most meetings are booked on the second or third attempt – follow up.")],
 [("¿Cómo deberías proponer una hora de reunión?", ["Preguntar abierto \"¿cuándo te va?\"","Ofrecer dos horas concretas","Esperar a que el cliente proponga"], 1, "Dos horas concretas son más fáciles de responder."),
  ("¿Cómo deberías ver un no en una llamada en frío?", ["Como un fracaso personal","Como estadística camino de un sí","Como motivo para dejar de llamar"], 1, "Un no es estadística: más llamadas, más reuniones."),
  ("¿Cuánto tiempo deberías pedir en la apertura?", ["30 segundos","5 minutos","Sin mencionar tiempo"], 0, "Pide 30 segundos: bajo compromiso y respetuoso."),
  ("¿En qué intento se agendan la mayoría de reuniones?", ["El primero","El segundo o tercero","Nunca, llaman ellos"], 1, "La mayoría se agendan al segundo o tercer intento: haz seguimiento.")])

# 5
add("Quiz: SEO & GEO", "Quiz: SEO & GEO", "Quiz: SEO y GEO", 5,
 [("När brukar SEO ge resultat?", ["Direkt","På 3–6 månader","Aldrig mätbart"], 1, "SEO är långsiktigt – oftast 3–6 månader."),
  ("Vad är GEO?", ["Synlighet i AI-sök som ChatGPT","En typ av hemsida","Ett betalningssätt"], 0, "GEO handlar om att synas och rekommenderas i AI-sök."),
  ("Vad är ditt bästa motargument mot skepsis?", ["Lägre pris","Mätbarhet och rapporter","Längre avtal"], 1, "Det som mäts går att sälja – visa data, inte löften."),
  ("Vad gör GEO till ett försprång just nu?", ["Det är gratis","Konkurrenterna syns oftast inte där än","Google har slutat fungera"], 1, "Tidigt läge – konkurrenterna är sällan med i AI-svaren än.")],
 [("When does SEO usually deliver results?", ["Immediately","In 3–6 months","Never measurable"], 1, "SEO is long-term – usually 3–6 months."),
  ("What is GEO?", ["Visibility in AI search like ChatGPT","A type of website","A payment method"], 0, "GEO is about being seen and recommended in AI search."),
  ("What's your best counter to skepticism?", ["A lower price","Measurability and reports","A longer contract"], 1, "What gets measured can be sold – show data, not promises."),
  ("What makes GEO a head start right now?", ["It's free","Competitors usually aren't there yet","Google has stopped working"], 1, "Early stage – competitors are rarely in the AI answers yet.")],
 [("¿Cuándo suele dar resultados el SEO?", ["De inmediato","En 3–6 meses","Nunca es medible"], 1, "El SEO es a largo plazo: normalmente 3–6 meses."),
  ("¿Qué es el GEO?", ["Visibilidad en buscadores de IA como ChatGPT","Un tipo de web","Un método de pago"], 0, "El GEO trata de aparecer y ser recomendado en buscadores de IA."),
  ("¿Cuál es tu mejor argumento contra el escepticismo?", ["Un precio más bajo","Medición e informes","Un contrato más largo"], 1, "Lo que se mide se puede vender: muestra datos, no promesas."),
  ("¿Qué hace del GEO una ventaja ahora mismo?", ["Es gratis","Los competidores normalmente aún no están","Google ha dejado de funcionar"], 1, "Etapa temprana: los competidores rara vez están aún en las respuestas de IA.")])

# 6
add("Quiz: Produktmästaren", "Quiz: The product master", "Quiz: El maestro de producto", 6,
 [("Vad kostar en företagshemsida?", ["9 000 kr","18 000 kr","49 000 kr"], 1, "Företagshemsidan ligger på 18 000 kr."),
  ("Kunden behöver inloggning och data – vad föreslår du?", ["Landningssida","Webbapp","Logotyp"], 1, "Inloggning och data = webbapp, inte en vanlig hemsida."),
  ("Vilken e-handelsnivå har ERP-integration (Fortnox/Visma)?", ["Start","Plus","Pro"], 2, "ERP-integration ingår på Pro-nivån."),
  ("Vad innehåller Startpaketet?", ["Hemsida + SEO","MVP + design","Bara en logotyp"], 0, "Startpaketet kombinerar företagshemsida med löpande SEO.")],
 [("What does a business website cost?", ["SEK 9,000","SEK 18,000","SEK 49,000"], 1, "The business website is SEK 18,000."),
  ("The customer needs login and data – what do you propose?", ["Landing page","Web app","Logo"], 1, "Login and data = web app, not a regular website."),
  ("Which e-commerce tier has ERP integration (Fortnox/Visma)?", ["Start","Plus","Pro"], 2, "ERP integration is included on the Pro tier."),
  ("What does the Starter bundle contain?", ["Website + SEO","MVP + design","Just a logo"], 0, "The Starter bundle combines a business website with ongoing SEO.")],
 [("¿Cuánto cuesta una web corporativa?", ["9 000 SEK","18 000 SEK","49 000 SEK"], 1, "La web corporativa cuesta 18 000 SEK."),
  ("El cliente necesita inicio de sesión y datos, ¿qué propones?", ["Página de aterrizaje","Aplicación web","Logotipo"], 1, "Inicio de sesión y datos = app web, no una web normal."),
  ("¿Qué nivel de e-commerce tiene integración ERP (Fortnox/Visma)?", ["Start","Plus","Pro"], 2, "La integración ERP se incluye en el nivel Pro."),
  ("¿Qué incluye el Paquete inicial?", ["Web + SEO","MVP + diseño","Solo un logotipo"], 0, "El Paquete inicial combina una web corporativa con SEO continuo.")])

# 7
add("Quiz: Storytelling & pitch", "Quiz: Storytelling & pitch", "Quiz: Storytelling y pitch", 7,
 [("Vilken struktur bygger en pitch som fastnar?", ["Pris – funktion – garanti","Problem – lösning – resultat","Historik – team – kontor"], 1, "Börja i problemet, visa lösningen, måla resultatet."),
  ("Varför använda kundens egna ord i pitchen?", ["Det fyller tid","Kunden känner sig förstådd","Det låter mer tekniskt"], 1, "Speglar du kundens ord känns pitchen gjord för dem."),
  ("Vad gör värdet mest trovärdigt?", ["Stora löften","Konkreta siffror och exempel","Långa beskrivningar"], 1, "Siffror, exempel och referenser slår abstrakta löften."),
  ("Hur bör du avsluta en pitch?", ["Med tystnad","Med en fråga som öppnar nästa steg","Med en prislista"], 1, "Avsluta med en fråga som leder mot nästa steg.")],
 [("Which structure builds a pitch that sticks?", ["Price – feature – guarantee","Problem – solution – result","History – team – office"], 1, "Start in the problem, show the solution, paint the result."),
  ("Why use the customer's own words in the pitch?", ["It fills time","The customer feels understood","It sounds more technical"], 1, "Mirroring the customer's words makes the pitch feel made for them."),
  ("What makes the value most credible?", ["Big promises","Concrete numbers and examples","Long descriptions"], 1, "Numbers, examples and references beat abstract promises."),
  ("How should you end a pitch?", ["With silence","With a question that opens the next step","With a price list"], 1, "End with a question that leads to the next step.")],
 [("¿Qué estructura construye un pitch que se queda?", ["Precio – función – garantía","Problema – solución – resultado","Historia – equipo – oficina"], 1, "Empieza en el problema, muestra la solución, pinta el resultado."),
  ("¿Por qué usar las palabras del cliente en el pitch?", ["Rellena tiempo","El cliente se siente comprendido","Suena más técnico"], 1, "Reflejar las palabras del cliente hace que el pitch parezca hecho para él."),
  ("¿Qué hace más creíble el valor?", ["Grandes promesas","Números y ejemplos concretos","Descripciones largas"], 1, "Números, ejemplos y referencias superan a las promesas abstractas."),
  ("¿Cómo deberías terminar un pitch?", ["Con silencio","Con una pregunta que abra el siguiente paso","Con una lista de precios"], 1, "Termina con una pregunta que lleve al siguiente paso.")])

# 8
add("Quiz: CRM-mästaren", "Quiz: The CRM master", "Quiz: El maestro del CRM", 8,
 [("När bör du skapa en lead i CRM:t?", ["Efter att affären är klar","Så fort du ser en möjlighet","Bara om kunden ber om det"], 1, "Skapa leaden direkt – annars glöms möjligheten bort."),
  ("Vad kännetecknar en lead som riskerar att dö?", ["Den har ett nästa steg","Den saknar nästa steg","Den har en bokad uppgift"], 1, "En lead utan nästa steg dör – boka alltid nästa steg."),
  ("Vad är Sandbox-fliken till för?", ["Skarpa kunddata","Att öva utan att något sparas","Att skicka fakturor"], 1, "Sandbox är en kopia där inget sparas – öva fritt."),
  ("Hur säkerställer du att inget faller mellan stolarna?", ["Litar på minnet","Lägger uppgifter och möten med datum","Väntar på kunden"], 1, "Uppgifter och möten med datum gör att systemet påminner dig.")],
 [("When should you create a lead in the CRM?", ["After the deal is done","As soon as you spot an opportunity","Only if the customer asks"], 1, "Create the lead right away – otherwise the opportunity is forgotten."),
  ("What characterises a lead at risk of dying?", ["It has a next step","It lacks a next step","It has a booked task"], 1, "A lead with no next step dies – always book the next step."),
  ("What is the Sandbox tab for?", ["Real customer data","Practising without anything being saved","Sending invoices"], 1, "Sandbox is a copy where nothing is saved – practise freely."),
  ("How do you make sure nothing slips through the cracks?", ["Rely on memory","Add tasks and meetings with dates","Wait for the customer"], 1, "Tasks and meetings with dates make the system remind you.")],
 [("¿Cuándo deberías crear un lead en el CRM?", ["Tras cerrar la venta","En cuanto veas una oportunidad","Solo si el cliente lo pide"], 1, "Crea el lead enseguida: si no, la oportunidad se olvida."),
  ("¿Qué caracteriza a un lead en riesgo de morir?", ["Tiene un siguiente paso","Le falta un siguiente paso","Tiene una tarea agendada"], 1, "Un lead sin siguiente paso muere: agenda siempre el siguiente paso."),
  ("¿Para qué sirve la pestaña Sandbox?", ["Datos reales de clientes","Practicar sin que se guarde nada","Enviar facturas"], 1, "Sandbox es una copia donde no se guarda nada: practica libremente."),
  ("¿Cómo te aseguras de que nada se pierda?", ["Confiar en la memoria","Añadir tareas y reuniones con fecha","Esperar al cliente"], 1, "Las tareas y reuniones con fecha hacen que el sistema te recuerde.")])

rows = []
for svt, ent, est, ordn, sv, en, es in Q:
    rows.append(f"  ({slit(svt)}, {slit(ent)}, {slit(est)}, {jlit('sv', sv)}, {jlit('en', en)}, {jlit('es', es)}, {ordn})")
values = ",\n".join(rows)
sql = f"""-- Seed Quiz: one quiz item per course (multiple choice + answer), sv/en/es.
INSERT INTO public.training_items
  (category_id, title, title_en, title_es, body, body_en, body_es, sort_order, is_published)
SELECT cat.id, v.title, v.title_en, v.title_es, v.body, v.body_en, v.body_es, v.ord, true
FROM (VALUES
{values}
) AS v(title, title_en, title_es, body, body_en, body_es, ord)
JOIN public.training_categories cat ON cat.slug = 'quiz'
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_items ti
  WHERE ti.category_id = cat.id AND ti.title = v.title
);
"""
open(OUT, "w", encoding="utf-8").write(sql)
import re
docs = re.findall(r"\$j\$(.*?)\$j\$", sql, re.S)
for d in docs:
    json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(Q), "quizzes,", len(docs), "json docs")
