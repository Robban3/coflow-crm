#!/usr/bin/env python3
"""Generate the Produktkunskap (product knowledge) seed migration (sv/en/es).
Bodies are TipTap docs with a bold label per section."""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260619200000_product_knowledge.sql")

def para(label, text):
    content = []
    if label:
        content.append({"type": "text", "marks": [{"type": "bold"}], "text": label + ": "})
    content.append({"type": "text", "text": text})
    return {"type": "paragraph", "content": content}

def doc(sections):
    return json.dumps({"type": "doc", "content": [para(l, t) for (l, t) in sections]},
                      ensure_ascii=False)

def jlit(sections):
    return "$j$" + doc(sections) + "$j$::jsonb"

def slit(s):
    return "'" + s.replace("'", "''") + "'"

# Labels per language, in fixed order used by the section tuples below.
L = {
 "sv": ["Vad det är","Passar för","Det här ingår","Leverans & pris","FAQ","Säljtips","Avgränsning"],
 "en": ["What it is","Who it's for","What's included","Delivery & price","FAQ","Sales tips","Scope"],
 "es": ["Qué es","Para quién","Qué incluye","Entrega y precio","Preguntas frecuentes","Consejos de venta","Alcance"],
}

# Each product: titles + per-language list of section texts (same order as L).
# Use None for a section to skip it. E-commerce overrides with custom sections.
PRODUCTS = []

def add(svt, ent, est, ordn, sv, en, es, custom=None):
    PRODUCTS.append(dict(svt=svt, ent=ent, est=est, ord=ordn, sv=sv, en=en, es=es, custom=custom))

# 1. Landningssida
add("Landningssida","Landing page","Página de aterrizaje",1,
 ["En enda fokuserad sida med ett mål – konvertera besökare till leads eller köp, utan distraherande meny.",
  "Kampanjer, produktlanseringar, annonstrafik (Google/Meta), event och idévalidering. Den som vill komma igång snabbt och billigt.",
  "1 mobilanpassad sida, skarpt budskap med tydlig CTA, lead-/kontaktformulär, grundläggande SEO och koppling till analys/pixel.",
  "Ofta inom en vecka. Från 9 000 kr.",
  "\"Kan den växa till en hemsida?\" Ja, bygg vidare. \"Funkar den med våra annonser?\" Ja, den är byggd för annonstrafik.",
  "Perfekt första affär – lågtröskel. Bevisa värde och merförsälj sedan hemsida eller SEO.",
  "En sida; behövs flera är det en företagshemsida."],
 ["A single focused page with one goal – converting visitors into leads or sales, with no distracting menu.",
  "Campaigns, product launches, ad traffic (Google/Meta), events and idea validation. For those who want to get going fast and cheaply.",
  "1 mobile-friendly page, a sharp message with a clear CTA, a lead/contact form, basic SEO and analytics/pixel tracking.",
  "Often within a week. From SEK 9,000.",
  "\"Can it grow into a website?\" Yes, build on it. \"Does it work with our ads?\" Yes, it's built for ad traffic.",
  "A perfect first deal – low threshold. Prove value, then upsell a website or SEO.",
  "One page; if they need several, it's a business website."],
 ["Una única página enfocada con un objetivo: convertir visitantes en leads o ventas, sin un menú que distraiga.",
  "Campañas, lanzamientos de producto, tráfico de anuncios (Google/Meta), eventos y validación de ideas. Para quien quiere arrancar rápido y barato.",
  "1 página adaptada a móvil, mensaje claro con CTA, formulario de lead/contacto, SEO básico y conexión con analítica/píxel.",
  "A menudo en una semana. Desde 9 000 SEK.",
  "\"¿Puede crecer hasta ser una web?\" Sí, se amplía. \"¿Funciona con nuestros anuncios?\" Sí, está hecha para tráfico de anuncios.",
  "Una primera venta perfecta: bajo compromiso. Demuestra valor y luego vende una web o SEO.",
  "Una página; si necesitan varias, es una web corporativa."])

