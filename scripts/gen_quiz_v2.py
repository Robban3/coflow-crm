#!/usr/bin/env python3
"""Seed the interactive quiz bank into public.quizzes + public.quiz_questions.
~15 questions per course, sv/en/es. Each question = (correct_index, (q,[opts],expl)
per language). Emits supabase/migrations/20260620110000_quiz_interactive_seed.sql."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260620110000_quiz_interactive_seed.sql")

def slit(s): return "'" + s.replace("'", "''") + "'"
def jarr(lst): return "$j$" + json.dumps(lst, ensure_ascii=False) + "$j$::jsonb"

QUIZZES = []
def quiz(key, svt, ent, est, questions):
    QUIZZES.append((key, svt, ent, est, questions))
def Q(ci, sv, en, es):
    # sv/en/es each = (question, [options], explanation)
    return (ci, sv, en, es)

# ── 1. Grundkurs ────────────────────────────────────────────────────────────
quiz("grundkurs", "Quiz: Grundkurs", "Quiz: Foundation course", "Quiz: Curso base", [
 Q(1, ("Vad är målet med ett kallt samtal?", ["Att stänga affären direkt","Att boka ett möte","Att skicka en offert"], "Målet är att boka mötet – inte att sälja i telefon."),
      ("What's the goal of a cold call?", ["To close the deal right away","To book a meeting","To send a quote"], "The goal is to book the meeting – not to sell on the phone."),
      ("¿Cuál es el objetivo de una llamada en frío?", ["Cerrar la venta de inmediato","Agendar una reunión","Enviar un presupuesto"], "El objetivo es agendar la reunión, no vender por teléfono.")),
 Q(0, ("Vilket steg avgör oftast affären?", ["Behovsanalysen","Prospekteringen","Överlämningen"], "I behovsanalysen förstår du vad du ska lösa."),
      ("Which step usually decides the deal?", ["The needs analysis","The prospecting","The handover"], "In the needs analysis you understand what to solve."),
      ("¿Qué paso suele decidir la venta?", ["El análisis de necesidades","La prospección","El traspaso"], "En el análisis de necesidades entiendes qué resolver.")),
 Q(1, ("Vad bör du alltid ha med vid första kontakten?", ["En färdig offert","En konkret observation om dem","Ett rabatterbjudande"], "En konkret krok visar att du gjort din läxa."),
      ("What should you always bring to a first contact?", ["A finished quote","A concrete observation about them","A discount offer"], "A concrete hook shows you've done your homework."),
      ("¿Qué debes llevar siempre a un primer contacto?", ["Un presupuesto cerrado","Una observación concreta sobre ellos","Una oferta de descuento"], "Un gancho concreto muestra que has hecho los deberes.")),
 Q(1, ("Vem kontaktar kunden efter att avtalet är påskrivet?", ["Säljaren fortsätter ansvara","Bygg-teamet tar över","Ingen, kunden hör av sig själv"], "Efter avtal tar bygg-teamet över och kontaktar kunden."),
      ("Who contacts the customer after the agreement is signed?", ["The salesperson stays responsible","The build team takes over","No one, the customer reaches out"], "After the agreement the build team takes over and contacts the customer."),
      ("¿Quién contacta al cliente tras firmar el acuerdo?", ["El vendedor sigue a cargo","El equipo de construcción toma el relevo","Nadie, el cliente contacta solo"], "Tras el acuerdo, el equipo de construcción toma el relevo.")),
 Q(1, ("Vad är första steget i säljprocessen?", ["Behovsanalys","Prospektering","Avslut"], "Allt börjar med att hitta rätt företag."),
      ("What is the first step of the sales process?", ["Needs analysis","Prospecting","Closing"], "It all starts with finding the right company."),
      ("¿Cuál es el primer paso del proceso de ventas?", ["Análisis de necesidades","Prospección","Cierre"], "Todo empieza por encontrar la empresa adecuada.")),
 Q(2, ("Hur många steg har säljprocessen enligt grundkursen?", ["Tre","Fem","Sju"], "Prospektering till överlämning – sju steg."),
      ("How many steps does the sales process have in the foundation course?", ["Three","Five","Seven"], "Prospecting to handover – seven steps."),
      ("¿Cuántos pasos tiene el proceso de ventas en el curso base?", ["Tres","Cinco","Siete"], "De prospección a traspaso: siete pasos.")),
 Q(1, ("Vad bör du göra mest av i behovsanalysen?", ["Prata","Lyssna","Presentera"], "Lyssna mer än du pratar."),
      ("What should you do most of in the needs analysis?", ["Talk","Listen","Present"], "Listen more than you talk."),
      ("¿Qué deberías hacer más en el análisis de necesidades?", ["Hablar","Escuchar","Presentar"], "Escucha más de lo que hablas.")),
 Q(1, ("Vad är syftet med överlämningen?", ["Sälja mer direkt","Att kunden tas väl om hand när teamet tar över","Avsluta kontakten helt"], "En trygg överlämning gör kunden väl omhändertagen."),
      ("What is the purpose of the handover?", ["To upsell immediately","That the customer is well cared for as the team takes over","To end contact entirely"], "A smooth handover makes the customer feel cared for."),
      ("¿Cuál es el propósito del traspaso?", ["Vender más de inmediato","Que el cliente esté bien atendido al tomar el relevo el equipo","Cortar el contacto por completo"], "Un traspaso fluido hace que el cliente se sienta atendido.")),
 Q(1, ("När du presenterar förslaget bör du...", ["presentera hela katalogen","bara presentera det som löser kundens behov","fokusera på priset"], "Presentera bara det som löser det de berättade."),
      ("When you present the proposal you should...", ["present the whole catalogue","present only what solves the customer's need","focus on the price"], "Present only what solves what they told you."),
      ("Al presentar la propuesta deberías...", ["presentar todo el catálogo","presentar solo lo que resuelve la necesidad del cliente","centrarte en el precio"], "Presenta solo lo que resuelve lo que te contaron.")),
 Q(1, ("Vad kännetecknar en bra första kontakt?", ["En lång monolog","En konkret krok och en fråga","Direkt prisförhandling"], "Var kort, nyfiken och avsluta med en fråga."),
      ("What characterises a good first contact?", ["A long monologue","A concrete hook and a question","Immediate price negotiation"], "Be short, curious and end with a question."),
      ("¿Qué caracteriza un buen primer contacto?", ["Un monólogo largo","Un gancho concreto y una pregunta","Negociar el precio de inmediato"], "Sé breve, curioso y termina con una pregunta.")),
 Q(0, ("Vad är målet vid avslutet?", ["Ett påskrivet avtal","Att pressa fram ett ja","En lång presentation"], "Säljarens mål är ett avtal, utan press."),
      ("What is the goal at the close?", ["A signed agreement","To force a yes","A long presentation"], "The salesperson's goal is an agreement, without pressure."),
      ("¿Cuál es el objetivo en el cierre?", ["Un acuerdo firmado","Forzar un sí","Una presentación larga"], "El objetivo del vendedor es un acuerdo, sin presión.")),
 Q(0, ("Hur kopplar du pitchen till kunden?", ["Till deras egna ord och behov","Till dina favoritfunktioner","Till lägsta pris"], "Koppla allt till det kunden själv sagt."),
      ("How do you tie the pitch to the customer?", ["To their own words and needs","To your favourite features","To the lowest price"], "Tie everything to what the customer said."),
      ("¿Cómo conectas el pitch con el cliente?", ["Con sus propias palabras y necesidades","Con tus funciones favoritas","Con el precio más bajo"], "Conecta todo con lo que el cliente dijo.")),
 Q(1, ("Vad gör du om kunden säger 'det är lite dyrt'?", ["Sänker direkt priset","Bekräftar och vänder till värde","Avslutar samtalet"], "Bekräfta och vänd till avkastning."),
      ("What do you do if the customer says 'it's a bit expensive'?", ["Immediately lower the price","Acknowledge and turn to value","End the conversation"], "Acknowledge and turn to return on investment."),
      ("¿Qué haces si el cliente dice 'es un poco caro'?", ["Bajar el precio de inmediato","Reconocer y girar hacia el valor","Terminar la conversación"], "Reconoce y gira hacia el retorno.")),
 Q(1, ("Vad är prospektering?", ["Att leverera projektet","Att hitta och kvalificera möjliga kunder","Att fakturera"], "Att hitta rätt företag att kontakta."),
      ("What is prospecting?", ["Delivering the project","Finding and qualifying potential customers","Invoicing"], "Finding the right companies to contact."),
      ("¿Qué es la prospección?", ["Entregar el proyecto","Encontrar y cualificar clientes potenciales","Facturar"], "Encontrar las empresas adecuadas a contactar.")),
 Q(1, ("Efter avtalet – behöver kunden göra något mer?", ["Ja, sköta allt själv","Nej, teamet hör av sig och kör igång","De får aldrig höra av sig"], "Teamet kontaktar kunden och drar igång."),
      ("After the agreement – does the customer need to do anything more?", ["Yes, handle everything themselves","No, the team reaches out and gets started","They never hear back"], "The team contacts the customer and gets going."),
      ("Tras el acuerdo, ¿el cliente tiene que hacer algo más?", ["Sí, encargarse de todo","No, el equipo contacta y arranca","Nunca recibe respuesta"], "El equipo contacta al cliente y arranca.")),
])

# ── 2. Behovsanalys & frågeteknik ───────────────────────────────────────────
quiz("behovsanalys", "Quiz: Behovsanalys & frågeteknik", "Quiz: Needs analysis & questioning", "Quiz: Análisis de necesidades", [
 Q(2, ("Hur stor andel öppna frågor bör du ställa i behovsanalysen?", ["Cirka 20 %","Cirka 50 %","Cirka 80 %"], "Tumregeln är ca 80 % öppna frågor."),
      ("What share of open questions should you ask in the needs analysis?", ["About 20%","About 50%","About 80%"], "Rule of thumb is about 80% open questions."),
      ("¿Qué proporción de preguntas abiertas deberías hacer?", ["Un 20%","Un 50%","Un 80%"], "La regla general es alrededor del 80%.")),
 Q(1, ("Vilken fråga är öppen?", ["Är ni nöjda med er hemsida?","Hur får ni in nya kunder idag?","Har ni en budget?"], "Öppna frågor får kunden att prata."),
      ("Which question is open?", ["Are you happy with your website?","How do you get new customers today?","Do you have a budget?"], "Open questions get the customer talking."),
      ("¿Qué pregunta es abierta?", ["¿Estáis contentos con vuestra web?","¿Cómo conseguís clientes hoy?","¿Tenéis presupuesto?"], "Las preguntas abiertas hacen hablar al cliente.")),
 Q(1, ("Varför ska du anteckna kundens nyckelord?", ["För att fylla tiden","För att använda dem i pitchen","För att visa att du skriver"], "Du speglar tillbaka kundens egna ord."),
      ("Why should you note the customer's keywords?", ["To fill the time","To use them in the pitch","To show you're writing"], "You mirror the customer's own words back."),
      ("¿Por qué anotar las palabras clave del cliente?", ["Para rellenar el tiempo","Para usarlas en el pitch","Para mostrar que escribes"], "Reflejas las propias palabras del cliente.")),
 Q(2, ("Hur mycket bör du lyssna jämfört med att prata?", ["Prata mest","Ungefär lika","Lyssna mest"], "Lyssna mer än du pratar – ca 70 %."),
      ("How much should you listen versus talk?", ["Talk most","About equal","Listen most"], "Listen more than you talk – about 70%."),
      ("¿Cuánto deberías escuchar frente a hablar?", ["Hablar más","Más o menos igual","Escuchar más"], "Escucha más de lo que hablas, ~70%.")),
 Q(1, ("Vad börjar en öppen fråga ofta med?", ["Är/Har/Vill","Hur/Vad/Varför","Ja/Nej"], "Öppna frågor börjar med Hur, Vad, Varför."),
      ("What does an open question often start with?", ["Are/Have/Do","How/What/Why","Yes/No"], "Open questions start with How, What, Why."),
      ("¿Con qué empieza a menudo una pregunta abierta?", ["¿Es/Tenéis/Queréis?","Cómo/Qué/Por qué","Sí/No"], "Empiezan con Cómo, Qué, Por qué.")),
 Q(1, ("Vad ger en sluten fråga oftast?", ["Ett långt svar","Ja eller nej","En motfråga"], "Slutna frågor ger ja/nej."),
      ("What does a closed question usually give?", ["A long answer","Yes or no","A counter-question"], "Closed questions give yes/no."),
      ("¿Qué suele dar una pregunta cerrada?", ["Una respuesta larga","Sí o no","Una contrapregunta"], "Las cerradas dan sí/no.")),
 Q(1, ("När använder du helst slutna frågor?", ["I början","För att bekräfta och stänga","Aldrig"], "Spara slutna till att bekräfta och stänga."),
      ("When do you preferably use closed questions?", ["At the start","To confirm and close","Never"], "Save closed ones to confirm and close."),
      ("¿Cuándo usar preferiblemente preguntas cerradas?", ["Al principio","Para confirmar y cerrar","Nunca"], "Resérvalas para confirmar y cerrar.")),
 Q(1, ("Vad menas med att 'hitta smärtan'?", ["Sänka priset","Gräva tills du hittar det verkliga behovet","Avsluta snabbt"], "Gräv tills du hittar det verkliga behovet."),
      ("What does 'find the pain' mean?", ["Lower the price","Dig until you find the real need","Close quickly"], "Dig until you find the real need."),
      ("¿Qué significa 'encontrar el dolor'?", ["Bajar el precio","Indagar hasta la necesidad real","Cerrar rápido"], "Indaga hasta encontrar la necesidad real.")),
 Q(1, ("Vilken är en bra fördjupande fråga?", ["Vill ni ha det?","Vad händer om det fortsätter så här?","Har ni budget?"], "Fördjupa med konsekvensfrågor."),
      ("Which is a good probing question?", ["Do you want it?","What happens if it continues like this?","Do you have a budget?"], "Probe with consequence questions."),
      ("¿Cuál es una buena pregunta de profundización?", ["¿Lo queréis?","¿Qué pasa si sigue así?","¿Tenéis presupuesto?"], "Profundiza con preguntas de consecuencia.")),
 Q(0, ("Hur bekräftar du att du förstått kunden?", ["'Så om jag förstår dig rätt…'","Genom att byta ämne","Genom att presentera pris"], "Spegla tillbaka med kundens ord."),
      ("How do you confirm you understood the customer?", ["'So if I understand you correctly…'","By changing the subject","By presenting price"], "Mirror back with the customer's words."),
      ("¿Cómo confirmas que entendiste al cliente?", ["'Si te entiendo bien…'","Cambiando de tema","Presentando el precio"], "Refleja con las palabras del cliente.")),
 Q(1, ("Varför är aktivt lyssnande viktigt?", ["Det fyller tid","Kunden känner sig förstådd","Det låter proffsigt"], "Kunden känner sig förstådd och hörd."),
      ("Why is active listening important?", ["It fills time","The customer feels understood","It sounds professional"], "The customer feels understood and heard."),
      ("¿Por qué es importante la escucha activa?", ["Rellena tiempo","El cliente se siente comprendido","Suena profesional"], "El cliente se siente comprendido.")),
 Q(2, ("Ungefär hur mycket bör du lyssna?", ["30 %","50 %","70 %"], "Sikta på att lyssna ca 70 %."),
      ("Roughly how much should you listen?", ["30%","50%","70%"], "Aim to listen about 70%."),
      ("¿Aproximadamente cuánto deberías escuchar?", ["30%","50%","70%"], "Apunta a escuchar ~70%.")),
 Q(1, ("Vad gör du med kundens nyckelord?", ["Glömmer dem","Speglar tillbaka dem i pitchen","Rättar kunden"], "Använd kundens egna ord i pitchen."),
      ("What do you do with the customer's keywords?", ["Forget them","Mirror them in the pitch","Correct the customer"], "Use the customer's own words in the pitch."),
      ("¿Qué haces con las palabras clave del cliente?", ["Olvidarlas","Reflejarlas en el pitch","Corregir al cliente"], "Usa las palabras del cliente en el pitch.")),
 Q(1, ("När du kopplar behov till lösning bör du...", ["föreslå allt","föreslå det som löser största problemet","fokusera på pris"], "Föreslå en sak som löser största problemet."),
      ("When linking need to solution you should...", ["propose everything","propose what solves the biggest problem","focus on price"], "Propose one thing that solves the biggest problem."),
      ("Al conectar necesidad con solución deberías...", ["proponer todo","proponer lo que resuelve el mayor problema","centrarte en el precio"], "Propón lo que resuelve el mayor problema.")),
 Q(1, ("Vad är risken med för många slutna frågor?", ["Kunden pratar för mycket","Samtalet stängs och du missar behov","Inget"], "Slutna frågor stänger samtalet."),
      ("What's the risk of too many closed questions?", ["The customer talks too much","The conversation closes and you miss needs","Nothing"], "Closed questions close the conversation."),
      ("¿Cuál es el riesgo de demasiadas preguntas cerradas?", ["El cliente habla demasiado","La conversación se cierra y pierdes necesidades","Ninguno"], "Las cerradas cierran la conversación.")),
])

# ── 3. Invändningshantering & förhandling ───────────────────────────────────
quiz("invandningar", "Quiz: Invändningshantering & förhandling", "Quiz: Objection handling & negotiation", "Quiz: Manejo de objeciones", [
 Q(0, ("Vad står metoden 'bekräfta – vänd – fråga' för?", ["Tre steg för att hantera en invändning","En prismodell","En typ av offert"], "Bekräfta känslan, vänd till värde, avsluta med en fråga."),
      ("What does 'acknowledge – turn – ask' stand for?", ["Three steps to handle an objection","A pricing model","A type of quote"], "Acknowledge the feeling, turn to value, end with a question."),
      ("¿Qué significa 'reconoce – gira – pregunta'?", ["Tres pasos para manejar una objeción","Un modelo de precios","Un tipo de presupuesto"], "Reconoce, gira al valor, termina con una pregunta.")),
 Q(1, ("Vad betyder 'det är för dyrt' oftast?", ["Kunden saknar pengar","Kunden ser inte värdet än","Kunden vill avsluta"], "Oftast är värdet inte tydligt än."),
      ("What does 'it's too expensive' usually mean?", ["The customer lacks money","The customer doesn't see the value yet","The customer wants to end"], "Usually the value isn't clear yet."),
      ("¿Qué suele significar 'es demasiado caro'?", ["Al cliente le falta dinero","El cliente aún no ve el valor","El cliente quiere terminar"], "Normalmente el valor no está claro aún.")),
 Q(1, ("Vad bör du helst sänka istället för priset?", ["Kvaliteten","Omfånget","Supporten"], "Sänk omfånget hellre än priset."),
      ("What should you preferably lower instead of the price?", ["The quality","The scope","The support"], "Lower the scope rather than the price."),
      ("¿Qué deberías reducir preferiblemente en vez del precio?", ["La calidad","El alcance","El soporte"], "Reduce el alcance antes que el precio.")),
 Q(1, ("Vad gör du med en invändning som 'skicka info'?", ["Släpper taget","Behåller initiativet och föreslår en återkoppling","Sänker priset"], "Behåll initiativet och boka en återkoppling."),
      ("What do you do with a 'send info' objection?", ["Let go","Keep the initiative and propose a follow-up","Lower the price"], "Keep the initiative and book a follow-up."),
      ("¿Qué haces con una objeción de 'envía info'?", ["Soltar","Mantener la iniciativa y proponer seguimiento","Bajar el precio"], "Mantén la iniciativa y agenda un seguimiento.")),
 Q(1, ("Första steget i invändningsmetoden?", ["Vänd","Bekräfta känslan","Fråga"], "Börja med att bekräfta så kunden känns hörd."),
      ("First step of the objection method?", ["Turn","Acknowledge the feeling","Ask"], "Start by acknowledging so the customer feels heard."),
      ("¿Primer paso del método de objeciones?", ["Girar","Reconocer la emoción","Preguntar"], "Empieza reconociendo para que el cliente se sienta oído.")),
 Q(1, ("Hur bör du aldrig agera vid en invändning?", ["Nyfiket","Defensivt","Lugnt"], "Bli aldrig defensiv."),
      ("How should you never act on an objection?", ["Curiously","Defensively","Calmly"], "Never get defensive."),
      ("¿Cómo no deberías nunca actuar ante una objeción?", ["Con curiosidad","A la defensiva","Con calma"], "Nunca te pongas a la defensiva.")),
 Q(1, ("Bra svar på 'för dyrt'?", ["'Okej, vi avslutar'","'Vad är en ny kund värd för er?'","'Det är vårt lägsta pris'"], "Vänd till avkastning."),
      ("Good reply to 'too expensive'?", ["'Okay, we'll stop'","'What is a new customer worth to you?'","'It's our lowest price'"], "Turn to return on investment."),
      ("¿Buena respuesta a 'demasiado caro'?", ["'Vale, lo dejamos'","'¿Cuánto vale un cliente nuevo?'","'Es nuestro precio más bajo'"], "Gira hacia el retorno.")),
 Q(1, ("Kund: 'vi gör det själva internt'. Bra vinkel?", ["Attackera deras kompetens","Peka på tid och alternativkostnad","Ge upp"], "Varje timme på sajten är bort från kärnverksamheten."),
      ("Customer: 'we do it ourselves'. Good angle?", ["Attack their competence","Point to time and opportunity cost","Give up"], "Every hour on the site is away from the core business."),
      ("Cliente: 'lo hacemos nosotros'. ¿Buen enfoque?", ["Atacar su competencia","Señalar el tiempo y el coste de oportunidad","Rendirse"], "Cada hora en la web es fuera del negocio principal.")),
 Q(1, ("Kund: 'vi är nöjda med nuvarande leverantör'. Vad gör du?", ["Sågar konkurrenten","Så ett frö och erbjud komplement","Pressar på"], "Attackera aldrig konkurrenten; erbjud komplement."),
      ("Customer: 'we're happy with our supplier'. What do you do?", ["Trash the competitor","Plant a seed and offer a complement","Push hard"], "Never attack the competitor; offer a complement."),
      ("Cliente: 'estamos contentos con el proveedor'. ¿Qué haces?", ["Criticar al competidor","Sembrar y ofrecer un complemento","Presionar"], "Nunca ataques al competidor; ofrece complemento.")),
 Q(1, ("'Vi måste tänka på det' döljer ofta...", ["ett säkert ja","en oklarhet du bör ta reda på","ointresse"], "Ta reda på vad som hindrar."),
      ("'We need to think about it' often hides...", ["a sure yes","an uncertainty you should uncover","disinterest"], "Find out what's blocking it."),
      ("'Tenemos que pensarlo' suele esconder...", ["un sí seguro","una duda que debes descubrir","desinterés"], "Averigua qué lo frena.")),
 Q(1, ("Hur möter du skepsis mot SEO/GEO?", ["Med löften","Med mätbarhet och exempel","Med rabatt"], "Visa data och konkreta exempel."),
      ("How do you meet skepticism about SEO/GEO?", ["With promises","With measurability and examples","With a discount"], "Show data and concrete examples."),
      ("¿Cómo respondes al escepticismo sobre SEO/GEO?", ["Con promesas","Con medición y ejemplos","Con un descuento"], "Muestra datos y ejemplos concretos.")),
 Q(1, ("Vad bör du be om om du måste röra priset?", ["Inget","Något tillbaka, t.ex. snabbare beslut eller referens","Mer tid bara"], "Ge inte bort värde gratis."),
      ("What should you ask for if you must move on price?", ["Nothing","Something back, e.g. a faster decision or referral","Just more time"], "Don't give value away for free."),
      ("¿Qué deberías pedir si debes tocar el precio?", ["Nada","Algo a cambio, p. ej. decisión rápida o referencia","Solo más tiempo"], "No regales valor.")),
 Q(1, ("Vad är ett 'ja till ett möte'?", ["Ett nej","Också ett ja","Slöseri"], "Ett bokat möte är också framsteg."),
      ("What is a 'yes to a meeting'?", ["A no","Also a yes","A waste"], "A booked meeting is progress too."),
      ("¿Qué es un 'sí a una reunión'?", ["Un no","También un sí","Una pérdida"], "Una reunión agendada también es avance.")),
 Q(0, ("Kund: 'vi har redan en hemsida'. Bra fråga?", ["'Hur många leads drar den in?'","'Varför då?'","'Får jag ert lösenord?'"], "Kolla om den presterar."),
      ("Customer: 'we already have a website'. Good question?", ["'How many leads does it bring in?'","'Why is that?'","'Can I have your password?'"], "Check whether it performs."),
      ("Cliente: 'ya tenemos una web'. ¿Buena pregunta?", ["'¿Cuántos leads trae?'","'¿Por qué?'","'¿Me das tu contraseña?'"], "Comprueba si rinde.")),
 Q(0, ("Vad säljer du på, inte pris?", ["Värde och resultat","Funktioner","Rabatt"], "Sälj på värdet, inte priset."),
      ("What do you sell on, not price?", ["Value and results","Features","Discount"], "Sell on value, not price."),
      ("¿Sobre qué vendes, no el precio?", ["Valor y resultados","Funciones","Descuento"], "Vende sobre el valor, no el precio.")),
])

# ── 4. Mötesbokning & kalla samtal ──────────────────────────────────────────
quiz("motesbokning", "Quiz: Mötesbokning & kalla samtal", "Quiz: Booking meetings & cold calls", "Quiz: Agendar reuniones y llamadas", [
 Q(1, ("Hur bör du föreslå mötestid?", ["Fråga öppet 'när passar det?'","Föreslå två konkreta tider","Vänta på att kunden föreslår"], "Två konkreta tider är lättare att svara på."),
      ("How should you propose a meeting time?", ["Ask openly 'when suits you?'","Offer two concrete times","Wait for the customer"], "Two concrete times are easier to answer."),
      ("¿Cómo proponer una hora de reunión?", ["Preguntar '¿cuándo te va?'","Ofrecer dos horas concretas","Esperar al cliente"], "Dos horas concretas son más fáciles de responder.")),
 Q(1, ("Hur ser du på ett nej i ett kallt samtal?", ["Som ett personligt misslyckande","Som statistik på vägen till ett ja","Som ett skäl att sluta ringa"], "Ett nej är statistik."),
      ("How do you view a no in a cold call?", ["A personal failure","Statistics on the way to a yes","A reason to stop"], "A no is statistics."),
      ("¿Cómo ves un no en una llamada en frío?", ["Un fracaso personal","Estadística camino de un sí","Motivo para parar"], "Un no es estadística.")),
 Q(0, ("Hur lång tid bör du be om i öppningen?", ["30 sekunder","5 minuter","Ingen tidsangivelse"], "Be om 30 sekunder – lågtröskel."),
      ("How much time should you ask for in the opening?", ["30 seconds","5 minutes","No time mentioned"], "Ask for 30 seconds – low threshold."),
      ("¿Cuánto tiempo pedir en la apertura?", ["30 segundos","5 minutos","Sin mencionar tiempo"], "Pide 30 segundos: bajo compromiso.")),
 Q(1, ("På vilket försök bokas de flesta möten?", ["Första","Andra eller tredje","Aldrig"], "Följ upp – de flesta bokas på andra/tredje försöket."),
      ("On which attempt are most meetings booked?", ["The first","The second or third","Never"], "Follow up – most are booked on the second/third attempt."),
      ("¿En qué intento se agendan la mayoría de reuniones?", ["El primero","El segundo o tercero","Nunca"], "Haz seguimiento: la mayoría al segundo/tercero.")),
 Q(1, ("Målet med ett kallt samtal?", ["Sälja direkt","Boka mötet","Skicka offert"], "Boka mötet, sälj inte i telefon."),
      ("Goal of a cold call?", ["Sell right away","Book the meeting","Send a quote"], "Book the meeting, don't sell on the phone."),
      ("¿Objetivo de una llamada en frío?", ["Vender ya","Agendar la reunión","Enviar presupuesto"], "Agendar la reunión, no vender por teléfono.")),
 Q(1, ("Hur bör rösten låta?", ["Stressad","Leende och trygg","Monoton"], "Le när du ringer, det hörs."),
      ("How should your voice sound?", ["Stressed","Smiling and confident","Monotone"], "Smile when you call, it shows."),
      ("¿Cómo debería sonar tu voz?", ["Estresada","Sonriente y segura","Monótona"], "Sonríe al llamar, se nota.")),
 Q(1, ("Hur avslutar du öppningen?", ["Med en lång monolog","Med en fråga","Med priset"], "Avsluta med en fråga, inte en monolog."),
      ("How do you end the opening?", ["With a long monologue","With a question","With the price"], "End with a question, not a monologue."),
      ("¿Cómo terminas la apertura?", ["Con un monólogo largo","Con una pregunta","Con el precio"], "Termina con una pregunta, no un monólogo.")),
 Q(1, ("Kund: 'skicka info'. Bästa drag?", ["Släpp taget","Kvalificera och boka återkoppling","Sänk priset"], "Behåll initiativet."),
      ("Customer: 'send info'. Best move?", ["Let go","Qualify and book a follow-up","Lower the price"], "Keep the initiative."),
      ("Cliente: 'envía info'. ¿Mejor jugada?", ["Soltar","Cualificar y agendar seguimiento","Bajar el precio"], "Mantén la iniciativa.")),
 Q(1, ("Vad gör en bra krok?", ["Generisk fras","En konkret observation om dem","En prislista"], "Konkret iakttagelse om deras sajt eller bransch."),
      ("What makes a good hook?", ["A generic phrase","A concrete observation about them","A price list"], "A concrete observation about their site or industry."),
      ("¿Qué hace un buen gancho?", ["Una frase genérica","Una observación concreta sobre ellos","Una lista de precios"], "Una observación concreta sobre su web o sector.")),
 Q(1, ("Hur ofta bör du följa upp uteblivna svar?", ["Aldrig","Tills du fått svar, inom rimlighet","En gång bara"], "De flesta möten kräver uppföljning."),
      ("How often should you follow up on no-replies?", ["Never","Until you get a reply, within reason","Just once"], "Most meetings require follow-up."),
      ("¿Con qué frecuencia seguir a los que no responden?", ["Nunca","Hasta obtener respuesta, con criterio","Solo una vez"], "La mayoría de reuniones requieren seguimiento.")),
 Q(1, ("Vad är fel sätt att föreslå tid?", ["'Tisdag 10 eller torsdag 14?'","'När passar det?'","Båda är lika bra"], "Öppen fråga är svårare att svara på."),
      ("What's the wrong way to propose a time?", ["'Tuesday 10 or Thursday 2?'","'When suits you?'","Both are equally good"], "An open question is harder to answer."),
      ("¿Cuál es la forma incorrecta de proponer hora?", ["'¿Martes 10 o jueves 14?'","'¿Cuándo te va?'","Ambas igual de buenas"], "Una pregunta abierta es más difícil de responder.")),
 Q(1, ("Hur långt ska ett kallt samtal helst vara?", ["Långt och detaljerat","Kort och nyfiket","Tills kunden lägger på"], "Kort, nyfiket, lyssna mer."),
      ("How long should a cold call ideally be?", ["Long and detailed","Short and curious","Until they hang up"], "Short, curious, listen more."),
      ("¿Cuánto debería durar idealmente una llamada en frío?", ["Larga y detallada","Corta y curiosa","Hasta que cuelguen"], "Corta, curiosa, escucha más.")),
 Q(1, ("Var bekräftar du bokad tid?", ["Bara muntligt","I kalender och mail direkt","Aldrig"], "Bekräfta i kalender och mail."),
      ("Where do you confirm a booked time?", ["Only verbally","In the calendar and email right away","Never"], "Confirm in calendar and email."),
      ("¿Dónde confirmas la hora agendada?", ["Solo de palabra","En calendario y correo enseguida","Nunca"], "Confirma en calendario y correo.")),
 Q(1, ("Mindset vid nej?", ["Personligt nederlag","Statistik på vägen","Skäl att sluta"], "Ett nej är statistik – fortsätt ringa."),
      ("Mindset on a no?", ["Personal defeat","Statistics on the way","Reason to stop"], "A no is statistics – keep calling."),
      ("¿Mentalidad ante un no?", ["Derrota personal","Estadística en el camino","Motivo para parar"], "Un no es estadística: sigue llamando.")),
 Q(1, ("Vad är huvudsyftet med uppföljning?", ["Irritera kunden","Fler bokade möten","Fylla tid"], "Uppföljning ger fler möten."),
      ("What's the main purpose of follow-up?", ["Annoy the customer","More booked meetings","Fill time"], "Follow-up means more meetings."),
      ("¿Cuál es el propósito principal del seguimiento?", ["Molestar al cliente","Más reuniones agendadas","Rellenar tiempo"], "El seguimiento da más reuniones.")),
])

# ── 5. SEO & GEO ────────────────────────────────────────────────────────────
quiz("seo-geo", "Quiz: SEO & GEO", "Quiz: SEO & GEO", "Quiz: SEO y GEO", [
 Q(1, ("När brukar SEO ge resultat?", ["Direkt","På 3–6 månader","Aldrig mätbart"], "SEO är långsiktigt – oftast 3–6 månader."),
      ("When does SEO usually deliver results?", ["Immediately","In 3–6 months","Never measurable"], "SEO is long-term – usually 3–6 months."),
      ("¿Cuándo suele dar resultados el SEO?", ["De inmediato","En 3–6 meses","Nunca medible"], "El SEO es a largo plazo: 3–6 meses.")),
 Q(0, ("Vad är GEO?", ["Synlighet i AI-sök som ChatGPT","En typ av hemsida","Ett betalningssätt"], "GEO = synas och rekommenderas i AI-sök."),
      ("What is GEO?", ["Visibility in AI search like ChatGPT","A type of website","A payment method"], "GEO = being seen and recommended in AI search."),
      ("¿Qué es el GEO?", ["Visibilidad en buscadores de IA como ChatGPT","Un tipo de web","Un método de pago"], "GEO = aparecer y ser recomendado en IA.")),
 Q(1, ("Vad är ditt bästa motargument mot skepsis?", ["Lägre pris","Mätbarhet och rapporter","Längre avtal"], "Visa data, inte löften."),
      ("What's your best counter to skepticism?", ["A lower price","Measurability and reports","A longer contract"], "Show data, not promises."),
      ("¿Tu mejor argumento contra el escepticismo?", ["Precio más bajo","Medición e informes","Contrato más largo"], "Muestra datos, no promesas.")),
 Q(1, ("Vad gör GEO till ett försprång just nu?", ["Det är gratis","Konkurrenterna syns oftast inte där än","Google har slutat fungera"], "Tidigt läge = försprång."),
      ("What makes GEO a head start now?", ["It's free","Competitors usually aren't there yet","Google has stopped working"], "Early stage = head start."),
      ("¿Qué hace del GEO una ventaja ahora?", ["Es gratis","Los competidores aún no están","Google dejó de funcionar"], "Etapa temprana = ventaja.")),
 Q(1, ("Vad bygger SEO på?", ["Bara annonser","On-page, content och länkar","Tur"], "On-page, content och länkar."),
      ("What is SEO built on?", ["Only ads","On-page, content and links","Luck"], "On-page, content and links."),
      ("¿En qué se basa el SEO?", ["Solo anuncios","On-page, contenido y enlaces","Suerte"], "On-page, contenido y enlaces.")),
 Q(1, ("Kostar SEO-trafik per klick?", ["Ja alltid","Nej, organisk trafik kostar inget per klick","Bara på Google Ads"], "Organisk trafik kostar inget per klick."),
      ("Does SEO traffic cost per click?", ["Yes always","No, organic traffic costs nothing per click","Only on Google Ads"], "Organic traffic costs nothing per click."),
      ("¿El tráfico SEO cuesta por clic?", ["Sí siempre","No, el tráfico orgánico no cuesta por clic","Solo en Google Ads"], "El tráfico orgánico no cuesta por clic.")),
 Q(1, ("Var sker GEO-synlighet?", ["I Google Ads","I AI-sök som ChatGPT/Perplexity","I tidningar"], "I AI-sök."),
      ("Where does GEO visibility happen?", ["In Google Ads","In AI search like ChatGPT/Perplexity","In newspapers"], "In AI search."),
      ("¿Dónde ocurre la visibilidad GEO?", ["En Google Ads","En buscadores de IA como ChatGPT/Perplexity","En periódicos"], "En buscadores de IA.")),
 Q(1, ("Vad visar en månadsrapport?", ["Inget mätbart","Ranking, trafik och leads","Bara fakturan"], "Ranking, trafik och leads."),
      ("What does a monthly report show?", ["Nothing measurable","Ranking, traffic and leads","Just the invoice"], "Ranking, traffic and leads."),
      ("¿Qué muestra un informe mensual?", ["Nada medible","Ranking, tráfico y leads","Solo la factura"], "Ranking, tráfico y leads.")),
 Q(1, ("Hur skapar du köplust för SEO?", ["Lova topplats","Kostnadsfri synlighetsanalys: nuläge → potential","Sänk priset"], "Visa nuläge och potential."),
      ("How do you create desire for SEO?", ["Promise top spot","Free visibility analysis: now → potential","Lower the price"], "Show current state and potential."),
      ("¿Cómo creas deseo por el SEO?", ["Prometer el puesto 1","Análisis gratis: ahora → potencial","Bajar el precio"], "Muestra situación y potencial.")),
 Q(1, ("Vad är SEO Start-paketets nivå?", ["Engångs","Från 4 900 kr/mån","Gratis"], "SEO Start från 4 900 kr/mån."),
      ("What's the SEO Start tier?", ["One-off","From SEK 4,900/mo","Free"], "SEO Start from SEK 4,900/mo."),
      ("¿Cuál es el nivel de SEO Start?", ["Pago único","Desde 4 900 SEK/mes","Gratis"], "SEO Start desde 4 900 SEK/mes.")),
 Q(1, ("Ärligt svar på 'garanterar ni plats 1'?", ["Ja alltid","Nej, men vi mäter och flyttar fram positionerna","Kanske"], "Inga garantier, men mätbar utveckling."),
      ("Honest reply to 'do you guarantee #1'?", ["Yes always","No, but we measure and move positions up","Maybe"], "No guarantees, but measurable progress."),
      ("Respuesta honesta a '¿garantizáis el #1?'", ["Sí siempre","No, pero medimos y subimos posiciones","Quizá"], "Sin garantías, pero progreso medible.")),
 Q(1, ("Varför är GEO 'first mover'?", ["Alla gör det redan","Konkurrenterna syns oftast inte än","Google kräver det"], "Tidigt läge = försprång."),
      ("Why is GEO a 'first mover'?", ["Everyone does it already","Competitors usually aren't there yet","Google requires it"], "Early stage = head start."),
      ("¿Por qué GEO es 'first mover'?", ["Todos lo hacen ya","Los competidores aún no están","Google lo exige"], "Etapa temprana = ventaja.")),
 Q(1, ("Bra första steg mot en kund?", ["Skicka faktura","Kostnadsfri synlighetsanalys","Be om referens"], "Visa var de står idag."),
      ("Good first step toward a customer?", ["Send an invoice","A free visibility analysis","Ask for a referral"], "Show where they stand today."),
      ("¿Buen primer paso hacia un cliente?", ["Enviar factura","Un análisis de visibilidad gratis","Pedir una referencia"], "Muestra dónde están hoy.")),
 Q(1, ("SEO är...", ["en engångsinsats","långsiktigt och löpande","gratis"], "SEO är långsiktigt."),
      ("SEO is...", ["a one-off effort","long-term and ongoing","free"], "SEO is long-term."),
      ("El SEO es...", ["una acción puntual","a largo plazo y continuo","gratis"], "El SEO es a largo plazo.")),
 Q(1, ("Vad är GEO Start-paketets nivå?", ["18 000 kr engångs","Från 6 900 kr/mån","100 kr"], "GEO från 6 900 kr/mån."),
      ("What's the GEO Start tier?", ["SEK 18,000 one-off","From SEK 6,900/mo","SEK 100"], "GEO from SEK 6,900/mo."),
      ("¿Cuál es el nivel de GEO Start?", ["18 000 SEK único","Desde 6 900 SEK/mes","100 SEK"], "GEO desde 6 900 SEK/mes.")),
])

# ── 6. Produktmästaren ──────────────────────────────────────────────────────
quiz("produktmastaren", "Quiz: Produktmästaren", "Quiz: The product master", "Quiz: El maestro de producto", [
 Q(1, ("Vad kostar en företagshemsida?", ["9 000 kr","18 000 kr","49 000 kr"], "Företagshemsidan ligger på 18 000 kr."),
      ("What does a business website cost?", ["SEK 9,000","SEK 18,000","SEK 49,000"], "The business website is SEK 18,000."),
      ("¿Cuánto cuesta una web corporativa?", ["9 000 SEK","18 000 SEK","49 000 SEK"], "La web corporativa cuesta 18 000 SEK.")),
 Q(1, ("Kunden behöver inloggning och data – vad föreslår du?", ["Landningssida","Webbapp","Logotyp"], "Inloggning och data = webbapp."),
      ("The customer needs login and data – what do you propose?", ["Landing page","Web app","Logo"], "Login and data = web app."),
      ("El cliente necesita login y datos, ¿qué propones?", ["Página de aterrizaje","App web","Logotipo"], "Login y datos = app web.")),
 Q(2, ("Vilken e-handelsnivå har ERP-integration?", ["Start","Plus","Pro"], "ERP-integration ingår på Pro."),
      ("Which e-commerce tier has ERP integration?", ["Start","Plus","Pro"], "ERP integration is on Pro."),
      ("¿Qué nivel de e-commerce tiene integración ERP?", ["Start","Plus","Pro"], "La integración ERP está en Pro.")),
 Q(0, ("Vad innehåller Startpaketet?", ["Hemsida + SEO","MVP + design","Bara en logotyp"], "Startpaketet = företagshemsida + löpande SEO."),
      ("What does the Starter bundle contain?", ["Website + SEO","MVP + design","Just a logo"], "Starter bundle = business website + ongoing SEO."),
      ("¿Qué incluye el Paquete inicial?", ["Web + SEO","MVP + diseño","Solo un logotipo"], "Paquete inicial = web corporativa + SEO continuo.")),
 Q(0, ("Landningssida kostar från?", ["9 000 kr","18 000 kr","49 000 kr"], "Landningssida från 9 000 kr."),
      ("A landing page costs from?", ["SEK 9,000","SEK 18,000","SEK 49,000"], "Landing page from SEK 9,000."),
      ("¿Una página de aterrizaje cuesta desde?", ["9 000 SEK","18 000 SEK","49 000 SEK"], "Página de aterrizaje desde 9 000 SEK.")),
 Q(1, ("MVP kostar från?", ["9 000 kr","29 000 kr","79 000 kr"], "MVP från 29 000 kr."),
      ("An MVP costs from?", ["SEK 9,000","SEK 29,000","SEK 79,000"], "MVP from SEK 29,000."),
      ("¿Un MVP cuesta desde?", ["9 000 SEK","29 000 SEK","79 000 SEK"], "MVP desde 29 000 SEK.")),
 Q(2, ("Mobilapp kostar från?", ["29 000 kr","49 000 kr","79 000 kr"], "Mobilapp från 79 000 kr."),
      ("A mobile app costs from?", ["SEK 29,000","SEK 49,000","SEK 79,000"], "Mobile app from SEK 79,000."),
      ("¿Una app móvil cuesta desde?", ["29 000 SEK","49 000 SEK","79 000 SEK"], "App móvil desde 79 000 SEK.")),
 Q(0, ("E-handel Start uppstart från?", ["19 000 kr","35 000 kr","59 000 kr"], "Start från 19 000 kr + 1 490 kr/mån."),
      ("E-commerce Start setup from?", ["SEK 19,000","SEK 35,000","SEK 59,000"], "Start from SEK 19,000 + SEK 1,490/mo."),
      ("¿Alta de E-commerce Start desde?", ["19 000 SEK","35 000 SEK","59 000 SEK"], "Start desde 19 000 SEK + 1 490 SEK/mes.")),
 Q(1, ("Vilken e-handelsnivå är populärast?", ["Start","Plus","Pro"], "Plus är populärast."),
      ("Which e-commerce tier is most popular?", ["Start","Plus","Pro"], "Plus is most popular."),
      ("¿Qué nivel de e-commerce es el más popular?", ["Start","Plus","Pro"], "Plus es el más popular.")),
 Q(1, ("Designpartner kostar från?", ["4 900 kr/mån","9 000 kr/mån","29 000 kr"], "Designpartner från 9 000 kr/mån."),
      ("A design partner costs from?", ["SEK 4,900/mo","SEK 9,000/mo","SEK 29,000"], "Design partner from SEK 9,000/mo."),
      ("¿Un socio de diseño cuesta desde?", ["4 900 SEK/mes","9 000 SEK/mes","29 000 SEK"], "Socio de diseño desde 9 000 SEK/mes.")),
 Q(1, ("Vad bygger ni en statisk hemsida i?", ["WordPress","Astro","Shopify"], "Statiskt i Astro."),
      ("What do you build a static website in?", ["WordPress","Astro","Shopify"], "Static in Astro."),
      ("¿En qué construís una web estática?", ["WordPress","Astro","Shopify"], "Estático en Astro.")),
 Q(0, ("Vad bygger ni dynamiska sajter/appar i?", ["React","Wix","Joomla"], "React för dynamiskt."),
      ("What do you build dynamic sites/apps in?", ["React","Wix","Joomla"], "React for dynamic."),
      ("¿En qué construís sitios/apps dinámicos?", ["React","Wix","Joomla"], "React para lo dinámico.")),
 Q(1, ("Mobilappar byggs med?", ["Två separata kodbaser","En kodbas (React Native) för iOS+Android","Bara iOS"], "En kodbas för båda plattformarna."),
      ("Mobile apps are built with?", ["Two separate codebases","One codebase (React Native) for iOS+Android","Only iOS"], "One codebase for both platforms."),
      ("¿Las apps móviles se construyen con?", ["Dos bases de código","Una base (React Native) para iOS+Android","Solo iOS"], "Una base de código para ambas.")),
 Q(1, ("Vilket paket passar stort B2B-sortiment med ERP?", ["E-handel Start","E-handel Pro","Landningssida"], "Pro för B2B och ERP."),
      ("Which package fits a large B2B range with ERP?", ["E-commerce Start","E-commerce Pro","Landing page"], "Pro for B2B and ERP."),
      ("¿Qué paquete encaja con gran catálogo B2B y ERP?", ["E-commerce Start","E-commerce Pro","Página de aterrizaje"], "Pro para B2B y ERP.")),
 Q(1, ("Logotyp & varumärke kostar från?", ["4 000 kr","12 000 kr","50 000 kr"], "Från 12 000 kr."),
      ("Logo & brand costs from?", ["SEK 4,000","SEK 12,000","SEK 50,000"], "From SEK 12,000."),
      ("¿Logotipo y marca cuesta desde?", ["4 000 SEK","12 000 SEK","50 000 SEK"], "Desde 12 000 SEK.")),
])

# ── 7. Storytelling & pitch ─────────────────────────────────────────────────
quiz("storytelling", "Quiz: Storytelling & pitch", "Quiz: Storytelling & pitch", "Quiz: Storytelling y pitch", [
 Q(1, ("Vilken struktur bygger en pitch som fastnar?", ["Pris – funktion – garanti","Problem – lösning – resultat","Historik – team – kontor"], "Börja i problemet, visa lösningen, måla resultatet."),
      ("Which structure builds a pitch that sticks?", ["Price – feature – guarantee","Problem – solution – result","History – team – office"], "Start in the problem, show the solution, paint the result."),
      ("¿Qué estructura construye un pitch que se queda?", ["Precio – función – garantía","Problema – solución – resultado","Historia – equipo – oficina"], "Empieza en el problema, muestra la solución, pinta el resultado.")),
 Q(1, ("Varför använda kundens egna ord i pitchen?", ["Det fyller tid","Kunden känner sig förstådd","Det låter mer tekniskt"], "Pitchen känns gjord för dem."),
      ("Why use the customer's own words in the pitch?", ["It fills time","The customer feels understood","It sounds more technical"], "The pitch feels made for them."),
      ("¿Por qué usar las palabras del cliente?", ["Rellena tiempo","El cliente se siente comprendido","Suena más técnico"], "El pitch parece hecho para él.")),
 Q(1, ("Vad gör värdet mest trovärdigt?", ["Stora löften","Konkreta siffror och exempel","Långa beskrivningar"], "Siffror och exempel slår löften."),
      ("What makes the value most credible?", ["Big promises","Concrete numbers and examples","Long descriptions"], "Numbers and examples beat promises."),
      ("¿Qué hace más creíble el valor?", ["Grandes promesas","Números y ejemplos concretos","Descripciones largas"], "Números y ejemplos superan promesas.")),
 Q(1, ("Hur bör du avsluta en pitch?", ["Med tystnad","Med en fråga som öppnar nästa steg","Med en prislista"], "Led mot nästa steg."),
      ("How should you end a pitch?", ["With silence","With a question that opens the next step","With a price list"], "Lead toward the next step."),
      ("¿Cómo terminar un pitch?", ["Con silencio","Con una pregunta que abra el siguiente paso","Con una lista de precios"], "Lleva al siguiente paso.")),
 Q(1, ("Vad minns människor bäst?", ["Funktionslistor","Berättelser","Prislistor"], "Berättelser, inte funktionslistor."),
      ("What do people remember best?", ["Feature lists","Stories","Price lists"], "Stories, not feature lists."),
      ("¿Qué recuerda mejor la gente?", ["Listas de funciones","Historias","Listas de precios"], "Historias, no listas de funciones.")),
 Q(1, ("Vad säljer du egentligen?", ["Funktioner","Förändringen från nu till sen","Tekniken"], "Sälj förändringen."),
      ("What are you really selling?", ["Features","The change from now to later","The technology"], "Sell the change."),
      ("¿Qué vendes realmente?", ["Funciones","El cambio de ahora a después","La tecnología"], "Vende el cambio.")),
 Q(0, ("Var börjar en bra pitch?", ["I kundens problem","I din historia","I priset"], "Börja i kundens problem."),
      ("Where does a good pitch start?", ["In the customer's problem","In your history","In the price"], "Start in the customer's problem."),
      ("¿Dónde empieza un buen pitch?", ["En el problema del cliente","En tu historia","En el precio"], "Empieza en el problema del cliente.")),
 Q(1, ("Hur gör du värdet trovärdigt?", ["Stora löften","Siffror, exempel och referenser","Långa texter"], "Bevis slår löften."),
      ("How do you make value credible?", ["Big promises","Numbers, examples and references","Long texts"], "Proof beats promises."),
      ("¿Cómo haces creíble el valor?", ["Grandes promesas","Números, ejemplos y referencias","Textos largos"], "Las pruebas superan promesas.")),
 Q(1, ("Vad bör en pitch avslutas med?", ["Tystnad","En fråga som öppnar nästa steg","En prislista"], "Avsluta med en fråga."),
      ("What should a pitch end with?", ["Silence","A question that opens the next step","A price list"], "End with a question."),
      ("¿Con qué debe terminar un pitch?", ["Silencio","Una pregunta que abra el siguiente paso","Una lista de precios"], "Termina con una pregunta.")),
 Q(1, ("'En extra kund i månaden betalar sajten' är...", ["ett vagt löfte","ett konkret värdeargument","en rabatt"], "Konkret och mätbart."),
      ("'One extra customer a month pays for the site' is...", ["a vague promise","a concrete value argument","a discount"], "Concrete and measurable."),
      ("'Un cliente extra al mes paga la web' es...", ["una promesa vaga","un argumento de valor concreto","un descuento"], "Concreto y medible.")),
 Q(1, ("Varför spegla kundens egna ord?", ["Det fyller tid","Pitchen känns gjord för dem","Det låter tekniskt"], "Skapar igenkänning och förtroende."),
      ("Why mirror the customer's own words?", ["It fills time","The pitch feels made for them","It sounds technical"], "Creates recognition and trust."),
      ("¿Por qué reflejar las palabras del cliente?", ["Rellena tiempo","El pitch parece hecho para él","Suena técnico"], "Crea reconocimiento y confianza.")),
 Q(1, ("Vad bör du undvika i en pitch?", ["Kundens ord","Att rabbla alla funktioner","En avslutande fråga"], "Rabbla inte funktionslistor."),
      ("What should you avoid in a pitch?", ["The customer's words","Reciting every feature","A closing question"], "Don't recite feature lists."),
      ("¿Qué evitar en un pitch?", ["Las palabras del cliente","Recitar todas las funciones","Una pregunta de cierre"], "No recites listas de funciones.")),
 Q(1, ("Vad bygger förtroende snabbast?", ["Påståenden","Konkreta exempel och bevis","Högre pris"], "Visa, berätta inte bara."),
      ("What builds trust fastest?", ["Claims","Concrete examples and proof","A higher price"], "Show, don't just tell."),
      ("¿Qué genera confianza más rápido?", ["Afirmaciones","Ejemplos y pruebas concretas","Un precio más alto"], "Muestra, no solo cuentes.")),
 Q(1, ("Den bästa pitchen är...", ["generisk","skräddarsydd efter behovsanalysen","samma varje gång"], "Skräddarsy efter kundens svar."),
      ("The best pitch is...", ["generic","tailored to the needs analysis","the same every time"], "Tailor it to the customer's answers."),
      ("El mejor pitch es...", ["genérico","adaptado al análisis de necesidades","igual cada vez"], "Adáptalo a las respuestas del cliente.")),
 Q(1, ("Målet med storytelling i sälj?", ["Imponera med ord","Få kunden att tänka 'jag måste ha detta'","Fylla tid"], "Skapa äkta köplust."),
      ("Goal of storytelling in sales?", ["Impress with words","Make the customer think 'I must have this'","Fill time"], "Create real desire."),
      ("¿Objetivo del storytelling en ventas?", ["Impresionar con palabras","Que el cliente piense 'tengo que tener esto'","Rellenar tiempo"], "Crear deseo real.")),
])

# ── 8. CRM-mästaren ─────────────────────────────────────────────────────────
quiz("crm", "Quiz: CRM-mästaren", "Quiz: The CRM master", "Quiz: El maestro del CRM", [
 Q(1, ("När bör du skapa en lead i CRM:t?", ["Efter att affären är klar","Så fort du ser en möjlighet","Bara om kunden ber om det"], "Skapa leaden direkt."),
      ("When should you create a lead in the CRM?", ["After the deal is done","As soon as you spot an opportunity","Only if the customer asks"], "Create the lead right away."),
      ("¿Cuándo crear un lead en el CRM?", ["Tras cerrar la venta","En cuanto veas una oportunidad","Solo si el cliente lo pide"], "Crea el lead enseguida.")),
 Q(1, ("Vad kännetecknar en lead som riskerar att dö?", ["Den har ett nästa steg","Den saknar nästa steg","Den har en bokad uppgift"], "En lead utan nästa steg dör."),
      ("What characterises a lead at risk of dying?", ["It has a next step","It lacks a next step","It has a booked task"], "A lead with no next step dies."),
      ("¿Qué caracteriza a un lead en riesgo de morir?", ["Tiene un siguiente paso","Le falta un siguiente paso","Tiene una tarea agendada"], "Un lead sin siguiente paso muere.")),
 Q(1, ("Vad är Sandbox-fliken till för?", ["Skarpa kunddata","Att öva utan att något sparas","Att skicka fakturor"], "Sandbox = öva fritt, inget sparas."),
      ("What is the Sandbox tab for?", ["Real customer data","Practising without anything being saved","Sending invoices"], "Sandbox = practise freely, nothing saved."),
      ("¿Para qué sirve la pestaña Sandbox?", ["Datos reales de clientes","Practicar sin que se guarde nada","Enviar facturas"], "Sandbox = practica libremente, nada se guarda.")),
 Q(1, ("Hur säkerställer du att inget faller mellan stolarna?", ["Litar på minnet","Lägger uppgifter och möten med datum","Väntar på kunden"], "Datum gör att systemet påminner dig."),
      ("How do you make sure nothing slips through the cracks?", ["Rely on memory","Add tasks and meetings with dates","Wait for the customer"], "Dates make the system remind you."),
      ("¿Cómo te aseguras de que nada se pierda?", ["Confiar en la memoria","Añadir tareas y reuniones con fecha","Esperar al cliente"], "Las fechas hacen que el sistema te recuerde.")),
 Q(1, ("Vad är CRM:t i säljarbetet?", ["En kalender bara","Ditt nav för leads, samtal och affärer","Ett mailprogram"], "CRM:t är navet."),
      ("What is the CRM in sales work?", ["Just a calendar","Your hub for leads, calls and deals","An email client"], "The CRM is the hub."),
      ("¿Qué es el CRM en las ventas?", ["Solo un calendario","Tu centro para leads, llamadas y ventas","Un cliente de correo"], "El CRM es el centro.")),
 Q(1, ("Vad ska du anteckna direkt efter ett samtal?", ["Inget","Vad som sades och nästa steg","Bara namnet"], "Logga direkt, annars glöms det."),
      ("What should you note right after a call?", ["Nothing","What was said and the next step","Just the name"], "Log it right away or it's forgotten."),
      ("¿Qué anotar justo tras una llamada?", ["Nada","Lo que se dijo y el siguiente paso","Solo el nombre"], "Regístralo enseguida o se olvida.")),
 Q(1, ("Vad gör en uppgift med datum?", ["Inget","Systemet påminner dig","Skickar mail till kund"], "Påminnelse så inget tappas."),
      ("What does a task with a date do?", ["Nothing","The system reminds you","Emails the customer"], "A reminder so nothing is lost."),
      ("¿Qué hace una tarea con fecha?", ["Nada","El sistema te recuerda","Envía correo al cliente"], "Un recordatorio para no perder nada.")),
 Q(1, ("Vad ser du i CRM:t om dataisolering?", ["Allas leads","Dina egna leads och din aktivitet","Bara admins"], "Du ser dina egna, inte kollegornas."),
      ("What do you see in the CRM regarding data isolation?", ["Everyone's leads","Your own leads and activity","Only admins'"], "You see your own, not colleagues'."),
      ("¿Qué ves en el CRM sobre aislamiento de datos?", ["Los leads de todos","Tus propios leads y actividad","Solo los de admins"], "Ves los tuyos, no los de compañeros.")),
 Q(0, ("Vad bör varje lead ha?", ["Ett nästa steg","En rabatt","En faktura"], "En lead utan nästa steg dör."),
      ("What should every lead have?", ["A next step","A discount","An invoice"], "A lead with no next step dies."),
      ("¿Qué debería tener cada lead?", ["Un siguiente paso","Un descuento","Una factura"], "Un lead sin siguiente paso muere.")),
 Q(1, ("När bör du skapa leaden?", ["Efter affären","Så fort du ser en möjlighet","Aldrig"], "Skapa direkt."),
      ("When should you create the lead?", ["After the deal","As soon as you spot an opportunity","Never"], "Create it right away."),
      ("¿Cuándo crear el lead?", ["Tras la venta","En cuanto veas una oportunidad","Nunca"], "Créalo enseguida.")),
 Q(1, ("Vad är pipeline?", ["En statisk lista","Affärer i rörelse","Ett dokument"], "Affärer i rörelse, inte en lista."),
      ("What is a pipeline?", ["A static list","Deals in motion","A document"], "Deals in motion, not a list."),
      ("¿Qué es un pipeline?", ["Una lista estática","Ventas en movimiento","Un documento"], "Ventas en movimiento, no una lista.")),
 Q(1, ("Vad gör du i Sandbox?", ["Skarpa kunddata","Övar utan att något sparas","Skickar fakturor"], "Öva fritt, inget sparas."),
      ("What do you do in Sandbox?", ["Real customer data","Practise without anything being saved","Send invoices"], "Practise freely, nothing saved."),
      ("¿Qué haces en Sandbox?", ["Datos reales","Practicar sin que se guarde nada","Enviar facturas"], "Practica libremente, nada se guarda.")),
 Q(1, ("Hur avslutar du varje kontakt?", ["Utan plan","Genom att boka nästa steg","Med en rabatt"], "Boka alltid nästa steg."),
      ("How do you end every contact?", ["Without a plan","By booking the next step","With a discount"], "Always book the next step."),
      ("¿Cómo terminas cada contacto?", ["Sin plan","Agendando el siguiente paso","Con un descuento"], "Agenda siempre el siguiente paso.")),
 Q(1, ("Vad bör du fylla i på en ny lead?", ["Bara namn","Företag, kontakt och din observation","Inget"], "Fyll i ordentligt."),
      ("What should you fill in on a new lead?", ["Just the name","Company, contact and your observation","Nothing"], "Fill it in properly."),
      ("¿Qué rellenar en un lead nuevo?", ["Solo el nombre","Empresa, contacto y tu observación","Nada"], "Rellénalo bien.")),
 Q(1, ("Varför hålla CRM:t uppdaterat?", ["För skojs skull","Så vi ser vad som fungerar","Det krävs inte"], "Uppdaterad data visar vad som funkar."),
      ("Why keep the CRM updated?", ["For fun","So we see what works","It's not required"], "Updated data shows what works."),
      ("¿Por qué mantener el CRM actualizado?", ["Por diversión","Para ver qué funciona","No hace falta"], "Los datos actualizados muestran qué funciona.")),
])

# ── Emit SQL ────────────────────────────────────────────────────────────────
quiz_rows = []
for i, (key, svt, ent, est, _q) in enumerate(QUIZZES, 1):
    quiz_rows.append(f"  ({slit(key)}, {slit(svt)}, {slit(ent)}, {slit(est)}, {i})")
quiz_values = ",\n".join(quiz_rows)

q_rows = []
for key, _svt, _ent, _est, questions in QUIZZES:
    for ord_, (ci, sv, en, es) in enumerate(questions, 1):
        q_rows.append(
            "  (" + slit(key) + ", "
            + slit(sv[0]) + ", " + slit(en[0]) + ", " + slit(es[0]) + ", "
            + jarr(sv[1]) + ", " + jarr(en[1]) + ", " + jarr(es[1]) + ", "
            + str(ci) + ", "
            + slit(sv[2]) + ", " + slit(en[2]) + ", " + slit(es[2]) + ", "
            + str(ord_) + ")"
        )
q_values = ",\n".join(q_rows)

sql = f"""-- Seed the interactive quiz bank (sv/en/es) into public.quizzes + public.quiz_questions.
INSERT INTO public.quizzes (key, title, title_en, title_es, sort_order)
VALUES
{quiz_values}
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.quiz_questions
  (quiz_id, question, question_en, question_es, options, options_en, options_es,
   correct_index, explanation, explanation_en, explanation_es, sort_order)
SELECT qz.id, v.question, v.question_en, v.question_es, v.options, v.options_en, v.options_es,
       v.correct_index, v.explanation, v.explanation_en, v.explanation_es, v.sort_order
FROM (VALUES
{q_values}
) AS v(quiz_key, question, question_en, question_es, options, options_en, options_es,
       correct_index, explanation, explanation_en, explanation_es, sort_order)
JOIN public.quizzes qz ON qz.key = v.quiz_key
WHERE NOT EXISTS (
  SELECT 1 FROM public.quiz_questions x
  WHERE x.quiz_id = qz.id AND x.question = v.question
);
"""
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

# Self-check: every jsonb array literal must parse.
import re
arrs = re.findall(r"\$j\$(.*?)\$j\$", sql, re.S)
for a in arrs:
    parsed = json.loads(a)
    assert isinstance(parsed, list) and len(parsed) >= 2, a
total_q = sum(len(q) for *_x, q in QUIZZES)
print("wrote", os.path.basename(OUT), "with", len(QUIZZES), "quizzes,", total_q,
      "questions,", len(arrs), "option-arrays")
