#!/usr/bin/env python3
"""Generate the Kurser (courses) seed migration, approach A: one course = one
item, each module a section (heading + material) inside the body. sv/en/es."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260619230000_courses_batch1.sql")

LBL = {
 "sv": ("Mål", "Modul", "Det här lär du dig", "Material", "Exempel", "Öva"),
 "en": ("Goal", "Module", "What you'll learn", "Material", "Example", "Practice"),
 "es": ("Meta", "Módulo", "Qué aprenderás", "Material", "Ejemplo", "Practica"),
}

def build(lang, goal, modules):
    goalL, modL, learnL, matL, exL, prL = LBL[lang]
    content = [{"type": "paragraph", "content": [
        {"type": "text", "marks": [{"type": "bold"}], "text": goalL + ": "},
        {"type": "text", "text": goal}]}]
    for i, m in enumerate(modules, 1):
        content.append({"type": "heading", "attrs": {"level": 3},
                        "content": [{"type": "text", "text": f"{modL} {i} – {m[0]}"}]})
        for lbl, txt in ((learnL, m[1]), (matL, m[2]), (exL, m[3]), (prL, m[4])):
            content.append({"type": "paragraph", "content": [
                {"type": "text", "marks": [{"type": "bold"}], "text": lbl + ": "},
                {"type": "text", "text": txt}]})
    return json.dumps({"type": "doc", "content": content}, ensure_ascii=False)

def jlit(lang, goal, modules): return "$j$" + build(lang, goal, modules) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

# course = (titles{sv,en,es}, ord, goals{sv,en,es}, modules{sv,en,es}=[(name,learn,material,example,exercise)...])
COURSES = []
def add(svt, ent, est, ordn, gsv, gen, ges, msv, men, mes):
    COURSES.append((svt, ent, est, ordn, gsv, gen, ges, msv, men, mes))

# ── Course 1: Grundkurs – Sälj från A till Ö ────────────────────────────────
add("Grundkurs: Sälj från A till Ö", "Foundation course: Selling from A to Z",
    "Curso base: Vender de la A a la Z", 1,
 "Få en komplett bild av säljresan – från att hitta ett företag till ett påskrivet avtal och en trygg överlämning.",
 "Get a complete picture of the sales journey – from finding a company to a signed agreement and a smooth handover.",
 "Obtén una visión completa del recorrido de venta: desde encontrar una empresa hasta un acuerdo firmado y un traspaso fluido.",
 [("Säljprocessen i överblick",
   "de sju stegen och varför ordningen spelar roll.",
   "Säljprocessen går: prospektering, första kontakt, behovsanalys, förslag/offert, invändningar, avslut/avtal och överlämning. Hoppa inte över behovsanalysen – det är där affären avgörs.",
   "En affär som rusar till offert utan behovsanalys landar ofta i \"det är för dyrt\".",
   "Rita upp de sju stegen ur minnet."),
  ("Prospektering – hitta rätt företag",
   "att hitta företag med ett tydligt digitalt behov.",
   "Leta efter signaler: daterad sajt, dålig Google-ranking, ingen e-handel trots produkter, ett växande bolag. Notera alltid en konkret observation att öppna med.",
   "\"Jag såg att ni inte syns på takläggare Göteborg\" – en konkret krok.",
   "Hitta tre företag idag och skriv en observation om varje."),
  ("Behovsanalys",
   "ställa frågor som blottar det verkliga behovet.",
   "Lägg mest tid här. Ställ öppna frågor, lyssna mer än du pratar och bekräfta: \"Så om jag förstår dig rätt…\". Nu vet du exakt vilken lösning du ska föreslå.",
   "\"Hur får ni in nya kunder idag?\" säger mer än \"Vill ni ha fler kunder?\".",
   "Skriv fem öppna frågor du kan ställa i nästa möte."),
  ("Pitch, avslut & överlämning",
   "koppla förslaget till behovet och stänga lugnt.",
   "Presentera bara det som löser det kunden berättade. Avsluta utan press – målet är ett avtal: \"Känns det rätt? Då sätter vi det på pränt.\" När avtalet är klart tar bygg-teamet över och kontaktar kunden.",
   "\"Du sa att ni tappar jobb till konkurrenten – det här vänder det.\"",
   "Öva en avslutsmening som inte känns påträngande.")],
 [("The sales process at a glance",
   "the seven steps and why the order matters.",
   "The sales process goes: prospecting, first contact, needs analysis, proposal/quote, objections, close/agreement and handover. Don't skip the needs analysis – that's where the deal is decided.",
   "A deal that rushes to a quote without a needs analysis often ends in \"it's too expensive\".",
   "Sketch the seven steps from memory."),
  ("Prospecting – find the right companies",
   "to find companies with a clear digital need.",
   "Look for signals: a dated site, poor Google ranking, no e-commerce despite products, a growing company. Always note one concrete observation to open with.",
   "\"I noticed you don't show up for roofer Gothenburg\" – a concrete hook.",
   "Find three companies today and write one observation about each."),
  ("Needs analysis",
   "to ask questions that reveal the real need.",
   "Spend most time here. Ask open questions, listen more than you talk and confirm: \"So if I understand you correctly…\". Now you know exactly which solution to propose.",
   "\"How do you get new customers today?\" says more than \"Do you want more customers?\".",
   "Write five open questions you can ask in your next meeting."),
  ("Pitch, close & handover",
   "to tie the proposal to the need and close calmly.",
   "Present only what solves what the customer told you. Close without pressure – the goal is an agreement: \"Does this feel right? Then let's put it in writing.\" Once the agreement is set, the build team takes over and contacts the customer.",
   "\"You said you lose jobs to the competitor – this turns that around.\"",
   "Practise a closing line that doesn't feel pushy.")],
 [("El proceso de ventas de un vistazo",
   "los siete pasos y por qué importa el orden.",
   "El proceso de ventas es: prospección, primer contacto, análisis de necesidades, propuesta/presupuesto, objeciones, cierre/acuerdo y traspaso. No te saltes el análisis de necesidades: ahí se decide la venta.",
   "Una operación que corre al presupuesto sin análisis de necesidades suele acabar en \"es demasiado caro\".",
   "Dibuja los siete pasos de memoria."),
  ("Prospección – encuentra las empresas adecuadas",
   "a encontrar empresas con una necesidad digital clara.",
   "Busca señales: web anticuada, mal posicionamiento en Google, sin e-commerce pese a tener productos, empresa en crecimiento. Anota siempre una observación concreta para abrir.",
   "\"Vi que no aparecéis para instalador de tejados Gotemburgo\": un gancho concreto.",
   "Encuentra tres empresas hoy y escribe una observación de cada una."),
  ("Análisis de necesidades",
   "a hacer preguntas que revelen la necesidad real.",
   "Dedica aquí la mayor parte del tiempo. Haz preguntas abiertas, escucha más de lo que hablas y confirma: \"Si te entiendo bien…\". Ahora sabes qué solución proponer.",
   "\"¿Cómo conseguís clientes hoy?\" dice más que \"¿Queréis más clientes?\".",
   "Escribe cinco preguntas abiertas para tu próxima reunión."),
  ("Pitch, cierre y traspaso",
   "a conectar la propuesta con la necesidad y cerrar con calma.",
   "Presenta solo lo que resuelve lo que el cliente te contó. Cierra sin presión: el objetivo es un acuerdo: \"¿Te parece bien? Pues lo ponemos por escrito.\" Firmado el acuerdo, el equipo de construcción toma el relevo y contacta al cliente.",
   "\"Dijiste que pierdes trabajos frente al competidor: esto lo revierte.\"",
   "Practica una frase de cierre que no resulte insistente.")])

# ── Course 2: Behovsanalys & frågeteknik ────────────────────────────────────
add("Behovsanalys & frågeteknik", "Needs analysis & questioning technique",
    "Análisis de necesidades y técnica de preguntas", 2,
 "Bli den som ställer frågorna som öppnar affärer – och lyssnar så kunden själv sätter ord på behovet.",
 "Become the one who asks the questions that open deals – and listens so the customer puts the need into words themselves.",
 "Conviértete en quien hace las preguntas que abren ventas y escucha para que el cliente exprese la necesidad por sí mismo.",
 [("Öppna vs slutna frågor",
   "när du ska använda vilken sorts fråga.",
   "Slutna frågor ger ja/nej och stänger samtalet. Öppna frågor börjar med Hur, Vad, Varför eller Berätta och får kunden att prata. Tumregel: ca 80 % öppna frågor i behovsanalysen – slutna sparar du till att bekräfta och stänga.",
   "Istället för \"Har ni problem med få besökare?\" → \"Hur får ni in nya kunder idag?\"",
   "Skriv om tre slutna frågor du brukar ställa till öppna."),
  ("Hitta smärtan",
   "gräva tills du hittar det verkliga behovet.",
   "Folk köper för att lösa en smärta eller nå ett mål. Gräv vidare: \"Vad händer om det fortsätter så här?\" eller \"Vad kostar det er idag?\" Bekräfta: \"Så om jag förstår dig rätt…\". När kunden själv sätter ord på smärtan är halva affären gjord.",
   "Kund: \"Vår sajt är lite gammal.\" Du: \"Vad innebär det – tappar ni kunder till konkurrenter?\"",
   "Lista tre följdfrågor som gräver djupare på \"vår hemsida är gammal\"."),
  ("Aktivt lyssnande",
   "lyssna så kunden känner sig förstådd.",
   "Prata mindre, pausa mer. Upprepa med egna ord, nicka och ställ följdfrågor på det kunden faktiskt säger. Anteckna nyckelord – du använder dem i pitchen.",
   "\"Du nämnde att tid är er flaskhals – berätta mer om det.\"",
   "Nästa möte: håll dig till att lyssna ca 70 % av tiden."),
  ("Koppla behov till lösning",
   "översätta behovet till rätt paket.",
   "När du förstått behovet, matcha det mot en lösning och säg det med kundens egna ord. Föreslå en sak som löser deras största problem – inte hela katalogen.",
   "\"Du vill ha fler förfrågningar utan att lägga tid – då är hemsida + SEO rätt start.\"",
   "Para ihop tre vanliga behov med rätt paket.")],
 [("Open vs closed questions",
   "when to use which type of question.",
   "Closed questions give yes/no and close the conversation. Open questions start with How, What, Why or Tell me and get the customer talking. Rule of thumb: about 80% open questions in the needs analysis – save closed ones to confirm and close.",
   "Instead of \"Do you have a problem with few visitors?\" → \"How do you get new customers today?\"",
   "Rewrite three closed questions you usually ask into open ones."),
  ("Find the pain",
   "to dig until you find the real need.",
   "People buy to solve a pain or reach a goal. Dig further: \"What happens if it continues like this?\" or \"What does it cost you today?\" Confirm: \"So if I understand you correctly…\". When the customer puts the pain into words, half the deal is done.",
   "Customer: \"Our site is a bit old.\" You: \"What does that mean – are you losing customers to competitors?\"",
   "List three follow-up questions that dig deeper into \"our website is old\"."),
  ("Active listening",
   "to listen so the customer feels understood.",
   "Talk less, pause more. Paraphrase, nod and ask follow-ups on what the customer actually says. Note keywords – you'll use them in the pitch.",
   "\"You mentioned time is your bottleneck – tell me more about that.\"",
   "Next meeting: aim to listen about 70% of the time."),
  ("Link need to solution",
   "to translate the need into the right package.",
   "Once you understand the need, match it to a solution and say it in the customer's own words. Propose one thing that solves their biggest problem – not the whole catalogue.",
   "\"You want more enquiries without spending time – then website + SEO is the right start.\"",
   "Match three common needs with the right package.")],
 [("Preguntas abiertas vs cerradas",
   "cuándo usar cada tipo de pregunta.",
   "Las preguntas cerradas dan sí/no y cierran la conversación. Las abiertas empiezan con Cómo, Qué, Por qué o Cuéntame y hacen hablar al cliente. Regla general: un 80 % de preguntas abiertas en el análisis; las cerradas, para confirmar y cerrar.",
   "En vez de \"¿Tenéis problema con pocas visitas?\" → \"¿Cómo conseguís clientes hoy?\"",
   "Reescribe en abiertas tres preguntas cerradas que sueles hacer."),
  ("Encuentra el dolor",
   "a indagar hasta encontrar la necesidad real.",
   "La gente compra para resolver un dolor o alcanzar una meta. Indaga más: \"¿Qué pasa si sigue así?\" o \"¿Cuánto os cuesta hoy?\" Confirma: \"Si te entiendo bien…\". Cuando el cliente pone el dolor en palabras, media venta está hecha.",
   "Cliente: \"Nuestra web es algo antigua.\" Tú: \"¿Qué implica eso? ¿Perdéis clientes frente a la competencia?\"",
   "Enumera tres preguntas de seguimiento que profundicen en \"nuestra web es antigua\"."),
  ("Escucha activa",
   "a escuchar para que el cliente se sienta comprendido.",
   "Habla menos, haz más pausas. Parafrasea, asiente y haz preguntas sobre lo que el cliente dice de verdad. Anota palabras clave: las usarás en el pitch.",
   "\"Mencionaste que el tiempo es vuestro cuello de botella; cuéntame más.\"",
   "Próxima reunión: intenta escuchar alrededor del 70 % del tiempo."),
  ("Conecta necesidad y solución",
   "a traducir la necesidad al paquete adecuado.",
   "Cuando entiendas la necesidad, conéctala con una solución y dilo con las palabras del cliente. Propón una cosa que resuelva su mayor problema, no todo el catálogo.",
   "\"Queréis más solicitudes sin dedicar tiempo: entonces web + SEO es el inicio adecuado.\"",
   "Empareja tres necesidades comunes con el paquete adecuado.")])

# ── Course 3: Invändningshantering & förhandling ────────────────────────────
add("Invändningshantering & förhandling", "Objection handling & negotiation",
    "Manejo de objeciones y negociación", 3,
 "Vänd ett nej till ett ja genom att bekräfta, vända till värde och ställa en fråga – och förhandla på värde, inte pris.",
 "Turn a no into a yes by acknowledging, turning to value and asking a question – and negotiate on value, not price.",
 "Convierte un no en un sí: reconoce, lleva al valor y haz una pregunta; y negocia sobre el valor, no el precio.",
 [("Metoden: bekräfta – vänd – fråga",
   "en enkel struktur för varje invändning.",
   "Ett: bekräfta känslan så kunden känner sig hörd. Två: vänd till värde eller en ny vinkel. Tre: avsluta med en fråga som för samtalet framåt. Bli aldrig defensiv.",
   "\"Jag förstår att det är en investering (bekräfta). Men en extra kund i månaden betalar den (vänd). Vad är en ny kund värd för er? (fråga)\"",
   "Använd metoden på invändningen \"vi har redan en hemsida\"."),
  ("\"Det är för dyrt\"",
   "hantera den vanligaste invändningen.",
   "\"För dyrt\" betyder oftast \"jag ser inte värdet än\". Vänd till avkastning och erbjud att börja i en mindre nivå. Sälj aldrig på pris – sälj på vad det ger.",
   "\"Vad är en ny kund värd? Drar sajten in en extra kund i månaden har den betalat sig.\"",
   "Skriv ditt eget svar på \"det är för dyrt\" i tre meningar."),
  ("Förhandla på värde, inte pris",
   "hålla emot rabattjakt utan att tappa affären.",
   "Sänk hellre omfånget än priset – ge inte bort värde gratis. Om du måste röra priset, be om något tillbaka: snabbare beslut, längre avtal eller en referens. Påminn om resultatet, inte kostnaden.",
   "\"Jag kan börja i en mindre nivå istället för att sänka priset – då kommer ni igång nu.\"",
   "Lista tre saker du kan be om i utbyte mot en rabatt."),
  ("När du ska boka möte istället",
   "känna igen när invändningen bäst löses i ett möte.",
   "Vissa invändningar som \"skicka info\" eller \"måste tänka på det\" är artiga avfärdningar. Behåll initiativet: föreslå en kort återkoppling eller ett möte istället för att släppa taget. Ett ja till ett möte är också ett ja.",
   "\"Jag skickar gärna – ska vi ta 15 minuter på fredag så blir det relevant?\"",
   "Formulera en mötesfråga för \"skicka info så återkommer vi\".")],
 [("The method: acknowledge – turn – ask",
   "a simple structure for every objection.",
   "One: acknowledge the feeling so the customer feels heard. Two: turn to value or a new angle. Three: end with a question that moves the conversation forward. Never get defensive.",
   "\"I understand it's an investment (acknowledge). But one extra customer a month pays for it (turn). What is a new customer worth to you? (ask)\"",
   "Apply the method to the objection \"we already have a website\"."),
  ("\"It's too expensive\"",
   "to handle the most common objection.",
   "\"Too expensive\" usually means \"I don't see the value yet\". Turn to return and offer to start at a smaller level. Never sell on price – sell on what it delivers.",
   "\"What is a new customer worth? If the site brings in one extra a month, it's paid for itself.\"",
   "Write your own three-sentence answer to \"it's too expensive\"."),
  ("Negotiate on value, not price",
   "to resist discount-hunting without losing the deal.",
   "Lower the scope rather than the price – don't give value away for free. If you must move on price, ask for something back: a faster decision, a longer contract or a referral. Remind them of the result, not the cost.",
   "\"I can start at a smaller level instead of cutting the price – that way you get going now.\"",
   "List three things you can ask for in exchange for a discount."),
  ("When to book a meeting instead",
   "to recognise when an objection is best solved in a meeting.",
   "Some objections like \"send info\" or \"need to think about it\" are polite brush-offs. Keep the initiative: propose a short follow-up or a meeting instead of letting go. A yes to a meeting is also a yes.",
   "\"Happy to send it – shall we take 15 minutes on Friday so it's relevant?\"",
   "Phrase a meeting question for \"send info and we'll get back to you\".")],
 [("El método: reconoce – gira – pregunta",
   "una estructura simple para cada objeción.",
   "Uno: reconoce la emoción para que el cliente se sienta escuchado. Dos: gira hacia el valor o un nuevo ángulo. Tres: termina con una pregunta que avance la conversación. Nunca te pongas a la defensiva.",
   "\"Entiendo que es una inversión (reconoce). Pero un cliente extra al mes la paga (gira). ¿Cuánto vale un cliente nuevo para ti? (pregunta)\"",
   "Aplica el método a la objeción \"ya tenemos una web\"."),
  ("\"Es demasiado caro\"",
   "a manejar la objeción más común.",
   "\"Demasiado caro\" suele significar \"aún no veo el valor\". Gira hacia el retorno y ofrece empezar con un nivel menor. Nunca vendas por precio: vende por lo que aporta.",
   "\"¿Cuánto vale un cliente nuevo? Si la web trae uno extra al mes, ya se paga sola.\"",
   "Escribe tu propia respuesta a \"es demasiado caro\" en tres frases."),
  ("Negocia sobre valor, no precio",
   "a resistir la caza de descuentos sin perder la venta.",
   "Reduce el alcance antes que el precio: no regales valor. Si debes tocar el precio, pide algo a cambio: una decisión más rápida, un contrato más largo o una referencia. Recuerda el resultado, no el coste.",
   "\"Puedo empezar con un nivel menor en vez de bajar el precio: así arrancáis ya.\"",
   "Enumera tres cosas que puedes pedir a cambio de un descuento."),
  ("Cuándo agendar una reunión en su lugar",
   "a reconocer cuándo una objeción se resuelve mejor en una reunión.",
   "Algunas objeciones como \"envía info\" o \"tenemos que pensarlo\" son rechazos corteses. Mantén la iniciativa: propón un breve seguimiento o una reunión en lugar de soltar. Un sí a una reunión también es un sí.",
   "\"Te la envío con gusto: ¿15 minutos el viernes para que sea relevante?\"",
   "Formula una pregunta de reunión para \"envía info y os contactamos\".")])

rows = []
for svt, ent, est, ordn, gsv, gen, ges, msv, men, mes in COURSES:
    rows.append(
        f"  ({slit(svt)}, {slit(ent)}, {slit(est)}, "
        f"{jlit('sv', gsv, msv)}, {jlit('en', gen, men)}, {jlit('es', ges, mes)}, {ordn})"
    )
values = ",\n".join(rows)
sql = f"""-- Seed courses (approach A: one item per course, modules as sections) into the
-- Kurser category, sv/en/es. Skips items whose title already exists.
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
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

import re
docs = re.findall(r"\$j\$(.*?)\$j\$", sql, re.S)
for d in docs:
    json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(COURSES), "courses,", len(docs), "json docs")