# 2. MVP
add("MVP","MVP","MVP",2,
 ["En funktionell första version med bara kärnfunktionerna, byggd för att validera idén med riktiga användare.",
  "Startups och företag som vill testa en digital idé innan en stor investering och behöver något att visa kunder och investerare.",
  "Överenskomna kärnfunktioner, en fungerande produkt, kunden äger källkoden och allt byggs på en skalbar grund.",
  "4–6 veckor. Från 29 000 kr.",
  "\"Vad händer sen?\" Vi bygger vidare i iterationer. \"Äger vi koden?\" Ja. \"Vad ska ingå?\" Vi hjälper er prioritera kärnan.",
  "Sälj på riskreducering och fart – validera innan ni satsar stort. Kombinera gärna med Designpartner (MVP-paket).",
  "Medvetet avskalad – inte en fullskalig färdig produkt."],
 ["A functional first version with only the core features, built to validate the idea with real users.",
  "Startups and companies that want to test a digital idea before a big investment and need something to show customers and investors.",
  "Agreed core features, a working product, the customer owns the source code, and everything is built on a scalable foundation.",
  "4–6 weeks. From SEK 29,000.",
  "\"What happens next?\" We keep building in iterations. \"Do we own the code?\" Yes. \"What should be included?\" We help you prioritise the core.",
  "Sell on risk reduction and speed – validate before investing big. Combine it with a Design partner (MVP bundle).",
  "Deliberately stripped down – not a full-scale finished product."],
 ["Una primera versión funcional con solo las funciones esenciales, hecha para validar la idea con usuarios reales.",
  "Startups y empresas que quieren probar una idea digital antes de una gran inversión y necesitan algo que mostrar a clientes e inversores.",
  "Funciones esenciales acordadas, un producto funcional, el cliente es dueño del código y todo se construye sobre una base escalable.",
  "4–6 semanas. Desde 29 000 SEK.",
  "\"¿Qué pasa después?\" Seguimos construyendo por iteraciones. \"¿Somos dueños del código?\" Sí. \"¿Qué se incluye?\" Te ayudamos a priorizar lo esencial.",
  "Vende reducción de riesgo y rapidez: valida antes de invertir mucho. Combínalo con un Socio de diseño (paquete MVP).",
  "Deliberadamente reducido: no es un producto final a gran escala."])

# 3. Webbapp
add("Webbapp","Web app","Aplicación web",3,
 ["En skräddarsydd applikation i webbläsaren med verklig funktionalitet – inloggning, data och automatik.",
  "Interna processer, portaler, bokning, dashboards och SaaS. När en hemsida inte räcker.",
  "Roller och behörigheter, databas, adminpanel, skalbar arkitektur och anpassad funktionalitet.",
  "Offert efter behovsanalys. Från 49 000 kr.",
  "\"Kan den integreras med X?\" Ofta ja. \"Skalar den?\" Ja, den är byggd för det.",
  "Utgå från en process som skaver och räkna hem tid eller pengar.",
  "Inte en enkel hemsida; kräver en behovsanalys för exakt pris."],
 ["A custom application in the browser with real functionality – login, data and automation.",
  "Internal processes, portals, booking, dashboards and SaaS. When a website isn't enough.",
  "Roles and permissions, database, admin panel, scalable architecture and custom functionality.",
  "Quote after a needs analysis. From SEK 49,000.",
  "\"Can it integrate with X?\" Often yes. \"Does it scale?\" Yes, it's built for it.",
  "Start from a process that chafes and make the time or money savings add up.",
  "Not a simple website; needs a needs analysis for an exact price."],
 ["Una aplicación a medida en el navegador con funcionalidad real: inicio de sesión, datos y automatización.",
  "Procesos internos, portales, reservas, dashboards y SaaS. Cuando una web no basta.",
  "Roles y permisos, base de datos, panel de administración, arquitectura escalable y funcionalidad a medida.",
  "Presupuesto tras un análisis de necesidades. Desde 49 000 SEK.",
  "\"¿Se integra con X?\" A menudo sí. \"¿Escala?\" Sí, está hecha para ello.",
  "Parte de un proceso que molesta y haz que el ahorro de tiempo o dinero cuadre.",
  "No es una web sencilla; requiere un análisis de necesidades para un precio exacto."])

