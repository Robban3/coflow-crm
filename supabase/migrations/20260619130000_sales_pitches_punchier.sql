-- Rewrite the Säljpitch items with more persuasive, trust-building copy that
-- creates real desire ("jag måste ha detta!"). Matches existing items by title
-- under the "Säljmanus" category and replaces the body (TipTap doc built on the
-- fly from blank-line-separated paragraphs).
UPDATE public.training_items ti
SET body = body.doc, is_published = true
FROM (VALUES
  ('Säljpitch: Landningssida',
   E'Tänk dig att varje annonskrona faktiskt landar någonstans som säljer. En landningssida är just det – en enda knivskarp sida byggd med ett enda mål: att förvandla besökare till kunder.\n\nNi får en blixtsnabb, mobilanpassad sida med ett budskap som träffar rätt, ett formulär som fångar varje lead och SEO i grunden. Från 9 000 kr är ni igång – ofta redan denna vecka.\n\nDe flesta missar affärer för att de skickar trafik till en rörig sajt. Det gör inte ni. Ska vi sätta upp er första sida och börja fånga leads direkt?',
   1),
  ('Säljpitch: Företagshemsida',
   E'Era kunder bestämmer sig på tre sekunder. En långsam eller daterad sajt får dem att klicka vidare till konkurrenten – för alltid. Det är affärer ni aldrig ens får veta att ni förlorade.\n\nVår företagshemsida ger er motsatsen: en snabb, snygg och säljande sajt ni är stolta över att skicka folk till. Upp till sju sidor, eget CMS så ni uppdaterar själva, responsiv design, on-page SEO och Google Analytics – allt för 18 000 kr.\n\nDet är vårt populäraste paket, och det är ingen slump. Vill ni att jag visar exempel och tar fram ett förslag på er nya sajt?',
   2),
  ('Säljpitch: MVP',
   E'Den största risken med en ny produkt är inte att bygga fel – det är att lägga ett halvår och hundratusentals kronor innan ni vet om någon ens vill ha den.\n\nMed en MVP vänder vi på det. Vi bygger en skarp första version med kärnfunktionerna på 4–6 veckor, från 29 000 kr, och ni äger källkoden. Plötsligt har ni något riktigt att visa kunder och investerare – inte en pitch, utan en produkt.\n\nDe snabbaste bolagen vinner för att de lär sig av verkligheten först. Ska vi skissa på er MVP redan nu?',
   3),
  ('Säljpitch: Webbapp',
   E'När en vanlig hemsida inte räcker sitter ni ofta fast i manuellt arbete, kalkylark och dubbeljobb. Tänk om systemet gjorde det åt er istället.\n\nVi bygger en skräddarsydd webbapp som löser exakt ert problem – inloggning, roller, databas, adminpanel och en arkitektur som växer med er, från 49 000 kr. Det är skillnaden mellan att jaga processen och att äga den.\n\nBerätta hur ni jobbar idag, så visar jag konkret vad vi kan automatisera bort. Hur mycket tid skulle ni vinna varje vecka?',
   4),
  ('Säljpitch: Mobilapp',
   E'Det finns ingen mer värdefull plats än kundens ficka. En egen app betyder att ni finns ett tryck bort – med push-notiser som tar er rakt in i deras vardag, om och om igen.\n\nVi bygger för både iOS och Android från samma kodbas – snabbare och billigare än två separata appar. Från 79 000 kr ingår utveckling, push, backend och publicering i App Store och Google Play. Vi tar hela resan från idé till lansering.\n\nTänk er era kunder med er logga på hemskärmen. Vad ska appen göra för dem – och för er återkommande försäljning?',
   5),
  ('Säljpitch: SEO Start',
   E'Just nu googlar någon efter exakt det ni säljer. Frågan är bara obekväm: hittar de er, eller konkurrenten? Varje dag på sida två är kunder ni ger bort gratis.\n\nMed SEO Start lägger vi grunden för att vända det. Från 4 900 kr/mån får ni on-page-optimering, nyckelordsanalys och en tydlig månadsrapport där ni ser kurvan peka uppåt – svart på vitt.\n\nDet bästa? Trafiken ni bygger kostar inget per klick och försvinner inte när ni slutar annonsera. Ska vi börja med en snabb synlighetsanalys så ni ser var ni står idag?',
   6),
  ('Säljpitch: SEO Tillväxt',
   E'Topplaceringarna på Google är inte gratis – men de är inte heller upptagna av en slump. Någon jobbar för dem varje månad. Med SEO Tillväxt är det ni.\n\nFrån 9 900 kr/mån driver vi innehåll, länkbygge och teknisk SEO offensivt och mätbart. Position för position tar vi era viktigaste sökord, och fler kvalificerade kunder hittar er – medan konkurrenten undrar vad som hände.\n\nDet här är paketet för er som menar allvar med att växa. Får jag visa var ni rankar idag och exakt vart vi kan ta er?',
   7),
  ('Säljpitch: GEO / AI-synlighet',
   E'Era kunder har redan börjat fråga ChatGPT och Perplexity istället för att googla. Och här är det obehagliga: om AI:n inte nämner er, finns ni helt enkelt inte i det samtalet. Ingen andra chans, inget annonsutrymme.\n\nGEO handlar om att bli den AI:n rekommenderar. Från 6 900 kr/mån gör vi en GEO-analys, en konkret åtgärdsplan och följer er AI-synlighet löpande – på en kanal era konkurrenter ännu inte ens tänkt på.\n\nDet här är försprånget som bara finns att ta just nu. Vill ni se hur AI beskriver ert företag idag – innan någon annan tar platsen?',
   8),
  ('Säljpitch: Designpartner',
   E'Bra design får er att se ut som marknadsledaren – och låter er ta marknadsledarens priser. Men en heltidsdesigner är dyr, och frilansare försvinner mitt i ett projekt.\n\nSom designpartner får ni en hel designavdelning på abonnemang. Från 9 000 kr/mån: UI/UX och grafiskt material, prioriterad tillgång och en kö där ni skickar in förfrågningar i er egen takt. Förutsägbar kostnad, noll rekrytering, alltid någon redo.\n\nFöreställ er att aldrig mer fastna för att ni saknar en designer. Vad har ni för designbehov de närmaste månaderna?',
   9),
  ('Säljpitch: Logotyp & varumärke',
   E'Ett starkt varumärke gör två saker samtidigt: kunderna kommer ihåg er, och de är beredda att betala mer. Ett svagt varumärke gör tvärtom – ni blir en i mängden som måste konkurrera med pris.\n\nVi tar fram en logotyp och identitet som känns rätt och håller i åratal. Från 12 000 kr ingår logotyp, färger, typsnitt och en brandguide så att allt ni gör ser enhetligt och proffsigt ut – på sajten, i sociala medier, på fakturan.\n\nFörsta intrycket sker bara en gång. Hur vill ni att kunderna ska uppfatta er?',
   10),
  ('Säljpitch: E-handel Start',
   E'Tänk dig din butik öppen dygnet runt, som tar betalt medan du sover. Att börja sälja online behöver varken vara dyrt eller krångligt – och ni behöver inte vänta.\n\nE-handel Start ger er en komplett butik på vår egen plattform. Från 19 000 kr i uppstart och 1 490 kr/mån: eget CMS, betalning med Klarna eller Stripe, frakt, mobilanpassning och plats för upp till hundra produkter.\n\nNi kommer igång nu och uppgraderar i takt med att försäljningen växer. Ska vi sätta upp er butik och få den första ordern att ticka in?',
   11),
  ('Säljpitch: E-handel Plus',
   E'En butik som börjar sälja men inte kan växa blir snabbt en flaskhals. E-handel Plus är byggt för nästa nivå – fler produkter, fler köp, mer automatik.\n\nVårt populäraste e-handelspaket: från 35 000 kr i uppstart och 2 490 kr/mån får ni upp till tusen produkter, flera betalningslösningar, rabattkoder, kundkonton, nyhetsbrev och on-page SEO. Allt på vår egen plattform som vi sköter åt er.\n\nVarje funktion är till för att höja ert snittköp och få kunderna att komma tillbaka. Vill ni se hur den skulle fungera för ert sortiment?',
   12),
  ('Säljpitch: E-handel Pro',
   E'När ni säljer på riktigt blir flaskhalsen sällan butiken – det är allt manuellt arbete runtomkring. Order som skrivs in för hand, lager som inte stämmer, system som inte pratar med varandra.\n\nE-handel Pro är vår enterprise-nivå. Från 59 000 kr i uppstart och 4 900 kr/mån: obegränsat antal produkter, ERP-integration mot Fortnox eller Visma, B2B-priser, lagersaldo i realtid, flera språk och valutor samt prioriterad support.\n\nVi bygger en e-handel som skalar med er istället för att bromsa er. Vilka system behöver den koppla mot?',
   13),
  ('Säljpitch: Startpaket (Hemsida + SEO)',
   E'En snygg sajt utan besökare är en tyst butik. Trafik utan en säljande sajt är hinkar med hål. Ni behöver båda – från dag ett.\n\nStartpaketet kombinerar en företagshemsida med löpande SEO till ett rabatterat pris: 18 000 kr plus 3 900 kr/mån. Ni får hela grunden på plats – en sajt som konverterar och en motor som drar in trafik varje månad.\n\nDet är det självklara första steget för den som vill växa digitalt på riktigt. Ska jag räkna på det för er?',
   14),
  ('Säljpitch: Tillväxtpaket',
   E'Vill ni inte bara synas utan ta marknadsandelar? Då räcker det inte att göra en sak bra – det är helheten som vinner. Tillväxtpaketet ger er hela motorn.\n\nFrån 25 000 kr plus 14 900 kr/mån kombinerar vi en säljande hemsida, offensiv SEO och GEO i ett – så ni dominerar både Google och AI-söket medan konkurrenterna gör en kanal i taget.\n\nDet här är paketet för er som vill flytta fram positionerna snabbt och mätbart. Vill ni se en konkret plan för de kommande tre månaderna?',
   15),
  ('Säljpitch: MVP-paket (MVP + Designpartner)',
   E'En produkt som funkar men ser billig ut tappar både kunder och investerare. En snygg produkt som inte funkar gör samma sak. Vinnaren har båda – från start.\n\nMVP-paketet kombinerar en MVP med en löpande designpartner. Från 29 000 kr plus 7 000 kr/mån får ni en fungerande produkt och kontinuerlig design som förfinar den vidare – till ett rabatterat designpris.\n\nDet är upplägget för startups som vill röra sig snabbt utan att kompromissa med intrycket. Berätta om er idé, så visar jag hur vi kommer igång redan denna månad.',
   16),
  ('Säljpitch: Full digital närvaro',
   E'Det digitala är inte längre en sak ni gör vid sidan av – det är där affären avgörs. Men att jonglera tio olika leverantörer för sajt, SEO, GEO och design stjäl tid ni hellre lägger på era kunder.\n\nFull digital närvaro samlar allt under ett tak: hemsida eller app, SEO, GEO och design, med en dedikerad kontaktperson som kan er verksamhet. Vi tar fram en skräddarsydd offert utifrån era mål.\n\nNi fokuserar på det ni är bäst på – vi äger det digitala och får det att leverera. Ska vi boka ett möte och kartlägga er fulla potential?',
   17)
) AS v(title, pitch)
CROSS JOIN LATERAL (
  SELECT jsonb_build_object(
    'type','doc',
    'content', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'type','paragraph',
        'content', jsonb_build_array(jsonb_build_object('type','text','text', trim(para)))
      ))
      FROM unnest(string_to_array(v.pitch, E'\n\n')) AS para
      WHERE length(trim(para)) > 0
    ), '[]'::jsonb)
  ) AS doc
) body
JOIN public.training_categories cat ON cat.slug = 'saljmanus'
WHERE ti.category_id = cat.id AND ti.title = v.title;
