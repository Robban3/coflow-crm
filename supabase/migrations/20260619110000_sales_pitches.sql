-- Seed sales pitches as training_items under the "Säljmanus" category.
-- The pitch text (paragraphs separated by a blank line) is converted to a
-- TipTap doc on the fly. Skips any pitch whose title already exists.
INSERT INTO public.training_items (category_id, title, body, sort_order, is_published)
SELECT cat.id, v.title, body.doc, v.ord, true
FROM (VALUES
  ('Säljpitch: Landningssida',
   E'Vill ni testa en idé, dra igång en kampanj eller fånga leads snabbt? Då är en landningssida den smartaste starten – en enda vass sida byggd för att konvertera.\n\nNi får en mobilanpassad sida med tydligt budskap, kontaktformulär och grundläggande SEO, levererad snabbt och till låg tröskel (från 9 000 kr). Perfekt för att komma igång idag och bygga vidare när det ger resultat. Ska vi sätta upp er första sida?',
   1),
  ('Säljpitch: Företagshemsida',
   E'Er hemsida är första intrycket – och det avgör om kunden stannar eller klickar vidare. Vår företagshemsida ger er en professionell, snabb och säljande sajt ni är stolta över.\n\nUpp till sju sidor, eget CMS så ni uppdaterar själva, responsiv design, on-page SEO och Google Analytics – allt för 18 000 kr. Det är vårt populäraste paket. Vill ni att jag visar exempel och tar fram ett förslag?',
   2),
  ('Säljpitch: MVP',
   E'Har ni en produktidé men vill inte lägga hundratusentals kronor innan ni vet att den funkar? Bygg en MVP – en funktionell första version som validerar idén med riktiga användare.\n\nFrån 29 000 kr levererar vi en fungerande MVP med kärnfunktionerna på 4–6 veckor, och ni äger källkoden. Det är det snabbaste sättet att gå från idé till något ni kan visa kunder och investerare. Ska vi skissa på er MVP?',
   3),
  ('Säljpitch: Webbapp',
   E'När en hemsida inte räcker och ni behöver verklig funktionalitet – inloggning, data, automatik – då bygger vi en skräddarsydd webbapp som löser just ert problem.\n\nFrån 49 000 kr får ni roller och behörigheter, databas, adminpanel och en skalbar arkitektur som växer med er. Berätta om er process, så visar jag hur vi kan automatisera den.',
   4),
  ('Säljpitch: Mobilapp',
   E'Vill ni finnas i kundens ficka? Vi bygger appar för både iOS och Android från samma kodbas – snabbare och mer kostnadseffektivt än två separata appar.\n\nFrån 79 000 kr ingår utveckling, push-notiser, backend och publicering i App Store och Google Play. Vi tar hela resan från idé till lansering. Vad vill ni att appen ska göra för era kunder?',
   5),
  ('Säljpitch: SEO Start',
   E'Era kunder googlar redan efter det ni erbjuder – frågan är om de hittar er eller konkurrenten. Med SEO Start lägger vi grunden för att synas högre.\n\nFrån 4 900 kr/mån får ni on-page-optimering, nyckelordsanalys och en tydlig månadsrapport så ni ser utvecklingen svart på vitt. Det är en låg insats som börjar bygga långsiktig, gratis trafik. Ska vi börja med en snabb synlighetsanalys?',
   6),
  ('Säljpitch: SEO Tillväxt',
   E'Vill ni ta er förbi konkurrenterna och äga era viktigaste sökord? SEO Tillväxt är vårt offensiva paket för er som menar allvar.\n\nFrån 9 900 kr/mån jobbar vi löpande med innehåll, länkbygge och teknisk SEO – allt mätbart och rapporterat. Varje månad flyttar vi fram positionerna och fler kvalificerade kunder hittar er. Får jag visa var ni rankar idag och vart vi kan ta er?',
   7),
  ('Säljpitch: GEO / AI-synlighet',
   E'Allt fler söker numera i ChatGPT och Perplexity istället för Google – syns ni inte där tappar ni morgondagens kunder. GEO handlar om att bli rekommenderad av AI:n.\n\nFrån 6 900 kr/mån gör vi en GEO-analys, en konkret åtgärdsplan och följer upp er AI-synlighet löpande. Vi är tidigt ute på en kanal era konkurrenter ännu inte tänkt på. Vill ni se hur AI beskriver ert företag just nu?',
   8),
  ('Säljpitch: Designpartner',
   E'Behöver ni design löpande men har inte råd – eller behov – av en heltidsanställd designer? Bli designpartner och få en hel designavdelning på abonnemang.\n\nFrån 9 000 kr/mån får ni UI/UX och grafiskt material, prioriterad tillgång och en kö där ni skickar in förfrågningar i er egen takt. Förutsägbar kostnad, ingen rekrytering. Vad har ni för designbehov de närmaste månaderna?',
   9),
  ('Säljpitch: Logotyp & varumärke',
   E'Ett starkt varumärke gör att ni kan ta bättre betalt och bli ihågkomna. Vi tar fram en logotyp och identitet som känns rätt och håller över tid.\n\nFrån 12 000 kr ingår logotyp, färger, typsnitt och en brandguide så att allt ni gör ser enhetligt och professionellt ut. Hur vill ni att kunderna ska uppfatta er?',
   10),
  ('Säljpitch: E-handel Start',
   E'Vill ni börja sälja online utan en stor investering? E-handel Start ger er en komplett butik på vår egen plattform, snabbt och prisvärt.\n\nFrån 19 000 kr i uppstart och 1 490 kr/mån får ni eget CMS, betalning med Klarna eller Stripe, frakt, mobilanpassning och plats för upp till hundra produkter. Kom igång nu och uppgradera när försäljningen växer. Ska vi sätta upp er butik?',
   11),
  ('Säljpitch: E-handel Plus',
   E'Har ni en butik som börjar växa och behöver mer kraft? E-handel Plus är vårt populäraste e-handelspaket, byggt för att sälja mer.\n\nFrån 35 000 kr i uppstart och 2 490 kr/mån får ni upp till tusen produkter, flera betalningslösningar, rabattkoder, kundkonton, nyhetsbrev och on-page SEO. Allt på vår egen plattform som vi sköter åt er. Vill ni se hur den skulle fungera för ert sortiment?',
   12),
  ('Säljpitch: E-handel Pro',
   E'Stort sortiment och affärssystem som måste prata med butiken? E-handel Pro är vår enterprise-nivå för er som säljer på riktigt.\n\nFrån 59 000 kr i uppstart och 4 900 kr/mån får ni obegränsat antal produkter, ERP-integration mot Fortnox eller Visma, B2B-priser, lagersaldo, flera språk och valutor samt prioriterad support. Vi bygger en e-handel som skalar med er. Vilka system behöver den koppla mot?',
   13),
  ('Säljpitch: Startpaket (Hemsida + SEO)',
   E'Vill ni både synas och ha en sajt som konverterar – från dag ett? Startpaketet kombinerar en företagshemsida med löpande SEO till ett rabatterat pris.\n\nFör 18 000 kr plus 3 900 kr/mån får ni hela grunden på plats: en säljande hemsida och en motor som drar in trafik varje månad. Ett naturligt första steg för den som vill växa digitalt. Ska jag räkna på det för er?',
   14),
  ('Säljpitch: Tillväxtpaket',
   E'För er som vill accelerera på allvar kombinerar Tillväxtpaketet hemsida, offensiv SEO och GEO i ett – så ni syns både på Google och i AI-sök.\n\nFrån 25 000 kr plus 14 900 kr/mån får ni en komplett digital tillväxtmotor som vi optimerar löpande. Det är paketet för den som vill ta marknadsandelar snabbt. Vill ni se en plan för de kommande tre månaderna?',
   15),
  ('Säljpitch: MVP-paket (MVP + Designpartner)',
   E'Bygger ni en ny produkt och vill ha både utveckling och design i ett team? MVP-paketet kombinerar en MVP med en löpande designpartner.\n\nFrån 29 000 kr plus 7 000 kr/mån får ni en fungerande produkt och kontinuerlig design som utvecklar den vidare – till ett rabatterat designpris. Perfekt för startups som vill röra sig snabbt. Berätta om er idé, så visar jag hur vi kommer igång.',
   16),
  ('Säljpitch: Full digital närvaro',
   E'Vill ni ha en partner som tar helhetsansvar för er digitala närvaro? Full digital närvaro samlar hemsida eller app, SEO, GEO och design under ett tak.\n\nNi får en dedikerad kontaktperson och allt på ett ställe – vi tar fram en skräddarsydd offert utifrån era mål. Det är upplägget för den som vill fokusera på sin verksamhet och låta oss sköta det digitala. Ska vi boka ett möte och kartlägga era behov?',
   17)
) AS v(title, pitch, ord)
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
WHERE NOT EXISTS (
  SELECT 1 FROM public.training_items ti
  WHERE ti.category_id = cat.id AND ti.title = v.title
);