# 4. Mobilapp
add("Mobilapp","Mobile app","Aplicación móvil",4,
 ["En app för iOS och Android, byggd från samma kodbas.",
  "Tjänster som vill finnas i kundens ficka – återkommande användning, push-notiser och lojalitet.",
  "Utveckling för iOS och Android, push-notiser, backend och publicering i App Store och Google Play.",
  "Offert efter omfång. Från 79 000 kr.",
  "\"Två appar eller en?\" En kodbas, båda plattformarna – billigare. \"Sköter ni publicering?\" Ja, hela vägen.",
  "Sälj på återkommande kontakt (push) och närvaro i kundens vardag.",
  "App Store- och Google-konton samt deras avgifter ligger hos kunden."],
 ["An app for iOS and Android, built from the same codebase.",
  "Services that want to be in the customer's pocket – recurring use, push notifications and loyalty.",
  "Development for iOS and Android, push notifications, backend and publishing in the App Store and Google Play.",
  "Quote based on scope. From SEK 79,000.",
  "\"Two apps or one?\" One codebase, both platforms – cheaper. \"Do you handle publishing?\" Yes, all the way.",
  "Sell on recurring contact (push) and presence in the customer's daily life.",
  "App Store and Google accounts and their fees sit with the customer."],
 ["Una app para iOS y Android, construida desde la misma base de código.",
  "Servicios que quieren estar en el bolsillo del cliente: uso recurrente, notificaciones push y fidelización.",
  "Desarrollo para iOS y Android, notificaciones push, backend y publicación en App Store y Google Play.",
  "Presupuesto según alcance. Desde 79 000 SEK.",
  "\"¿Dos apps o una?\" Una base de código, ambas plataformas: más barato. \"¿Os encargáis de la publicación?\" Sí, de principio a fin.",
  "Vende el contacto recurrente (push) y la presencia en el día a día del cliente.",
  "Las cuentas de App Store y Google y sus tarifas corresponden al cliente."])

# 5. SEO Start
add("SEO Start","SEO Start","SEO Start",5,
 ["Ett instegspaket för att börja synas högre på Google.",
  "Den som har en sajt men inte rankar, har mindre budget och vill testa.",
  "On-page-optimering, nyckelordsanalys och en tydlig månadsrapport.",
  "Löpande, från 4 900 kr/mån.",
  "\"När syns resultat?\" Oftast 3–6 månader – SEO är långsiktigt. \"Garanterar ni plats 1?\" Nej, men vi mäter och flyttar fram positionerna.",
  "Långsiktig \"gratis\" trafik till låg insats. Naturlig uppföljning efter en levererad hemsida.",
  "Kräver en fungerande sajt att optimera."],
 ["An entry-level package to start ranking higher on Google.",
  "Those who have a site but don't rank, have a smaller budget and want to test the waters.",
  "On-page optimization, keyword analysis and a clear monthly report.",
  "Ongoing, from SEK 4,900/mo.",
  "\"When do results show?\" Usually 3–6 months – SEO is long-term. \"Do you guarantee position 1?\" No, but we measure and move the positions up.",
  "Long-term \"free\" traffic at a low investment. A natural follow-up after a delivered website.",
  "Requires a working site to optimize."],
 ["Un paquete inicial para empezar a posicionar más alto en Google.",
  "Quien tiene una web pero no posiciona, con menos presupuesto y ganas de probar.",
  "Optimización on-page, análisis de palabras clave y un informe mensual claro.",
  "Continuo, desde 4 900 SEK/mes.",
  "\"¿Cuándo se ven resultados?\" Normalmente 3–6 meses; el SEO es a largo plazo. \"¿Garantizáis el puesto 1?\" No, pero medimos y subimos las posiciones.",
  "Tráfico \"gratis\" a largo plazo con baja inversión. Seguimiento natural tras entregar una web.",
  "Requiere una web funcional que optimizar."])

