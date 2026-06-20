#!/usr/bin/env python3
"""Rebuild courses in the deeper v2 format. Each module: subheadings, a
step-by-step method, a verbatim script (blockquote), common mistakes and a
practice exercise with a model answer. No emojis.

Each course is one training_item in the 'kurser' category. We REPLACE its
Swedish body with a richer TipTap document (en/es translations are done in a
follow-up pass; left untouched here). Idempotent UPDATE.

Batch 1: Grundkurs, Behovsanalys, Invändningshantering.
Emits supabase/migrations/20260620150000_courses_v2_batch1.sql
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260620150000_courses_v2_batch1.sql")

def txt(s): return {"type": "text", "text": s}
def btxt(s): return {"type": "text", "marks": [{"type": "bold"}], "text": s}
def H(s):   return {"type": "heading", "attrs": {"level": 3}, "content": [txt(s)]}
def SUB(s): return {"type": "paragraph", "content": [btxt(s)]}
def P(s):   return {"type": "paragraph", "content": [txt(s)]}
def _li(parts): return {"type": "listItem", "content": [{"type": "paragraph", "content": parts}]}
def UL(items):
    lis = [_li([btxt(it[0] + ": "), txt(it[1])]) if isinstance(it, tuple) else _li([txt(it)]) for it in items]
    return {"type": "bulletList", "content": lis}
def OL(items):
    return {"type": "orderedList", "content": [_li([btxt(l + " – "), txt(r)]) for l, r in items]}
def QUOTE(lines):
    paras = [{"type": "paragraph", "content": ([btxt(s + " ")] if s else []) + [txt(t)]} for s, t in lines]
    return {"type": "blockquote", "content": paras}
BUILDERS = {"h": H, "sub": SUB, "p": P, "ul": UL, "ol": OL, "quote": QUOTE}
def doc(modules):
    content = []
    for mod in modules:
        for kind, payload in mod:
            content.append(BUILDERS[kind](payload))
    return json.dumps({"type": "doc", "content": content}, ensure_ascii=False)
def jdoc(modules): return "$j$" + doc(modules) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

COURSES = []
def course(title_sv, modules): COURSES.append((title_sv, modules))

# ════════════ 1. GRUNDKURS: SÄLJ FRÅN A TILL Ö ════════════
course("Grundkurs: Sälj från A till Ö", [
 [("h","Modul 1 – Säljprocessen i överblick"),
  ("sub","Varför det här avgör allt"),
  ("p","En säljare som kan processen tappar aldrig fotfästet – du vet alltid var i affären du är och vad nästa steg är. De flesta förlorade affärer beror inte på fel produkt eller pris, utan på att säljaren hoppade över ett steg (oftast behovsanalysen) och presenterade för tidigt."),
  ("sub","Det här lär du dig"),
  ("ul",["De sju stegen och varför ordningen är helig","Var affären vinns respektive förloras","Hur du alltid vet ditt nästa steg"]),
  ("sub","De sju stegen"),
  ("ol",[("Prospektering","du hittar och kvalificerar rätt företag."),
         ("Första kontakt","du tar dig in med en konkret krok, oftast via ett kort samtal."),
         ("Behovsanalys","du gräver fram det verkliga behovet. Här vinns affären."),
         ("Förslag och offert","du presenterar bara det som löser behovet."),
         ("Invändningshantering","du bekräftar, vänder till värde och ställer en fråga."),
         ("Avslut","du får till ett avtal, lugnt och utan press."),
         ("Överlämning","bygg-teamet tar över och kontaktar kunden.")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att presentera lösning innan du förstått behovet."),
         ("Undvik","att se överlämningen som 'klart' – där befästs förtroendet."),
         ("Gör","att alltid avsluta en kontakt med ett bokat nästa steg.")]),
  ("sub","Öva"),
  ("p","Rita de sju stegen ur minnet och skriv en mening om ditt mål i varje steg."),
  ("p","Facit: målet i steg 1–2 är ett möte, i steg 3 att förstå behovet, i steg 4–6 ett avtal, i steg 7 en trygg överlämning.")],
 [("h","Modul 2 – Prospektering: hitta rätt företag"),
  ("sub","Varför det här avgör affären"),
  ("p","Säljer du till fel företag spelar ingen teknik någon roll. Bra prospektering betyder att du lägger tiden på företag som både har ett behov och kan fatta beslut. Tio rätt företag slår hundra slumpvisa."),
  ("sub","Det här lär du dig"),
  ("ul",["Vilka köpsignaler du ska leta efter","Hur du kvalificerar innan du ringer","Hur du formulerar en konkret krok"]),
  ("sub","Köpsignaler att leta efter"),
  ("ul",[("Daterad sajt","gammal, långsam eller inte mobilanpassad."),
         ("Svag synlighet","rankar inte på sina egna tjänster på Google."),
         ("Tillväxt","anställer, expanderar, syns i lokala nyheter."),
         ("Lucka","säljer produkter men saknar e-handel.")]),
  ("sub","Så kvalificerar du"),
  ("ol",[("Behov","finns en tydlig lucka du kan lösa?"),
         ("Storlek","har de råd och volym nog för en bra affär?"),
         ("Beslutsfattare","når du någon som kan säga ja?")]),
  ("sub","Ordagrant exempel på en krok"),
  ("quote",[(None,"\"Jag såg att ni inte syns på sökningen 'takläggare Göteborg' – det är förmodligen kunder som hamnar hos en konkurrent. Det var därför jag hörde av mig.\"")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att ringa utan en konkret observation – generiska samtal avfärdas direkt."),
         ("Undvik","att jaga kvantitet utan kvalificering."),
         ("Gör","att alltid anteckna din observation innan du ringer.")]),
  ("sub","Öva"),
  ("p","Hitta tre företag idag. Skriv för varje en köpsignal och en mening du skulle öppna med."),
  ("p","Facit: en bra öppning namnger en konkret iakttagelse om just dem och slutar med en fråga.")],
 [("h","Modul 3 – Behovsanalys och pitch som landar"),
  ("sub","Varför det här avgör affären"),
  ("p","Behovsanalysen är där affären vinns. När du förstår kundens verkliga smärta kan din pitch bli en spegel av deras egna ord, och då känns lösningen självklar. Pitchar du utan att ha grävt blir det en gissning – och gissningar bemöts med 'det är för dyrt'."),
  ("sub","Det här lär du dig"),
  ("ul",["Lyssna mer än du pratar (sikta på 70 procent)","Koppla pitchen till kundens exakta ord","Föreslå en sak, inte hela katalogen"]),
  ("sub","Så gör du"),
  ("ol",[("Gräv","ställ öppna frågor och låt kunden beskriva problemet och vad det kostar."),
         ("Bekräfta","sammanfatta: 'Så om jag förstår dig rätt…' och få ett 'ja, precis'."),
         ("Spegla","presentera lösningen med kundens egna nyckelord."),
         ("Avgränsa","föreslå det som löser deras största problem, inget mer.")]),
  ("sub","Ordagrant exempel"),
  ("quote",[("Du:","Du sa att nästan ingen hör av sig via sajten och att ni tappar jobb till konkurrenten."),
            ("Du:","Då föreslår jag en ny företagshemsida med SEO, så att de som söker er faktiskt hittar er och hör av sig.")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att rabbla funktioner – kunden köper resultat, inte funktioner."),
         ("Undvik","att presentera flera paket på en gång."),
         ("Gör","att låta tystnaden jobba efter en bra fråga.")]),
  ("sub","Öva"),
  ("p","Skriv fem öppna frågor du kan ställa i nästa behovsanalys."),
  ("p","Facit: bra frågor börjar med Hur, Vad eller Varför och handlar om kundens mål, nuläge och vad problemet kostar.")],
 [("h","Modul 4 – Avslut och överlämning"),
  ("sub","Varför det här avgör affären"),
  ("p","Säljarens jobb slutar vid avtalet, inte vid ett påtvingat ja. Ett lugnt avslut bygger förtroende; ett pressat avslut skapar ånger. När avtalet är på plats tar bygg-teamet över och kontaktar kunden, precis som ni kommit överens om."),
  ("sub","Det här lär du dig"),
  ("ul",["Avsluta utan press – målet är ett avtal","Föreslå nästa steg konkret","Lämna över så kunden känner sig trygg"]),
  ("sub","Så gör du"),
  ("ol",[("Sammanfatta värdet","knyt ihop med det kunden själv sagt."),
         ("Föreslå lugnt","'Känns det här rätt? Då sätter vi det på pränt i ett enkelt avtal.'"),
         ("Lämna över","'Sen tar vårt team vid och hör av sig för att dra igång.'"),
         ("Boka tiden","bekräfta nästa steg direkt innan ni avslutar.")]),
  ("sub","Ordagrant exempel"),
  ("quote",[(None,"\"Du sa att ni tappar jobb till konkurrenten – det här vänder det. Känns det rätt sätter vi det på pränt, så tar vårt team över och hör av sig nästa vecka. Låter det som en bra plan?\"")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","hårda avslutstekniker – är värdet tydligt säljer det sig självt."),
         ("Undvik","att lämna mötet utan ett bokat nästa steg."),
         ("Gör","att vara konkret om vad som händer efter avtalet.")]),
  ("sub","Öva"),
  ("p","Skriv en avslutsmening som föreslår ett avtal utan att kännas påträngande."),
  ("p","Facit: en bra avslutsmening sammanfattar värdet, föreslår avtalet och slutar med en lätt fråga att säga ja till.")]],
)

# ════════════ 2. BEHOVSANALYS & FRÅGETEKNIK ════════════
course("Behovsanalys & frågeteknik", [
 [("h","Modul 1 – Öppna och slutna frågor"),
  ("sub","Varför det här avgör affären"),
  ("p","Frågorna du ställer styr hela samtalet. Slutna frågor ger ja eller nej och stänger dörren; öppna frågor får kunden att prata, och då lär du dig vad du behöver för att sälja. En säljare som behärskar frågetekniken behöver knappt pitcha – kunden gör jobbet."),
  ("sub","Det här lär du dig"),
  ("ul",["Skillnaden mellan öppna och slutna frågor","När du ska använda vilken","Tumregeln 80/20 i behovsanalysen"]),
  ("sub","Så gör du"),
  ("ol",[("Öppna brett","börja med Hur, Vad eller Varför: 'Hur får ni in nya kunder idag?'"),
         ("Håll 80/20","cirka 80 procent öppna frågor i analysen; slutna sparar du till slutet."),
         ("Stäng med slutna","när du ska bekräfta och boka: 'Passar tisdag 10?'")]),
  ("sub","Ordagrant exempel"),
  ("quote",[("Stängt:","'Är ni nöjda med er hemsida?' (ger bara ja/nej)"),
            ("Öppet:","'Vad skulle ni vilja att hemsidan gjorde för er?' (får kunden att prata)")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att ställa ledande slutna frågor tidigt – samtalet dör."),
         ("Undvik","att kedja flera frågor på rad utan att lyssna på svaret."),
         ("Gör","att följa upp varje svar med en ny öppen fråga.")]),
  ("sub","Öva"),
  ("p","Skriv om tre slutna frågor du brukar ställa till öppna."),
  ("p","Facit: byt 'Har ni…' mot 'Hur/Vad…' och låt frågan handla om kundens situation, inte om ett ja.")],
 [("h","Modul 2 – Hitta den verkliga smärtan"),
  ("sub","Varför det här avgör affären"),
  ("p","Ingen betalar för en hemsida. De betalar för att lösa en smärta: för få kunder, ser oseriösa ut, tappar jobb till konkurrenten. Din uppgift är att gräva tills smärtan blir konkret och kännbar – för kunden, inte bara för dig."),
  ("sub","Det här lär du dig"),
  ("ul",["Skilja ytbehov ('en ny sajt') från verkligt behov ('fler kunder')","Använda frågetrappan för att göra smärtan dyr","Få kunden att själv sätta ord på värdet"]),
  ("sub","Frågetrappan steg för steg"),
  ("ol",[("Situationsfråga","kartlägg nuläget kort: 'Hur får ni in nya kunder idag?'"),
         ("Problemfråga","hitta vad som skaver: 'Vad är svårast med att få in förfrågningar?'"),
         ("Konsekvensfråga","gör problemet dyrt: 'Vad innebär det för omsättningen att ni tappar dem?'"),
         ("Nyttofråga","låt kunden beskriva värdet: 'Om ni fick dubbelt så många – vad vore det värt?'")]),
  ("sub","Ordagrant exempel"),
  ("quote",[("Du:","Vad är svårast med att få in nya förfrågningar?"),
            ("Kund:","Ärligt talat hör nästan ingen av sig via sajten."),
            ("Du:","Tappar ni då affärer till konkurrenter som syns bättre?"),
            ("Kund:","Antagligen. Vi vet att de ligger högre på Google."),
            ("Du:","Om sajten drog in fem förfrågningar i månaden – vad vore det värt?"),
            ("Kund:","Det skulle förändra hela vårt år.")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att hoppa från situation rakt till pitch."),
         ("Undvik","att ställa konsekvensfrågor som ett förhör – håll det varmt."),
         ("Gör","att anteckna kundens exakta ord till pitchen.")]),
  ("sub","Öva"),
  ("p","Skriv en frågetrappa (en fråga per steg) för en lokal redovisningsbyrå med en gammal sajt."),
  ("p","Facit: situation → problem → konsekvens (vad det kostar) → nytta (vad en lösning vore värd).")],
 [("h","Modul 3 – Aktivt lyssnande"),
  ("sub","Varför det här avgör affären"),
  ("p","Kunden köper av den som förstår dem. Aktivt lyssnande gör att kunden känner sig hörd och avslöjar mer – och ger dig de nyckelord du återanvänder i pitchen. Den som pratar minst lär sig mest."),
  ("sub","Det här lär du dig"),
  ("ul",["Prata mindre, pausa mer","Spegla och bekräfta","Fånga nyckelord du kan använda senare"]),
  ("sub","Så gör du"),
  ("ol",[("Pausa","var tyst efter en fråga och låt kunden fylla i."),
         ("Spegla","upprepa med egna ord: 'Så det viktigaste är…'"),
         ("Följ upp","ställ följdfrågor på det kunden faktiskt sa, inte på din agenda."),
         ("Anteckna","skriv ner exakta uttryck kunden använder.")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att planera din nästa fråga medan kunden pratar."),
         ("Undvik","att fylla varje tystnad."),
         ("Gör","att sammanfatta innan du går vidare.")]),
  ("sub","Öva"),
  ("p","I nästa möte: håll dig till att lyssna omkring 70 procent av tiden och notera tre nyckelord kunden använder."),
  ("p","Facit: nyckelord är de ord kunden själv väljer för sitt problem och mål – använd dem ordagrant i pitchen.")],
 [("h","Modul 4 – Sammanfatta och koppla behov till lösning"),
  ("sub","Varför det här avgör affären"),
  ("p","Bron mellan analys och pitch är en sammanfattning som kunden bekräftar. Ett 'ja, precis' innan du föreslår något gör att lösningen landar som ett svar på deras behov – inte som en säljares gissning."),
  ("sub","Det här lär du dig"),
  ("ul",["Sammanfatta behovet och få ett ja","Översätta behovet till rätt paket","Föreslå en sak som löser största problemet"]),
  ("sub","Så gör du"),
  ("ol",[("Sammanfatta","'Om jag förstått rätt är X viktigast och Y skaver mest – stämmer det?'"),
         ("Matcha","koppla behovet till en lösning: behov av fler kunder → hemsida + SEO."),
         ("Avgränsa","föreslå det som löser deras största problem, inte hela katalogen."),
         ("Knyt ihop","säg det med kundens egna ord.")]),
  ("sub","Ordagrant exempel"),
  ("quote",[(None,"\"Du sa att tid är er flaskhals och att ni tappar förfrågningar. Då föreslår jag en sajt som fångar förfrågningarna åt er automatiskt – så slipper ni det manuella.\"")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att pitcha innan kunden bekräftat behovet."),
         ("Undvik","att föreslå allt på en gång."),
         ("Gör","att para ihop ett behov med exakt en lösning.")]),
  ("sub","Öva"),
  ("p","Para ihop tre vanliga behov med rätt paket och motivera kort varför."),
  ("p","Facit: fler kunder → hemsida + SEO; intern process som skaver → webbapp; finnas i fickan → mobilapp.")]],
)

# ════════════ 3. INVÄNDNINGSHANTERING & FÖRHANDLING ════════════
course("Invändningshantering & förhandling", [
 [("h","Modul 1 – Metoden: bekräfta, vänd, fråga"),
  ("sub","Varför det här avgör affären"),
  ("p","En invändning är inte ett nej – det är en begäran om mer trygghet. Säljare som blir defensiva förlorar; de som bekräftar, vänder till värde och ställer en fråga behåller både relationen och affären. Rätt mindset: invändningen är en inbjudan, inte en attack."),
  ("sub","Det här lär du dig"),
  ("ul",["Tresstegsmetoden för varje invändning","Rätt mindset så du aldrig blir defensiv","Hur en fråga för samtalet framåt"]),
  ("sub","Metoden steg för steg"),
  ("ol",[("Bekräfta","möt känslan så kunden känns hörd: 'Jag förstår, det är en investering.'"),
         ("Vänd","byt vinkel till värde: 'Men en extra kund i månaden betalar den.'"),
         ("Fråga","för samtalet framåt: 'Vad är en ny kund värd för er?'")]),
  ("sub","Ordagrant exempel"),
  ("quote",[(None,"\"Jag förstår att det känns som mycket (bekräfta). Samtidigt: drar sajten in en enda extra kund i månaden har den betalat sig (vänd). Vad är en ny kund värd för er? (fråga)\"")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att gå i försvar eller argumentera emot."),
         ("Undvik","att sänka priset direkt vid första motståndet."),
         ("Gör","att alltid avsluta med en fråga.")]),
  ("sub","Öva"),
  ("p","Använd metoden på invändningen 'vi har redan en hemsida'."),
  ("p","Facit: bekräfta att det är bra, vänd till om den presterar, fråga 'hur många leads drar den in i månaden?'.")],
 [("h","Modul 2 – \"Det är för dyrt\""),
  ("sub","Varför det här avgör affären"),
  ("p","Den vanligaste invändningen betyder nästan aldrig 'vi saknar pengar' – den betyder 'jag ser inte värdet än'. Hanterar du den genom att sänka priset lär du kunden att pruta. Hanterar du den genom att höja värdet vinner du affären till rätt pris."),
  ("sub","Det här lär du dig"),
  ("ul",["Tolka vad 'för dyrt' egentligen betyder","Vända priset till avkastning","Erbjuda en mindre nivå istället för rabatt"]),
  ("sub","Så gör du"),
  ("ol",[("Bekräfta","'Jag förstår, det är en investering.'"),
         ("Vänd till ROI","räkna i kunder: 'Vad är en ny kund värd? En extra i månaden och den är betald.'"),
         ("Erbjud en väg in","'Vi kan börja i en mindre nivå och bygga vidare när det ger resultat.'"),
         ("Fråga","'Vad skulle få det här att kännas som en självklar investering?'")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att sänka priset reflexmässigt."),
         ("Undvik","att försvara priset med funktioner."),
         ("Gör","att alltid prata om vad det ger, inte vad det kostar.")]),
  ("sub","Öva"),
  ("p","Skriv ditt eget svar på 'det är för dyrt' i tre meningar (bekräfta, vänd, fråga)."),
  ("p","Facit: en stark replik erkänner investeringen, översätter priset till avkastning och slutar med en fråga.")],
 [("h","Modul 3 – Snabbguide till de vanligaste invändningarna"),
  ("sub","Varför det här avgör affären"),
  ("p","Kan du svaren i sömnen tappar du aldrig tempo. Nästan alla invändningar är varianter på samma åtta – lär dig grundsvaret på var och en så blir du aldrig ställd."),
  ("sub","De åtta och din vinkel"),
  ("ul",[("Vi har redan en hemsida","'Vad bra – hur många leads drar den in i månaden?'"),
         ("Vi gör det själva","'Är det där ni tjänar mest pengar? Varje timme på sajten är bort från kärnverksamheten.'"),
         ("Vi har ingen tid","'Just därför – vi sköter nästan allt åt er.'"),
         ("Skicka info","'Gärna – vad är viktigast för er, så skickar jag rätt sak och stämmer av på fredag.'"),
         ("Nöjda med nuvarande leverantör","'Vad bra. Många använder oss som komplement för t.ex. SEO eller GEO.'"),
         ("Funkar SEO/GEO?","'Bra att vara kritisk – vi mäter allt, ni ser ranking och leads varje månad.'"),
         ("Måste tänka på det","'Klokt. Är det priset, tajmingen eller något annat ni vill fundera på?'"),
         ("Det är för dyrt","'Det är en investering – vad är en ny kund värd för er?'")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att attackera nuvarande leverantör."),
         ("Undvik","att ta invändningen personligt."),
         ("Gör","att bekräfta först, alltid.")]),
  ("sub","Öva"),
  ("p","Be en kollega skjuta de åtta invändningarna mot dig och svara direkt enligt bekräfta–vänd–fråga."),
  ("p","Facit: alla åtta löses med samma struktur – bara vinkeln i 'vänd' ändras.")],
 [("h","Modul 4 – Förhandla på värde, inte pris"),
  ("sub","Varför det här avgör affären"),
  ("p","Priset är det sista du rör. Förhandlar du genom att sänka priset urholkar du både marginal och ditt värde i kundens ögon. Förhandlar du genom att justera omfång och be om något tillbaka behåller du värdet och får en bättre affär."),
  ("sub","Det här lär du dig"),
  ("ul",["Ankra med ditt ordinarie pris","Sänk omfång före pris","Ge aldrig utan att få något tillbaka"]),
  ("sub","Så gör du"),
  ("ol",[("Ankra","presentera ditt fulla pris och värde först."),
         ("Justera omfång","'Vi kan börja i en mindre nivå' i stället för att rabattera."),
         ("Byt, ge inte bort","'Jag kan lösa det priset om vi skriver ett längre avtal eller ni blir referens.'"),
         ("Håll tystnad","efter ett bud – den som pratar först förlorar ofta.")]),
  ("sub","Ordagrant exempel"),
  ("quote",[(None,"\"Jag kan möta er på priset om vi tar ett tolvmånadersavtal i stället för månadsvis – då vet vi båda att vi bygger något långsiktigt. Funkar det för er?\"")]),
  ("sub","Vanliga misstag"),
  ("ul",[("Undvik","att ge rabatt utan motprestation."),
         ("Undvik","att förhandla mot dig själv genom att fylla tystnaden."),
         ("Gör","att alltid påminna om resultatet, inte kostnaden.")]),
  ("sub","Öva"),
  ("p","Lista tre saker du kan be om i utbyte mot en prisjustering."),
  ("p","Facit: längre avtal, snabbare beslut, referens/case, fler tjänster i paketet eller förskottsbetalning.")]],
)

# ── Emit body-only UPDATEs ──────────────────────────────────────────────────
parts = []
for title_sv, modules in COURSES:
    parts.append(f"""UPDATE public.training_items ti
SET body = {jdoc(modules)}
FROM public.training_categories cat
WHERE ti.category_id = cat.id AND cat.slug = 'kurser'
  AND ti.title = {slit(title_sv)};""")

sql = ("-- Courses v2 (deeper format): replace the Swedish body of each course with a\n"
       "-- richer document. en/es translations are handled in a follow-up pass.\n\n"
       + "\n\n".join(parts) + "\n")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

import re
for d in re.findall(r"\$j\$(.*?)\$j\$", sql, re.S):
    json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(COURSES), "courses")
