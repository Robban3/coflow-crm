-- More Säljmanus content: cold-call & first-meeting scripts + objection handling.
INSERT INTO public.training_items (category_id, title, body, sort_order, is_published)
SELECT cat.id, v.title, body.doc, v.ord, true
FROM (VALUES
  ('Manus: Kallt samtal',
   E'Öppning: Hej [namn], det är [ditt namn] från Applabbet. Jag ringer kort och vet att jag stör mitt i något – har du 30 sekunder så berättar jag varför jag ringer, så får du säga om det är intressant?\n\nKrok: Vi hjälper företag som er att få fler kunder via hemsida, SEO och AI-synlighet. Jag såg att [konkret observation om deras sajt eller bransch] och tänkte att det kan finnas en del att hämta för er.\n\nKvalificera: Hur jobbar ni med att få in nya kunder digitalt idag?\n\nMål – boka möte: Det här tar vi bäst på ett kort videomöte där jag visar konkret vad vi ser. Passar tisdag klockan 10 eller torsdag klockan 14?\n\nKom ihåg: Målet med samtalet är inte att sälja – det är att boka mötet. Var kort, nyfiken och lyssna mer än du pratar.',
   18),
  ('Manus: Första mötet',
   E'1. Bygg relation: Tacka för tiden, småprata kort och sätt agendan. Jag tänkte vi börjar med att jag lär känna er verksamhet, sen visar jag hur vi kan hjälpa, och så ser vi om det är en bra match. Låter det bra?\n\n2. Behovsanalys – lägg mest tid här: Ställ öppna frågor och lyssna. Vad är era mål det närmaste året? Hur får ni kunder idag? Vad fungerar och vad skaver? Vad skulle hända om ni fick dubbelt så många förfrågningar?\n\n3. Pitch – koppla till deras svar: Presentera bara det som löser det de berättade. Du sa att det här var er största utmaning – det är precis vad det här paketet löser.\n\n4. Hantera invändningar: Bekräfta, vänd till värde och ställ en fråga. Se invändningshanteringen.\n\n5. Avslut: Föreslå nästa steg konkret. Jag tar fram ett förslag och en offert till på fredag, så går vi igenom den tillsammans. Passar det? Boka tiden direkt innan ni avslutar.',
   19),
  ('Invändning: Det är för dyrt',
   E'När någon säger att det är för dyrt menar de oftast att de inte ser värdet än – inte att pengarna saknas. Bekräfta och vänd samtalet till avkastning.\n\nSvar: Jag förstår, det är en investering. Får jag fråga – vad är en ny kund värd för er? Drar sajten in bara någon extra kund i månaden har den betalat sig själv. Vi kan också börja i en mindre nivå och bygga vidare när det ger resultat.\n\nFråga: Vad skulle behöva hända för att det här skulle kännas som en självklar investering?',
   20),
  ('Invändning: Vi har redan en hemsida',
   E'Att de har en hemsida är bra – det betyder att de förstår värdet. Frågan är om den presterar.\n\nSvar: Vad bra, då har ni redan grunden. Får jag fråga – hur många kunder eller leads drar den in i månaden? Många hemsidor är snygga broschyrer men säljer inte. Vi kan göra en snabb analys och visa exakt var ni tappar besökare.\n\nFråga: Ska jag köra en kostnadsfri analys av er nuvarande sajt så får ni se hur den står sig?',
   21),
  ('Invändning: Vi gör det själva internt',
   E'Respektera kompetensen, men peka på tid och alternativkostnad.\n\nSvar: Det är starkt att ni har kompetensen internt. Frågan är om det är där ni tjänar mest pengar – varje timme på hemsidan eller SEO är en timme bort från er kärnverksamhet. Vi gör det snabbare så att ni kan fokusera på det ni är bäst på.\n\nFråga: Vad skulle ni hellre lägga de timmarna på?',
   22),
  ('Invändning: Vi har ingen tid just nu',
   E'Tidsbrist är ofta en prioriteringsfråga. Gör det enkelt och lågtröskligt.\n\nSvar: Just därför är vi en bra partner – vi sköter i princip allt åt er, ni behöver bara en kort avstämning. Och bästa läget att bygga synlighet är innan ni behöver den. Ska vi boka 20 minuter nästa vecka, helt förutsättningslöst?\n\nFråga: Vilken dag passar bäst – tisdag eller torsdag?',
   23),
  ('Invändning: Skicka information så återkommer vi',
   E'Den klassiska artiga avfärdningen. Behåll initiativet utan att vara påträngande.\n\nSvar: Absolut, jag skickar gärna. För att det ska bli relevant – vad är viktigast för er just nu: fler kunder, en modernare sajt eller bättre synlighet? Då skickar jag exempel som passar er, och så stämmer vi av kort senare i veckan.\n\nFråga: Passar en kort återkoppling på fredag?',
   24),
  ('Invändning: Vi är nöjda med vår nuvarande leverantör',
   E'Attackera aldrig konkurrenten. Så ett frö och håll dörren öppen.\n\nSvar: Vad bra att ni har någon ni trivs med – det är värdefullt. Vi behöver inte ersätta dem. Många kunder använder oss som komplement för till exempel SEO eller GEO som ofta saknas. Får jag visa vad ni skulle kunna lägga till?\n\nFråga: Vad gör er nuvarande leverantör riktigt bra – och vad saknar ni?',
   25),
  ('Invändning: Funkar SEO och GEO verkligen?',
   E'Skepsis bemöts med konkreta exempel och mätbarhet.\n\nSvar: Helt rätt att vara kritisk, det finns mycket tomma löften i branschen. Skillnaden är att vi mäter allt – ni ser ranking, trafik och leads svart på vitt varje månad. Och GEO är nytt: era konkurrenter syns ännu inte i ChatGPT, vilket är ert försprång.\n\nFråga: Ska jag visa hur ni rankar idag och vad som är möjligt på tre månader?',
   26),
  ('Invändning: Vi måste tänka på det',
   E'Ett mjukt nej döljer ofta en oklarhet. Ta reda på vad som hindrar.\n\nSvar: Självklart, klokt att inte rusa. Får jag fråga – är det priset, tajmingen eller något annat ni vill fundera på? Då kan jag hjälpa er med just den biten istället för att ni sitter och grunnar själva.\n\nFråga: Vad är den största frågan som behöver besvaras för att ni ska känna er trygga?',
   27)
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