# 6. SEO Tillväxt
add("SEO Tillväxt","SEO Growth","SEO Crecimiento",6,
 ["Ett offensivt SEO-paket för den som menar allvar.",
  "Företag som vill äga sina sökord och ta marknadsandelar.",
  "Allt i SEO Start plus löpande content, länkbygge och teknisk SEO.",
  "Löpande, från 9 900 kr/mån.",
  None,
  "För konkurrensutsatta branscher. Visa nuläget (ranking) och måla upp potentialen.",
  "Kräver löpande engagemang – inte en engångsinsats."],
 ["An offensive SEO package for those who are serious.",
  "Companies that want to own their keywords and take market share.",
  "Everything in SEO Start plus ongoing content, link building and technical SEO.",
  "Ongoing, from SEK 9,900/mo.",
  None,
  "For competitive industries. Show the current state (ranking) and paint the potential.",
  "Requires ongoing commitment – not a one-off effort."],
 ["Un paquete de SEO ofensivo para quien va en serio.",
  "Empresas que quieren dominar sus palabras clave y ganar cuota de mercado.",
  "Todo lo de SEO Start más contenido continuo, link building y SEO técnico.",
  "Continuo, desde 9 900 SEK/mes.",
  None,
  "Para sectores competitivos. Muestra la situación actual (ranking) y dibuja el potencial.",
  "Requiere compromiso continuo: no es una acción puntual."])

# 7. GEO
add("GEO / AI-synlighet","GEO / AI visibility","GEO / Visibilidad en IA",7,
 ["Att bli omnämnd och rekommenderad av AI-sök som ChatGPT och Perplexity.",
  "Framåtlutade företag som vill ligga före konkurrenterna i nästa sökkanal.",
  "En GEO-analys, en konkret åtgärdsplan och löpande uppföljning av AI-synligheten.",
  "Löpande, från 6 900 kr/mån.",
  "\"Är det inte för tidigt?\" Tvärtom – konkurrenterna syns inte än, och det är just det som är försprånget.",
  "Sälj på \"first mover\". Visa hur AI beskriver dem idag.",
  "Ett nytt område som mäts annorlunda än klassisk SEO."],
 ["Becoming mentioned and recommended by AI search like ChatGPT and Perplexity.",
  "Forward-leaning companies that want to stay ahead of competitors in the next search channel.",
  "A GEO analysis, a concrete action plan and ongoing tracking of AI visibility.",
  "Ongoing, from SEK 6,900/mo.",
  "\"Isn't it too early?\" Quite the opposite – competitors aren't showing up yet, and that's exactly the head start.",
  "Sell on being a first mover. Show how AI describes them today.",
  "A new area that's measured differently than classic SEO."],
 ["Ser mencionado y recomendado por buscadores de IA como ChatGPT y Perplexity.",
  "Empresas con visión de futuro que quieren adelantarse a la competencia en el próximo canal de búsqueda.",
  "Un análisis GEO, un plan de acción concreto y un seguimiento continuo de la visibilidad en IA.",
  "Continuo, desde 6 900 SEK/mes.",
  "\"¿No es demasiado pronto?\" Al contrario: los competidores aún no aparecen, y esa es justo la ventaja.",
  "Vende el ser el primero en mover ficha. Muestra cómo la IA los describe hoy.",
  "Un área nueva que se mide de forma distinta al SEO clásico."])

