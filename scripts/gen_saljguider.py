#!/usr/bin/env python3
"""Rebuild the 17 sales pitches as deep 'Säljguide' playbooks: a script the rep
follows live (when to use, hook, qualifying questions, pitch, what's included,
value/ROI, the package's own objections + answers, close, price). No emojis.

Each is a training_item in the 'saljmanus' category, currently titled
'Säljpitch: X'. We rename it to 'Säljguide: X' and replace the Swedish body
(en/es translations follow). Emits 20260620170000_saljguider.sql
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260620170000_saljguider.sql")

def txt(s): return {"type": "text", "text": s}
def btxt(s): return {"type": "text", "marks": [{"type": "bold"}], "text": s}
def SUB(s): return {"type": "paragraph", "content": [btxt(s)]}
def P(s):   return {"type": "paragraph", "content": [txt(s)]}
def _li(parts): return {"type": "listItem", "content": [{"type": "paragraph", "content": parts}]}
def UL(items):
    return {"type": "bulletList", "content": [
        _li([btxt(it[0] + ": "), txt(it[1])]) if isinstance(it, tuple) else _li([txt(it)]) for it in items]}
def QUOTE(t): return {"type": "blockquote", "content": [{"type": "paragraph", "content": [txt(t)]}]}

def guide_body(g):
    c = []
    c.append(SUB("När du använder den")); c.append(P(g["nar"]))
    c.append(SUB("Öppning (krok)")); c.append(QUOTE(g["krok"]))
    c.append(SUB("Behovsfrågor")); c.append(UL(g["fragor"]))
    c.append(SUB("Pitchen"))
    c.append(UL([("Problem", g["problem"]), ("Lösning", g["losning"]), ("Resultat", g["resultat"])]))
    c.append(SUB("Det här ingår")); c.append(UL(g["ingar"]))
    c.append(SUB("Värde och ROI")); c.append(QUOTE(g["varde"]))
    c.append(SUB("Invändningar för det här paketet"))
    for obj, svar in g["invandningar"]:
        c.append(SUB(obj)); c.append(P(svar))
    c.append(SUB("Avslut")); c.append(QUOTE(g["avslut"]))
    c.append(SUB("Pris")); c.append(P(g["pris"]))
    return json.dumps({"type": "doc", "content": c}, ensure_ascii=False)

def jbody(g): return "$j$" + guide_body(g) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

GUIDES = []
def guide(pkg, **g): g["pkg"] = pkg; GUIDES.append(g)

guide("Landningssida",
 nar="För kunder som vill testa en idé, dra igång en kampanj eller fånga leads snabbt – en enda fokuserad sida byggd för att konvertera.",
 krok="Vill ni testa något snabbt eller fånga fler leads från era annonser? Då är den smartaste starten en enda vass sida byggd för ett enda mål.",
 fragor=["Vart skickar ni er annonstrafik idag?","Vad vill ni att besökaren ska göra på sidan?","Hur snabbt vill ni vara igång?"],
 problem="Skickar ni trafik till en rörig sajt tappar ni de flesta besökare innan de gör något.",
 losning="En landningssida är en enda sida med ett tydligt budskap och ett mål: att få besökaren att höra av sig eller köpa.",
 resultat="Fler leads från samma annonsbudget, och ni är igång ofta redan denna vecka.",
 ingar=["En mobilanpassad sida","Skarpt budskap och tydlig call-to-action","Lead- eller kontaktformulär","Grundläggande SEO","Koppling till analys och pixel"],
 varde="Från 9 000 kr får ni en sida som gör att varje annonskrona landar någonstans som faktiskt säljer.",
 invandningar=[("\"Räcker inte vår vanliga sajt?\"","En vanlig sajt har många utgångar och distraktioner. En landningssida har ett enda mål och konverterar därför mycket bättre på annonstrafik."),
               ("\"Det känns för litet.\"","Det är just poängen – ni börjar lågt och bygger vidare när det ger resultat. Sidan kan växa till en full hemsida sen.")],
 avslut="Ska vi sätta upp er första sida så börjar ni fånga leads direkt?",
 pris="Från 9 000 kr. Kan byggas vidare till en full företagshemsida.")

guide("Företagshemsida",
 nar="För etablerade företag och tjänsteföretag som vill se trovärdiga ut, få in fler förfrågningar och kunna uppdatera sajten själva. Särskilt stark när kunden har en gammal eller långsam sajt.",
 krok="Era kunder bestämmer sig på tre sekunder om de stannar eller klickar vidare. Får jag fråga – hur många förfrågningar drar er nuvarande sajt in i månaden?",
 fragor=["Hur får ni in nya kunder idag?","Vad skulle ni vilja att hemsidan gjorde som den inte gör nu?","Vem uppdaterar sajten idag och hur ofta?"],
 problem="En daterad eller långsam sajt skickar kunder rakt till konkurrenten – affärer ni aldrig ens får veta att ni förlorade.",
 losning="En snabb, snygg och säljande sajt ni är stolta över, med eget CMS så ni uppdaterar den själva.",
 resultat="Fler förfrågningar från rätt kunder, och en sajt som jobbar för er dygnet runt.",
 ingar=["Upp till sju sidor","Responsiv design för mobil, surfplatta och dator","Eget CMS – inga utvecklarkunskaper behövs","On-page SEO och Google Analytics","Kontaktformulär och koppling till sociala medier"],
 varde="Tänk på sajten som er bästa säljare – den jobbar dygnet runt och kostar 18 000 kr en gång. En extra kund i månaden och den är betald flera gånger om.",
 invandningar=[("\"Vi har redan en hemsida.\"","Vad bra, då har ni grunden. Hur många leads drar den in i månaden? Många sajter är snygga broschyrer men säljer inte – jag kan visa var ni tappar besökare."),
               ("\"Det är för dyrt.\"","Det är en investering. Vad är en ny kund värd för er? En extra i månaden och sajten är betald. Vi kan också börja i en enklare nivå."),
               ("\"Kan vi inte fixa det själva i Wix?\"","Visst kan ni, men ni betalar med er tid och får sällan fart, SEO och konvertering på köpet. Vi bygger det rätt från start så ni kan lägga tiden på era kunder.")],
 avslut="Det här är vårt populäraste paket, och det är ingen slump. Ska jag visa ett par exempel och ta fram ett förslag till på fredag?",
 pris="18 000 kr engångs. Tillägg: extra sidor, copywriting, fotografering, löpande SEO.")

guide("MVP",
 nar="För startups och företag som har en produktidé men vill validera den med riktiga användare innan de satsar stort.",
 krok="Har ni en produktidé men vill inte lägga hundratusentals kronor innan ni vet att den funkar?",
 fragor=["Vad är kärnan i idén – vad måste den absolut göra?","Vem är den första användaren ni vill testa på?","Vad händer om ni väntar ett halvår med att lansera?"],
 problem="Den största risken är att bygga en stor, dyr produkt som ingen vill ha.",
 losning="En MVP är en fungerande första version med bara kärnfunktionerna, byggd för att testas på riktiga användare.",
 resultat="På 4–6 veckor har ni något skarpt att visa kunder och investerare – och ni äger källkoden.",
 ingar=["Överenskomna kärnfunktioner","En fungerande produkt på 4–6 veckor","Skalbar grund att bygga vidare på","Ni äger källkoden"],
 varde="Från 29 000 kr går ni från idé till en produkt ni kan visa – i stället för att gissa er fram med en dyr fullskalig satsning.",
 invandningar=[("\"Vi vill ha allt med från start.\"","Det är just fällan. Bygger ni allt direkt riskerar ni att lägga pengar på funktioner ingen använder. Vi bygger kärnan, testar, och bygger vidare på det som faktiskt efterfrågas."),
               ("\"Hur vet vi vad som ska ingå?\"","Det hjälper vi er att prioritera. Vi utgår från det enda problem produkten måste lösa för den första användaren.")],
 avslut="Ska vi skissa på er MVP och se hur snabbt vi kan ha något att visa?",
 pris="Från 29 000 kr, levereras på 4–6 veckor. Kan kombineras med designpartner.")

guide("Webbapp",
 nar="För företag som sitter fast i manuellt arbete, kalkylark eller dubbeljobb och behöver verklig funktionalitet – inloggning, data, automatik.",
 krok="Hur mycket tid lägger ni på manuellt arbete som ett system egentligen borde sköta åt er?",
 fragor=["Beskriv processen som tar mest tid idag.","Vilka behöver logga in och se olika saker?","Vad skulle hända om det jobbet automatiserades?"],
 problem="När en vanlig hemsida inte räcker fastnar ni i manuellt arbete som stjäl tid och skapar fel.",
 losning="En skräddarsydd webbapp med inloggning, roller, databas och adminpanel som löser just ert problem.",
 resultat="Systemet gör jobbet åt er – ni går från att jaga processen till att äga den.",
 ingar=["Roller och behörigheter","Databas och adminpanel","Skalbar arkitektur","Anpassad funktionalitet efter er process"],
 varde="Från 49 000 kr får ni tillbaka tid varje vecka och slipper fel som kostar pengar. Räkna på vad de timmarna är värda.",
 invandningar=[("\"Kan det integreras med våra system?\"","Oftast ja – vi kopplar mot det ni redan använder så att inget dubbelarbete behövs."),
               ("\"Det låter dyrt.\"","Sätt det mot vad det manuella arbetet kostar i timmar och fel. En webbapp betalar oftast av sig i sparad tid.")],
 avslut="Berätta om er mest tidskrävande process, så visar jag konkret vad vi kan automatisera. Ska vi boka en genomgång?",
 pris="Från 49 000 kr. Exakt pris efter en kort behovsanalys.")

guide("Mobilapp",
 nar="För tjänster som vill finnas i kundens ficka med återkommande användning, push-notiser och lojalitet.",
 krok="Vill ni finnas ett tryck bort i kundens ficka, med möjlighet att nå dem direkt med push?",
 fragor=["Vad ska appen göra för era kunder?","Hur ofta skulle de använda den?","Vill ni nå dem med notiser?"],
 problem="Utan en egen app är ni beroende av att kunden själv kommer ihåg att besöka er.",
 losning="En app för både iOS och Android från samma kodbas, med push-notiser som tar er rakt in i deras vardag.",
 resultat="Återkommande användning och en direktkanal till kunden – om och om igen.",
 ingar=["Utveckling för iOS och Android från en kodbas","Push-notiser","Backend","Publicering i App Store och Google Play"],
 varde="Från 79 000 kr får ni den mest värdefulla platsen som finns: en plats på kundens hemskärm.",
 invandningar=[("\"Räcker det inte med en mobilanpassad sajt?\"","En sajt är bra för att hittas, men en app ger push-notiser och återkommande användning som en sajt inte kan. De kompletterar varandra."),
               ("\"Måste vi bygga två appar?\"","Nej – vi bygger för både iOS och Android från samma kodbas, vilket är snabbare och billigare än två separata.")],
 avslut="Vad vill ni att appen ska göra för era kunder? Ska vi skissa på upplägget?",
 pris="Från 79 000 kr. App Store- och Google-konton tillkommer hos kund.")

guide("SEO Start",
 nar="För kunder som har en sajt men inte rankar, har mindre budget och vill börja synas högre på Google.",
 krok="Era kunder googlar redan det ni säljer. Frågan är om de hittar er eller konkurrenten – ska vi ta reda på det?",
 fragor=["Vilka sökord skulle era kunder använda?","Vet ni var ni rankar idag?","Hur mycket av er försäljning kommer från Google nu?"],
 problem="Syns ni inte på Google ger ni bort kunder gratis till den som ligger högre.",
 losning="SEO Start lägger grunden: on-page-optimering, nyckelordsanalys och en tydlig månadsrapport.",
 resultat="Långsiktig, organisk trafik som inte kostar per klick och inte försvinner när ni slutar annonsera.",
 ingar=["On-page-optimering","Nyckelordsanalys","Tydlig månadsrapport","Löpande arbete"],
 varde="Från 4 900 kr/mån bygger ni en trafikkälla som ger kunder månad efter månad, till en bråkdel av vad annonser kostar över tid.",
 invandningar=[("\"När syns resultat?\"","SEO är långsiktigt – oftast 3–6 månader. Men trafiken ni bygger blir kvar och kostar inget per klick."),
               ("\"Kan ni garantera plats 1?\"","Nej, och var skeptisk mot den som lovar det. Men vi mäter allt och flyttar fram positionerna varje månad, svart på vitt.")],
 avslut="Ska vi börja med en kostnadsfri synlighetsanalys så ni ser var ni står idag?",
 pris="Från 4 900 kr/mån, löpande. Kräver en fungerande sajt att optimera.")

guide("SEO Tillväxt",
 nar="För företag som menar allvar med att äga sina sökord och ta marknadsandelar.",
 krok="Vill ni inte bara synas, utan äga era viktigaste sökord och gå förbi konkurrenterna?",
 fragor=["Vilka sökord vill ni dominera?","Vilka är era tuffaste konkurrenter online?","Hur mycket är en topplacering värd för er?"],
 problem="Topplaceringarna är inte upptagna av en slump – någon jobbar för dem varje månad.",
 losning="SEO Tillväxt är offensivt: löpande content, länkbygge och teknisk SEO, allt mätbart.",
 resultat="Position för position tar ni era viktigaste sökord och fler kvalificerade kunder hittar er.",
 ingar=["Allt i SEO Start","Löpande innehållsproduktion","Länkbygge","Teknisk SEO","Månadsrapport"],
 varde="Från 9 900 kr/mån bygger ni en tillväxtmotor som flyttar fram positionerna varje månad – i konkurrensutsatta branscher är det skillnaden mellan att synas och att försvinna.",
 invandningar=[("\"Det är dyrare än Start.\"","Ja, för det är offensivt och tar er förbi konkurrenter. I en bransch där alla slåss om samma kunder är det oftast värt varje krona."),
               ("\"Vi provade SEO förut utan resultat.\"","Då mättes det förmodligen inte ordentligt. Hos oss ser ni ranking, trafik och leads varje månad – inga gissningar.")],
 avslut="Får jag visa var ni rankar idag och vart vi kan ta er på tre månader?",
 pris="Från 9 900 kr/mån, löpande.")

guide("GEO / AI-synlighet",
 nar="För framåtlutade företag som vill ligga före konkurrenterna i AI-sök som ChatGPT och Perplexity.",
 krok="Allt fler frågar ChatGPT i stället för Google. Vet ni hur AI:n beskriver ert företag idag?",
 fragor=["Har ni testat fråga ChatGPT om er bransch?","Vet ni om ni nämns eller inte?","Hur viktigt är det att ligga före konkurrenterna?"],
 problem="Syns ni inte i AI-svaren finns ni helt enkelt inte i det samtalet – och det finns inget annonsutrymme att köpa sig in på.",
 losning="GEO gör er till den AI:n nämner och rekommenderar: en GEO-analys, en åtgärdsplan och löpande uppföljning.",
 resultat="Ett försprång på en kanal era konkurrenter ännu inte ens tänkt på.",
 ingar=["GEO-analys","Konkret åtgärdsplan","Löpande uppföljning av AI-synligheten"],
 varde="Från 6 900 kr/mån tar ni en plats som bara finns att ta just nu – innan konkurrenterna vaknar.",
 invandningar=[("\"Är det inte för tidigt?\"","Tvärtom – det är just därför det är värt det. Era konkurrenter syns inte än, så den som agerar nu får försprånget."),
               ("\"Hur mäter man det?\"","Vi följer hur AI beskriver och rekommenderar er över tid, och visar utvecklingen löpande.")],
 avslut="Vill ni se hur AI beskriver ert företag just nu? Det är en bra start.",
 pris="Från 6 900 kr/mån, löpande.")

guide("Designpartner",
 nar="För företag med kontinuerligt designbehov som inte vill anställa en heltidsdesigner eller jaga frilansare.",
 krok="Hur ofta fastnar ni för att ni saknar en designer just när ni behöver en?",
 fragor=["Hur ser ert designbehov ut över ett år?","Vad gör ni idag när ni behöver design?","Hur viktigt är ett enhetligt uttryck?"],
 problem="En heltidsdesigner är dyr, och frilansare försvinner mitt i ett projekt.",
 losning="En hel designavdelning på abonnemang: UI/UX och grafiskt material, prioriterad tillgång och en kö ni fyller i er egen takt.",
 resultat="Förutsägbar kostnad, ingen rekrytering och alltid någon redo.",
 ingar=["UI/UX och grafiskt material","Prioriterad tillgång","En kö där ni skickar in i er takt","Enhetligt uttryck över allt ni gör"],
 varde="Från 9 000 kr/mån får ni proffsdesign löpande till en förutsägbar kostnad – och slipper både rekrytering och dyra engångsuppdrag.",
 invandningar=[("\"Vi behöver inte design hela tiden.\"","Då pausar ni när behovet är litet. Men de flesta upptäcker att de har mer löpande behov än de tror när tröskeln är låg."),
               ("\"Hur många uppgifter får vi?\"","En i taget i kön, i er egen takt – så ni alltid har något på gång utan att betala för en heltidsanställd.")],
 avslut="Vad har ni för designbehov de närmaste månaderna? Ska vi sätta igång med en första uppgift?",
 pris="Från 9 000 kr/mån, abonnemang.")

guide("Logotyp & varumärke",
 nar="För nya företag, ombranding eller de som ser spretiga ut och vill bli ihågkomna.",
 krok="Hur vill ni att kunderna ska minnas er – och tar ni betalt som det varumärke ni vill vara?",
 fragor=["Hur ser ert nuvarande uttryck ut?","Vad vill ni att kunderna ska känna?","Var används logotypen idag?"],
 problem="Ett svagt varumärke gör att ni blir en i mängden som tvingas konkurrera med pris.",
 losning="En logotyp och identitet som känns rätt och håller i åratal: logotyp, färger, typsnitt och en brandguide.",
 resultat="Kunderna minns er, och ni kan ta bättre betalt.",
 ingar=["Logotyp","Färgpalett","Typsnitt","Brandguide för enhetligt uttryck"],
 varde="Från 12 000 kr får ni ett varumärke som gör att allt ni gör ser proffsigt ut – och som låter er ta marknadsledarens priser.",
 invandningar=[("\"Vi har redan en logga.\"","Bra utgångsläge. Frågan är om den håller över tid och funkar överallt – jag kan ge en ärlig bedömning och visa vad som kan lyfta den."),
               ("\"Är det verkligen värt det?\"","Ett starkt varumärke gör att ni kan ta mer betalt och blir ihågkomna. Det betalar sig på varje affär framåt.")],
 avslut="Hur vill ni att kunderna ska uppfatta er? Ska vi ta fram ett första förslag?",
 pris="Från 12 000 kr. Bra dörröppnare före en hemsida.")

guide("E-handel Start",
 nar="För mindre butiker som vill börja sälja online utan en stor investering.",
 krok="Vill ni börja sälja online och ha en butik som tar betalt även medan ni sover?",
 fragor=["Hur många produkter har ni?","Säljer ni redan online idag?","Hur vill ni ta betalt?"],
 problem="Att komma igång med e-handel känns ofta dyrt och krångligt – så det blir inte av.",
 losning="En komplett butik på vår egen plattform med eget CMS, betalning och frakt, igång snabbt.",
 resultat="Ni börjar sälja nu och uppgraderar i takt med att försäljningen växer.",
 ingar=["Eget CMS","Betalning med Klarna eller Stripe","Frakt och mobilanpassning","Plats för upp till cirka 100 produkter","Grundläggande SEO"],
 varde="Från 19 000 kr i uppstart och 1 490 kr/mån får ni en butik som säljer dygnet runt – till en låg tröskel.",
 invandningar=[("\"Vi kanske borde köra Shopify.\"","Ni slipper Shopifys månadslicenser och appavgifter. Vi bygger på vår egen plattform och sköter driften, så ni kan fokusera på att sälja."),
               ("\"Tänk om vi växer ur den?\"","Då uppgraderar ni till Plus eller Pro. Ni börjar lågt och växer i er egen takt.")],
 avslut="Ska vi sätta upp er butik och få den första ordern att ticka in?",
 pris="Från 19 000 kr uppstart + 1 490 kr/mån.")

guide("E-handel Plus",
 nar="För butiker som börjar växa och behöver mer kraft för att sälja mer.",
 krok="Börjar er butik växa och ni behöver mer kraft – fler produkter, kampanjer och återkommande kunder?",
 fragor=["Ungefär hur många produkter har ni?","Vill ni jobba med rabattkoder och nyhetsbrev?","Vad stoppar er från att sälja mer idag?"],
 problem="En butik som börjar sälja men inte kan växa blir snabbt en flaskhals.",
 losning="Vårt populäraste e-handelspaket: fler produkter, flera betalningslösningar, rabattkoder, kundkonton och nyhetsbrev.",
 resultat="Högre snittköp och kunder som kommer tillbaka.",
 ingar=["Upp till cirka 1 000 produkter","Flera betalningslösningar","Rabattkoder och kundkonton","Nyhetsbrev-integration","On-page SEO"],
 varde="Från 35 000 kr i uppstart och 2 490 kr/mån får ni funktioner byggda för att höja snittköpet och få kunderna att återkomma.",
 invandningar=[("\"Det är ett kliv upp i pris.\"","Ja, men funktionerna är till för att sälja mer – rabattkoder, kundkonton och nyhetsbrev betalar oftast snabbt tillbaka skillnaden."),
               ("\"Vi sköter marknadsföringen själva.\"","Perfekt – då ger Plus er verktygen som nyhetsbrev och rabattkoder, vilket gör ert arbete mer effektivt.")],
 avslut="Vill ni se hur den skulle fungera för ert sortiment?",
 pris="Från 35 000 kr uppstart + 2 490 kr/mån. Populärast.")

guide("E-handel Pro",
 nar="För stora sortiment och affärssystem som måste prata med butiken – enterprise-nivå.",
 krok="Har ni ett stort sortiment och system som behöver prata med butiken, som lager och ekonomi?",
 fragor=["Hur många produkter och vilka system använder ni?","Säljer ni B2B med kundunika priser?","Behöver ni flera språk eller valutor?"],
 problem="När ni säljer på riktigt är flaskhalsen sällan butiken utan allt manuellt arbete runtomkring.",
 losning="Enterprise-e-handel med obegränsat sortiment, ERP-integration, B2B-priser och lager i realtid.",
 resultat="En butik som skalar med er i stället för att bromsa er.",
 ingar=["Obegränsat antal produkter","ERP-integration (Fortnox/Visma)","B2B-priser och lagersaldo i realtid","Flera språk och valutor","Prioriterad support med SLA"],
 varde="Från 59 000 kr i uppstart och 4 900 kr/mån får ni en e-handel som tar bort det manuella arbetet och skalar utan att bromsa.",
 invandningar=[("\"Vi har redan ett affärssystem.\"","Perfekt – vi integrerar mot det (Fortnox, Visma med flera) så att order, lager och fakturor synkar automatiskt."),
               ("\"Det är en stor investering.\"","Det är det. Men för ett stort sortiment betalar den sparade tiden och de automatiska flödena snabbt tillbaka.")],
 avslut="Vilka system behöver butiken koppla mot? Ska vi kartlägga det tillsammans?",
 pris="Från 59 000 kr uppstart + 4 900 kr/mån.")

guide("Startpaket (Hemsida + SEO)",
 nar="För kunder som både vill synas och ha en sajt som konverterar – från dag ett.",
 krok="Vill ni både ha en sajt som konverterar och en motor som drar in trafik – från dag ett?",
 fragor=["Har ni en sajt idag, och rankar den?","Hur viktigt är det att börja synas snabbt?","Vad är målet de närmaste sex månaderna?"],
 problem="En snygg sajt utan besökare är en tyst butik. Trafik utan en säljande sajt är hinkar med hål.",
 losning="Startpaketet kombinerar en företagshemsida med löpande SEO till ett rabatterat pris.",
 resultat="Hela grunden på plats: en sajt som konverterar och en motor som drar in trafik varje månad.",
 ingar=["Företagshemsida (upp till sju sidor, eget CMS)","On-page SEO och Google Analytics","Löpande SEO med nyckelord och rapport","Rabatterat kombinationspris"],
 varde="För 18 000 kr plus 3 900 kr/mån får ni både sajten och trafiken – ett naturligt första steg för den som vill växa digitalt.",
 invandningar=[("\"Kan vi inte ta sajten först och SEO sen?\"","Ni kan, men då tappar ni de första månaderna. Att starta SEO direkt gör att trafiken börjar byggas medan sajten är ny."),
               ("\"Det blir en månadskostnad.\"","Ja, men det är den som gör att sajten faktiskt drar in kunder. En sajt utan trafik kostar er mer i uteblivna affärer.")],
 avslut="Ska jag räkna på Startpaketet för er?",
 pris="18 000 kr + 3 900 kr/mån.")

guide("Tillväxtpaket",
 nar="För företag som vill accelerera på allvar och ta marknadsandelar snabbt.",
 krok="Vill ni inte bara synas, utan ta marknadsandelar snabbt på både Google och i AI-sök?",
 fragor=["Hur aggressivt vill ni växa det närmaste året?","Vilka kanaler använder ni idag?","Vad skulle hända om ni fick dubbelt så många förfrågningar?"],
 problem="Att göra en sak i taget räcker inte när ni vill ta marknadsandelar – det är helheten som vinner.",
 losning="Tillväxtpaketet kombinerar en säljande hemsida, offensiv SEO och GEO i ett.",
 resultat="En komplett digital tillväxtmotor som vi optimerar löpande – ni dominerar både Google och AI-sök.",
 ingar=["Säljande företagshemsida","Offensiv SEO (content, länkar, teknik)","GEO / AI-synlighet","Löpande optimering och rapport"],
 varde="Från 25 000 kr plus 14 900 kr/mån får ni en motor som tar marknadsandelar medan konkurrenterna gör en kanal i taget.",
 invandningar=[("\"Det är en stor månadskostnad.\"","Det är ett offensivt paket för den som menar allvar. Sätt det mot vad marknadsandelar och fler kunder är värda – det är en tillväxtinvestering, inte en kostnad."),
               ("\"Kan vi börja mindre?\"","Absolut – då börjar vi med Startpaketet och växlar upp till Tillväxt när ni vill accelerera.")],
 avslut="Vill ni se en konkret plan för de kommande tre månaderna?",
 pris="Från 25 000 kr + 14 900 kr/mån.")

guide("MVP-paket (MVP + Designpartner)",
 nar="För startups som bygger en ny produkt och vill ha både utveckling och design i ett team.",
 krok="Bygger ni en ny produkt och vill ha både utveckling och löpande design – utan att kompromissa med intrycket?",
 fragor=["Vad är produktidén?","Hur viktigt är design och intryck för er målgrupp?","Hur snabbt vill ni röra er?"],
 problem="En produkt som funkar men ser billig ut tappar kunder och investerare. En snygg produkt som inte funkar gör samma sak.",
 losning="MVP-paketet kombinerar en MVP med en löpande designpartner – produkt och design i ett.",
 resultat="En fungerande produkt och kontinuerlig design som förfinar den vidare, till ett rabatterat designpris.",
 ingar=["MVP med kärnfunktioner","Löpande designpartner (UI/UX)","Rabatterat designpris","Ett team för både bygge och design"],
 varde="Från 29 000 kr plus 7 000 kr/mån får ni både en produkt och en design som utvecklar den – perfekt för startups som vill röra sig snabbt.",
 invandningar=[("\"Räcker det inte med bara MVP först?\"","Det kan räcka, men design från start gör att ni vågar visa produkten för kunder och investerare tidigare – och då lär ni er snabbare."),
               ("\"Vi har en egen designer.\"","Toppen – då kan vi fokusera på bygget. Men många startups upptäcker att löpande design utan att anställa är en stor avlastning.")],
 avslut="Berätta om er idé, så visar jag hur vi kommer igång redan denna månad.",
 pris="Från 29 000 kr + 7 000 kr/mån.")

guide("Full digital närvaro",
 nar="För kunder som vill ha en partner som tar helhetsansvar för deras digitala närvaro.",
 krok="Vill ni ha en partner som tar helhetsansvar för det digitala, så ni kan fokusera på er verksamhet?",
 fragor=["Hur många leverantörer har ni för det digitala idag?","Vad tar mest tid och energi?","Vad skulle det vara värt att ha allt på ett ställe?"],
 problem="Att jonglera tio leverantörer för sajt, SEO, GEO och design stjäl tid ni hellre lägger på era kunder.",
 losning="Full digital närvaro samlar hemsida eller app, SEO, GEO och design under ett tak, med en dedikerad kontaktperson.",
 resultat="Ni fokuserar på det ni är bäst på – vi äger det digitala och får det att leverera.",
 ingar=["Hemsida eller app","SEO och GEO","Design","En dedikerad kontaktperson","Skräddarsydd offert efter era mål"],
 varde="Ni får allt på ett ställe och en partner som kan er verksamhet – i stället för att lägga tid på att samordna leverantörer.",
 invandningar=[("\"Vad kostar det?\"","Det beror på vad ni behöver – vi tar fram en skräddarsydd offert utifrån era mål, så ni betalar för rätt saker."),
               ("\"Vi har redan leverantörer.\"","Då kan vi ta över delar i taget, eller komplettera där det saknas. Poängen är att ni får en partner som ser helheten.")],
 avslut="Ska vi boka ett möte och kartlägga era behov?",
 pris="Skräddarsydd offert utifrån era mål.")

# ── Emit: rename Säljpitch -> Säljguide and replace Swedish body ─────────────
parts = []
for g in GUIDES:
    pkg = g["pkg"]
    parts.append(f"""UPDATE public.training_items ti
SET title = {slit('Säljguide: ' + pkg)},
    body = {jbody(g)}
FROM public.training_categories cat
WHERE ti.category_id = cat.id AND cat.slug = 'saljmanus'
  AND ti.title = {slit('Säljpitch: ' + pkg)};""")

sql = ("-- Rebuild the 17 sales pitches as deep 'Säljguide' playbooks (Swedish body).\n"
       "-- Renames 'Säljpitch: X' to 'Säljguide: X'. en/es translations follow.\n\n"
       + "\n\n".join(parts) + "\n")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

import re
for d in re.findall(r"\$j\$(.*?)\$j\$", sql, re.S):
    json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(GUIDES), "guides")