# 8. Designpartner
add("Designpartner","Design partner","Socio de diseño",8,
 ["En designavdelning på abonnemang – löpande UI/UX och grafiskt material.",
  "Företag med kontinuerligt designbehov som inte vill anställa en designer.",
  "UI/UX, grafiskt material, prioriterad tillgång och en kö där kunden skickar in förfrågningar i egen takt.",
  "Löpande, från 9 000 kr/mån.",
  "\"Hur många uppgifter får vi?\" En i taget i kön, i er egen takt.",
  "Sälj på förutsägbar kostnad och noll rekrytering.",
  "Ett abonnemang, inte enstaka projekt (då blir det offert)."],
 ["A design department on subscription – ongoing UI/UX and graphic material.",
  "Companies with continuous design needs that don't want to hire a designer.",
  "UI/UX, graphic material, priority access and a queue where the customer submits requests at their own pace.",
  "Ongoing, from SEK 9,000/mo.",
  "\"How many tasks do we get?\" One at a time in the queue, at your own pace.",
  "Sell on predictable cost and zero recruitment.",
  "A subscription, not one-off projects (those are quoted)."],
 ["Un departamento de diseño por suscripción: UI/UX y material gráfico continuos.",
  "Empresas con necesidades de diseño continuas que no quieren contratar a un diseñador.",
  "UI/UX, material gráfico, acceso prioritario y una cola donde el cliente envía solicitudes a su ritmo.",
  "Continuo, desde 9 000 SEK/mes.",
  "\"¿Cuántas tareas tenemos?\" Una a la vez en la cola, a vuestro ritmo.",
  "Vende coste predecible y cero contratación.",
  "Una suscripción, no proyectos puntuales (esos se presupuestan)."])

# 9. Logotyp & varumärke
add("Logotyp & varumärke","Logo & brand","Logotipo y marca",9,
 ["En visuell identitet – logotyp, färger, typsnitt och brandguide.",
  "Nya företag, ombranding och de som ser spretiga ut.",
  "Logotyp, färgpalett, typsnitt och en brandguide.",
  "Från 12 000 kr.",
  None,
  "Sälj på igenkänning och att kunna ta bättre betalt. En bra dörröppnare före en hemsida.",
  "En grafisk identitet, inte en hel hemsida."],
 ["A visual identity – logo, colors, typography and a brand guide.",
  "New companies, rebrands and those that look scattered.",
  "A logo, a color palette, typography and a brand guide.",
  "From SEK 12,000.",
  None,
  "Sell on recognition and being able to charge more. A great door-opener before a website.",
  "A graphic identity, not a whole website."],
 ["Una identidad visual: logotipo, colores, tipografía y guía de marca.",
  "Empresas nuevas, rebrandings y quienes se ven dispersos.",
  "Un logotipo, una paleta de colores, tipografía y una guía de marca.",
  "Desde 12 000 SEK.",
  None,
  "Vende reconocimiento y poder cobrar más. Un buen abrepuertas antes de una web.",
  "Una identidad gráfica, no una web completa."])

# 10. E-handel (custom sections incl. tiers)
ECOM_SV = [
 ("Vad det är","En webbutik på vår egen plattform med eget CMS, i tre nivåer."),
 ("Passar för","Företag som vill sälja produkter online – nivå efter sortiment och behov."),
 ("Start","Från 19 000 kr + 1 490 kr/mån: ~100 produkter, Klarna/Stripe, frakt, mobilanpassning och grundläggande SEO."),
 ("Plus","Från 35 000 kr + 2 490 kr/mån: ~1 000 produkter, rabattkoder, kundkonton, nyhetsbrev och on-page SEO. Populärast."),
 ("Pro","Från 59 000 kr + 4 900 kr/mån: obegränsat antal produkter, ERP-integration (Fortnox/Visma), B2B-priser, lager i realtid, flera språk och valutor samt SLA-support."),
 ("FAQ","\"Kan vi byta nivå?\" Ja, uppgradera när ni växer. \"Integreras med vårt affärssystem?\" Ja, på Pro."),
 ("Säljtips","Matcha nivå mot antal produkter och integrationsbehov. Tillägg: ERP-integration samt extra språk och valuta."),
 ("Avgränsning","Egen plattform (inte Shopify eller Woo) – vi sköter driften."),
]
ECOM_EN = [
 ("What it is","An online store on our own platform with its own CMS, in three tiers."),
 ("Who it's for","Companies that want to sell products online – tier by range and needs."),
 ("Start","From SEK 19,000 + SEK 1,490/mo: ~100 products, Klarna/Stripe, shipping, mobile-friendly and basic SEO."),
 ("Plus","From SEK 35,000 + SEK 2,490/mo: ~1,000 products, discount codes, customer accounts, newsletters and on-page SEO. Most popular."),
 ("Pro","From SEK 59,000 + SEK 4,900/mo: unlimited products, ERP integration (Fortnox/Visma), B2B pricing, real-time stock, multiple languages and currencies, and SLA support."),
 ("FAQ","\"Can we change tier?\" Yes, upgrade as you grow. \"Does it integrate with our business system?\" Yes, on Pro."),
 ("Sales tips","Match the tier to the number of products and integration needs. Add-ons: ERP integration and extra language and currency."),
 ("Scope","Our own platform (not Shopify or Woo) – we handle the operations."),
]
ECOM_ES = [
 ("Qué es","Una tienda online en nuestra propia plataforma con CMS propio, en tres niveles."),
 ("Para quién","Empresas que quieren vender productos online: nivel según catálogo y necesidades."),
 ("Start","Desde 19 000 SEK + 1 490 SEK/mes: ~100 productos, Klarna/Stripe, envíos, adaptación a móvil y SEO básico."),
 ("Plus","Desde 35 000 SEK + 2 490 SEK/mes: ~1 000 productos, códigos de descuento, cuentas de cliente, newsletters y SEO on-page. El más popular."),
 ("Pro","Desde 59 000 SEK + 4 900 SEK/mes: productos ilimitados, integración ERP (Fortnox/Visma), precios B2B, stock en tiempo real, varios idiomas y monedas, y soporte SLA."),
 ("Preguntas frecuentes","\"¿Podemos cambiar de nivel?\" Sí, ampliad al crecer. \"¿Se integra con nuestro sistema de gestión?\" Sí, en Pro."),
 ("Consejos de venta","Ajusta el nivel al número de productos y a las necesidades de integración. Extras: integración ERP e idioma y moneda adicionales."),
 ("Alcance","Plataforma propia (no Shopify ni Woo): nosotros nos encargamos de la operación."),
]
add("E-handel (Start / Plus / Pro)","E-commerce (Start / Plus / Pro)","E-commerce (Start / Plus / Pro)",10,
    None,None,None, custom=dict(sv=ECOM_SV, en=ECOM_EN, es=ECOM_ES))


def sections_for(p, lang):
    if p["custom"]:
        return p["custom"][lang]
    labels = L[lang]
    out = []
    for label, text in zip(labels, p[lang]):
        if text is None:
            continue
        out.append((label, text))
    return out

rows = []
for p in PRODUCTS:
    rows.append(
        f"  ({slit(p['svt'])}, {slit(p['ent'])}, {slit(p['est'])}, "
        f"{jlit(sections_for(p,'sv'))}, {jlit(sections_for(p,'en'))}, {jlit(sections_for(p,'es'))}, {p['ord']})"
    )
values = ",\n".join(rows)
sql = f"""-- Seed in-depth product knowledge (sv/en/es) into the Produktkunskap category.
-- Bodies are TipTap docs with a bold label per section. Skips items whose title
-- already exists in the category.
INSERT INTO public.training_items
  (category_id, title, title_en, title_es, body, body_en, body_es, sort_order, is_published)
SELECT cat.id, v.title, v.title_en, v.title_es, v.body, v.body_en, v.body_es, v.ord, true
FROM (VALUES
{values}
) AS v(title, title_en, title_es, body, body_en, body_es, ord)
JOIN public.training_categories cat ON cat.slug = 'produktkunskap'
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
print("wrote", os.path.basename(OUT), "with", len(PRODUCTS), "products,", len(docs), "json docs")
