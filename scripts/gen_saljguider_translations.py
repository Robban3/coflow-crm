#!/usr/bin/env python3
"""Translate the 17 Säljguide playbooks to en/es. Reuses the same TipTap builders
as gen_saljguider.py; only the text differs. Updates title_en/title_es and
body_en/body_es, matched on the Swedish title 'Säljguide: <pkg>'.
Emits supabase/migrations/20260620190000_saljguider_translations.sql
"""
import json, os

OUT = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations",
                   "20260620190000_saljguider_translations.sql")

def txt(s): return {"type": "text", "text": s}
def btxt(s): return {"type": "text", "marks": [{"type": "bold"}], "text": s}
def SUB(s): return {"type": "paragraph", "content": [btxt(s)]}
def P(s):   return {"type": "paragraph", "content": [txt(s)]}
def _li(parts): return {"type": "listItem", "content": [{"type": "paragraph", "content": parts}]}
def UL(items):
    return {"type": "bulletList", "content": [
        _li([btxt(it[0] + ": "), txt(it[1])]) if isinstance(it, tuple) else _li([txt(it)]) for it in items]}
def QUOTE(t): return {"type": "blockquote", "content": [{"type": "paragraph", "content": [txt(t)]}]}

def guide_body(g, L):
    # L = labels for this language
    c = []
    c.append(SUB(L["when"])); c.append(P(g["nar"]))
    c.append(SUB(L["hook"])); c.append(QUOTE(g["krok"]))
    c.append(SUB(L["questions"])); c.append(UL(g["fragor"]))
    c.append(SUB(L["pitch"]))
    c.append(UL([(L["problem"], g["problem"]), (L["solution"], g["losning"]), (L["result"], g["resultat"])]))
    c.append(SUB(L["included"])); c.append(UL(g["ingar"]))
    c.append(SUB(L["value"])); c.append(QUOTE(g["varde"]))
    c.append(SUB(L["objections"]))
    for obj, svar in g["invandningar"]:
        c.append(SUB(obj)); c.append(P(svar))
    c.append(SUB(L["close"])); c.append(QUOTE(g["avslut"]))
    c.append(SUB(L["price"])); c.append(P(g["pris"]))
    return json.dumps({"type": "doc", "content": c}, ensure_ascii=False)

def jbody(g, L): return "$j$" + guide_body(g, L) + "$j$::jsonb"
def slit(s): return "'" + s.replace("'", "''") + "'"

LABELS = {
 "en": {"when":"When to use it","hook":"Opening (hook)","questions":"Qualifying questions",
        "pitch":"The pitch","problem":"Problem","solution":"Solution","result":"Result",
        "included":"What's included","value":"Value and ROI","objections":"Objections for this package",
        "close":"Close","price":"Price"},
 "es": {"when":"Cuándo usarla","hook":"Apertura (gancho)","questions":"Preguntas de calificación",
        "pitch":"El pitch","problem":"Problema","solution":"Solución","result":"Resultado",
        "included":"Qué incluye","value":"Valor y ROI","objections":"Objeciones para este paquete",
        "close":"Cierre","price":"Precio"},
}

# pkg (sv match) -> (pkg_en, pkg_es)
NAMES = {
 "Landningssida": ("Landing page","Página de aterrizaje"),
 "Företagshemsida": ("Business website","Web corporativa"),
 "MVP": ("MVP","MVP"),
 "Webbapp": ("Web app","Aplicación web"),
 "Mobilapp": ("Mobile app","Aplicación móvil"),
 "SEO Start": ("SEO Start","SEO Start"),
 "SEO Tillväxt": ("SEO Growth","SEO Crecimiento"),
 "GEO / AI-synlighet": ("GEO / AI visibility","GEO / Visibilidad en IA"),
 "Designpartner": ("Design partner","Socio de diseño"),
 "Logotyp & varumärke": ("Logo & brand","Logotipo y marca"),
 "E-handel Start": ("E-commerce Start","E-commerce Start"),
 "E-handel Plus": ("E-commerce Plus","E-commerce Plus"),
 "E-handel Pro": ("E-commerce Pro","E-commerce Pro"),
 "Startpaket (Hemsida + SEO)": ("Starter bundle (Website + SEO)","Paquete inicial (Web + SEO)"),
 "Tillväxtpaket": ("Growth bundle","Paquete de crecimiento"),
 "MVP-paket (MVP + Designpartner)": ("MVP bundle (MVP + Design partner)","Paquete MVP (MVP + Socio de diseño)"),
 "Full digital närvaro": ("Full digital presence","Presencia digital completa"),
}

EN = {}
ES = {}

EN["Landningssida"] = dict(
 nar="For customers who want to test an idea, launch a campaign or capture leads fast – a single focused page built to convert.",
 krok="Want to test something quickly or capture more leads from your ads? Then the smartest start is one sharp page built for a single goal.",
 fragor=["Where do you send your ad traffic today?","What do you want the visitor to do on the page?","How quickly do you want to be live?"],
 problem="If you send traffic to a cluttered site you lose most visitors before they do anything.",
 losning="A landing page is one page with a clear message and one goal: getting the visitor to reach out or buy.",
 resultat="More leads from the same ad budget, and you're live often this very week.",
 ingar=["A mobile-friendly page","A sharp message and a clear call to action","A lead or contact form","Basic SEO","Analytics and pixel tracking"],
 varde="From SEK 9,000 you get a page that makes every ad krona land somewhere that actually sells.",
 invandningar=[("\"Isn't our regular site enough?\"","A regular site has many exits and distractions. A landing page has a single goal and therefore converts far better on ad traffic."),
               ("\"It feels too small.\"","That's exactly the point – you start small and build on when it delivers. The page can grow into a full website later.")],
 avslut="Shall we set up your first page so you start capturing leads right away?",
 pris="From SEK 9,000. Can be expanded into a full business website.")
ES["Landningssida"] = dict(
 nar="Para clientes que quieren probar una idea, lanzar una campaña o captar leads rápido: una única página enfocada y construida para convertir.",
 krok="¿Queréis probar algo rápido o captar más leads de vuestros anuncios? Entonces el inicio más inteligente es una página afilada con un solo objetivo.",
 fragor=["¿A dónde enviáis vuestro tráfico de anuncios hoy?","¿Qué queréis que haga el visitante en la página?","¿Con qué rapidez queréis estar en línea?"],
 problem="Si envías tráfico a una web desordenada pierdes a la mayoría de visitantes antes de que hagan nada.",
 losning="Una página de aterrizaje es una sola página con un mensaje claro y un objetivo: que el visitante contacte o compre.",
 resultat="Más leads con el mismo presupuesto de anuncios, y estáis en línea a menudo esta misma semana.",
 ingar=["Una página adaptada a móvil","Un mensaje claro y una llamada a la acción evidente","Un formulario de lead o contacto","SEO básico","Conexión con analítica y píxel"],
 varde="Desde 9 000 SEK obtienes una página que hace que cada euro de publicidad aterrice en un lugar que realmente vende.",
 invandningar=[("\"¿No basta con nuestra web normal?\"","Una web normal tiene muchas salidas y distracciones. Una página de aterrizaje tiene un solo objetivo y por eso convierte mucho mejor el tráfico de anuncios."),
               ("\"Parece demasiado pequeño.\"","Ese es justo el punto: empezáis con poco y ampliáis cuando da resultados. La página puede crecer hasta ser una web completa después.")],
 avslut="¿Montamos vuestra primera página para que empecéis a captar leads ya?",
 pris="Desde 9 000 SEK. Se puede ampliar a una web corporativa completa.")

EN["Företagshemsida"] = dict(
 nar="For established companies and service firms that want to look credible, get more enquiries and update the site themselves. Especially strong when the customer has an old or slow site.",
 krok="Your customers decide in three seconds whether to stay or click away. May I ask – how many enquiries does your current site bring in a month?",
 fragor=["How do you get new customers today?","What would you want the website to do that it doesn't do now?","Who updates the site today and how often?"],
 problem="A dated or slow site sends customers straight to the competitor – deals you never even know you lost.",
 losning="A fast, sharp, sales-driven site you're proud of, with its own CMS so you update it yourself.",
 resultat="More enquiries from the right customers, and a site that works for you around the clock.",
 ingar=["Up to seven pages","Responsive design for mobile, tablet and desktop","Its own CMS – no developer skills needed","On-page SEO and Google Analytics","Contact form and social media links"],
 varde="Think of the site as your best salesperson – it works around the clock and costs SEK 18,000 once. One extra customer a month and it's paid for many times over.",
 invandningar=[("\"We already have a website.\"","Great, then you have the foundation. How many leads does it bring in a month? Many sites are pretty brochures that don't sell – I can show you where you're losing visitors."),
               ("\"It's too expensive.\"","It's an investment. What is a new customer worth to you? One extra a month and the site is paid for. We can also start at a simpler level."),
               ("\"Can't we just do it ourselves in Wix?\"","Sure you can, but you pay with your time and rarely get speed, SEO and conversion thrown in. We build it right from the start so you can spend your time on your customers.")],
 avslut="This is our most popular package, and that's no accident. Shall I show a couple of examples and put together a proposal by Friday?",
 pris="SEK 18,000 one-off. Add-ons: extra pages, copywriting, photography, ongoing SEO.")
ES["Företagshemsida"] = dict(
 nar="Para empresas establecidas y de servicios que quieren parecer creíbles, recibir más solicitudes y actualizar la web ellas mismas. Especialmente fuerte cuando el cliente tiene una web vieja o lenta.",
 krok="Tus clientes deciden en tres segundos si se quedan o se van. ¿Puedo preguntar cuántas solicitudes trae vuestra web actual al mes?",
 fragor=["¿Cómo conseguís clientes nuevos hoy?","¿Qué querríais que hiciera la web y que ahora no hace?","¿Quién actualiza la web hoy y con qué frecuencia?"],
 problem="Una web anticuada o lenta envía a los clientes directos a la competencia: ventas que ni siquiera sabes que perdiste.",
 losning="Una web rápida, atractiva y orientada a vender de la que estáis orgullosos, con CMS propio para actualizarla vosotros mismos.",
 resultat="Más solicitudes de los clientes adecuados, y una web que trabaja para vosotros las 24 horas.",
 ingar=["Hasta siete páginas","Diseño responsive para móvil, tablet y escritorio","CMS propio, sin conocimientos de desarrollo","SEO on-page y Google Analytics","Formulario de contacto y enlaces a redes sociales"],
 varde="Piensa en la web como tu mejor vendedor: trabaja las 24 horas y cuesta 18 000 SEK una vez. Un cliente extra al mes y se paga muchas veces.",
 invandningar=[("\"Ya tenemos una web.\"","Estupendo, entonces tenéis la base. ¿Cuántos leads trae al mes? Muchas webs son folletos bonitos que no venden; puedo mostraros dónde perdéis visitantes."),
               ("\"Es demasiado caro.\"","Es una inversión. ¿Cuánto vale un cliente nuevo para vosotros? Uno extra al mes y la web está pagada. También podemos empezar con un nivel más simple."),
               ("\"¿No podemos hacerlo nosotros en Wix?\"","Claro que podéis, pero lo pagáis con vuestro tiempo y rara vez obtenéis velocidad, SEO y conversión de regalo. Lo construimos bien desde el inicio para que dediquéis el tiempo a vuestros clientes.")],
 avslut="Este es nuestro paquete más popular, y no es casualidad. ¿Os muestro un par de ejemplos y preparo una propuesta para el viernes?",
 pris="18 000 SEK pago único. Extras: páginas adicionales, redacción, fotografía, SEO continuo.")

EN["MVP"] = dict(
 nar="For startups and companies that have a product idea but want to validate it with real users before investing big.",
 krok="Do you have a product idea but don't want to spend hundreds of thousands before you know it works?",
 fragor=["What's the core of the idea – what must it absolutely do?","Who is the first user you want to test on?","What happens if you wait six months to launch?"],
 problem="The biggest risk is building a large, expensive product nobody wants.",
 losning="An MVP is a working first version with only the core features, built to be tested on real users.",
 resultat="In 4–6 weeks you have something real to show customers and investors – and you own the source code.",
 ingar=["Agreed core features","A working product in 4–6 weeks","A scalable foundation to build on","You own the source code"],
 varde="From SEK 29,000 you go from idea to a product you can show – instead of guessing your way with an expensive full-scale build.",
 invandningar=[("\"We want everything from the start.\"","That's exactly the trap. Building it all at once risks spending money on features no one uses. We build the core, test, and build on what's actually in demand."),
               ("\"How do we know what to include?\"","We help you prioritise. We start from the one problem the product must solve for the first user.")],
 avslut="Shall we sketch out your MVP and see how fast we can have something to show?",
 pris="From SEK 29,000, delivered in 4–6 weeks. Can be combined with a design partner.")
ES["MVP"] = dict(
 nar="Para startups y empresas que tienen una idea de producto pero quieren validarla con usuarios reales antes de invertir mucho.",
 krok="¿Tenéis una idea de producto pero no queréis gastar cientos de miles antes de saber si funciona?",
 fragor=["¿Cuál es el núcleo de la idea, qué debe hacer sí o sí?","¿Quién es el primer usuario con quien queréis probar?","¿Qué pasa si esperáis medio año a lanzar?"],
 problem="El mayor riesgo es construir un producto grande y caro que nadie quiere.",
 losning="Un MVP es una primera versión funcional con solo las funciones esenciales, hecha para probarse con usuarios reales.",
 resultat="En 4–6 semanas tenéis algo real que mostrar a clientes e inversores, y sois dueños del código.",
 ingar=["Funciones esenciales acordadas","Un producto funcional en 4–6 semanas","Una base escalable sobre la que construir","Sois dueños del código fuente"],
 varde="Desde 29 000 SEK pasáis de la idea a un producto que podéis mostrar, en vez de adivinar con un desarrollo a gran escala costoso.",
 invandningar=[("\"Queremos todo desde el principio.\"","Esa es justo la trampa. Construirlo todo de golpe arriesga gastar en funciones que nadie usa. Construimos el núcleo, probamos y ampliamos lo que de verdad se pide."),
               ("\"¿Cómo sabemos qué incluir?\"","Os ayudamos a priorizar. Partimos del único problema que el producto debe resolver para el primer usuario.")],
 avslut="¿Esbozamos vuestro MVP y vemos qué tan rápido podemos tener algo que mostrar?",
 pris="Desde 29 000 SEK, entregado en 4–6 semanas. Se puede combinar con un socio de diseño.")

EN["Webbapp"] = dict(
 nar="For companies stuck in manual work, spreadsheets or double effort that need real functionality – login, data, automation.",
 krok="How much time do you spend on manual work that a system really should handle for you?",
 fragor=["Describe the process that takes the most time today.","Who needs to log in and see different things?","What would happen if that work were automated?"],
 problem="When a regular website isn't enough you get stuck in manual work that steals time and creates errors.",
 losning="A custom web app with login, roles, database and an admin panel that solves exactly your problem.",
 resultat="The system does the work for you – you go from chasing the process to owning it.",
 ingar=["Roles and permissions","Database and admin panel","Scalable architecture","Custom functionality for your process"],
 varde="From SEK 49,000 you get time back every week and avoid errors that cost money. Work out what those hours are worth.",
 invandningar=[("\"Can it integrate with our systems?\"","Usually yes – we connect to what you already use so there's no double work."),
               ("\"It sounds expensive.\"","Set it against what the manual work costs in hours and errors. A web app usually pays for itself in saved time.")],
 avslut="Tell me about your most time-consuming process and I'll show you concretely what we can automate. Shall we book a walkthrough?",
 pris="From SEK 49,000. Exact price after a short needs analysis.")
ES["Webbapp"] = dict(
 nar="Para empresas atrapadas en trabajo manual, hojas de cálculo o tareas duplicadas que necesitan funcionalidad real: inicio de sesión, datos, automatización.",
 krok="¿Cuánto tiempo dedicáis a trabajo manual que un sistema debería hacer por vosotros?",
 fragor=["Describe el proceso que más tiempo lleva hoy.","¿Quién necesita iniciar sesión y ver cosas distintas?","¿Qué pasaría si ese trabajo se automatizara?"],
 problem="Cuando una web normal no basta, os quedáis atrapados en trabajo manual que roba tiempo y genera errores.",
 losning="Una aplicación web a medida con inicio de sesión, roles, base de datos y panel de administración que resuelve justo vuestro problema.",
 resultat="El sistema hace el trabajo por vosotros: pasáis de perseguir el proceso a dominarlo.",
 ingar=["Roles y permisos","Base de datos y panel de administración","Arquitectura escalable","Funcionalidad a medida para vuestro proceso"],
 varde="Desde 49 000 SEK recuperáis tiempo cada semana y evitáis errores que cuestan dinero. Calculad cuánto valen esas horas.",
 invandningar=[("\"¿Se integra con nuestros sistemas?\"","Normalmente sí: conectamos con lo que ya usáis para que no haya trabajo duplicado."),
               ("\"Suena caro.\"","Ponedlo frente a lo que cuesta el trabajo manual en horas y errores. Una app web suele amortizarse en tiempo ahorrado.")],
 avslut="Cuéntame vuestro proceso que más tiempo consume y te muestro en concreto qué podemos automatizar. ¿Reservamos una sesión?",
 pris="Desde 49 000 SEK. Precio exacto tras un breve análisis de necesidades.")

EN["Mobilapp"] = dict(
 nar="For services that want to be in the customer's pocket with recurring use, push notifications and loyalty.",
 krok="Do you want to be one tap away in the customer's pocket, able to reach them directly with push?",
 fragor=["What should the app do for your customers?","How often would they use it?","Do you want to reach them with notifications?"],
 problem="Without your own app you depend on the customer remembering to visit you.",
 losning="An app for both iOS and Android from the same codebase, with push notifications that take you right into their day.",
 resultat="Recurring use and a direct channel to the customer – again and again.",
 ingar=["Development for iOS and Android from one codebase","Push notifications","Backend","Publishing in the App Store and Google Play"],
 varde="From SEK 79,000 you get the most valuable spot there is: a place on the customer's home screen.",
 invandningar=[("\"Isn't a mobile-friendly site enough?\"","A site is great for being found, but an app gives push notifications and recurring use a site can't. They complement each other."),
               ("\"Do we have to build two apps?\"","No – we build for both iOS and Android from the same codebase, which is faster and cheaper than two separate ones.")],
 avslut="What do you want the app to do for your customers? Shall we sketch out the setup?",
 pris="From SEK 79,000. App Store and Google accounts are the customer's.")
ES["Mobilapp"] = dict(
 nar="Para servicios que quieren estar en el bolsillo del cliente con uso recurrente, notificaciones push y fidelización.",
 krok="¿Queréis estar a un toque de distancia en el bolsillo del cliente, pudiendo llegar a él directamente con push?",
 fragor=["¿Qué debe hacer la app por vuestros clientes?","¿Con qué frecuencia la usarían?","¿Queréis llegar a ellos con notificaciones?"],
 problem="Sin vuestra propia app dependéis de que el cliente se acuerde de visitaros.",
 losning="Una app para iOS y Android desde la misma base de código, con notificaciones push que os llevan directo a su día.",
 resultat="Uso recurrente y un canal directo con el cliente, una y otra vez.",
 ingar=["Desarrollo para iOS y Android desde una base de código","Notificaciones push","Backend","Publicación en App Store y Google Play"],
 varde="Desde 79 000 SEK obtenéis el lugar más valioso que existe: un sitio en la pantalla de inicio del cliente.",
 invandningar=[("\"¿No basta con una web adaptada a móvil?\"","Una web es buena para que os encuentren, pero una app da notificaciones push y uso recurrente que una web no puede. Se complementan."),
               ("\"¿Tenemos que construir dos apps?\"","No: construimos para iOS y Android desde la misma base de código, más rápido y barato que dos separadas.")],
 avslut="¿Qué queréis que la app haga por vuestros clientes? ¿Esbozamos el planteamiento?",
 pris="Desde 79 000 SEK. Las cuentas de App Store y Google corren por cuenta del cliente.")

EN["SEO Start"] = dict(
 nar="For customers who have a site but don't rank, have a smaller budget and want to start ranking higher on Google.",
 krok="Your customers are already googling what you sell. The question is whether they find you or the competitor – shall we find out?",
 fragor=["What keywords would your customers use?","Do you know where you rank today?","How much of your sales comes from Google now?"],
 problem="If you don't show up on Google you give away customers for free to whoever ranks higher.",
 losning="SEO Start lays the foundation: on-page optimization, keyword analysis and a clear monthly report.",
 resultat="Long-term, organic traffic that costs nothing per click and doesn't vanish when you stop advertising.",
 ingar=["On-page optimization","Keyword analysis","A clear monthly report","Ongoing work"],
 varde="From SEK 4,900/mo you build a traffic source that brings customers month after month, at a fraction of what ads cost over time.",
 invandningar=[("\"When do results show?\"","SEO is long-term – usually 3–6 months. But the traffic you build stays and costs nothing per click."),
               ("\"Can you guarantee position 1?\"","No, and be skeptical of anyone who promises it. But we measure everything and move the positions up every month, in black and white.")],
 avslut="Shall we start with a free visibility analysis so you see where you stand today?",
 pris="From SEK 4,900/mo, ongoing. Requires a working site to optimize.")
ES["SEO Start"] = dict(
 nar="Para clientes que tienen una web pero no posicionan, con menos presupuesto y ganas de empezar a aparecer más alto en Google.",
 krok="Vuestros clientes ya buscan en Google lo que vendéis. La cuestión es si os encuentran a vosotros o al competidor. ¿Lo averiguamos?",
 fragor=["¿Qué palabras clave usarían vuestros clientes?","¿Sabéis dónde posicionáis hoy?","¿Cuánto de vuestras ventas viene de Google ahora?"],
 problem="Si no aparecéis en Google regaláis clientes gratis a quien posiciona más alto.",
 losning="SEO Start pone la base: optimización on-page, análisis de palabras clave y un informe mensual claro.",
 resultat="Tráfico orgánico a largo plazo que no cuesta nada por clic y no desaparece cuando dejáis de anunciaros.",
 ingar=["Optimización on-page","Análisis de palabras clave","Un informe mensual claro","Trabajo continuo"],
 varde="Desde 4 900 SEK/mes construís una fuente de tráfico que trae clientes mes tras mes, a una fracción de lo que cuestan los anuncios con el tiempo.",
 invandningar=[("\"¿Cuándo se ven resultados?\"","El SEO es a largo plazo: normalmente 3–6 meses. Pero el tráfico que construís se queda y no cuesta nada por clic."),
               ("\"¿Garantizáis el puesto 1?\"","No, y desconfiad de quien lo prometa. Pero medimos todo y subimos las posiciones cada mes, negro sobre blanco.")],
 avslut="¿Empezamos con un análisis de visibilidad gratuito para ver dónde estáis hoy?",
 pris="Desde 4 900 SEK/mes, continuo. Requiere una web funcional que optimizar.")

EN["SEO Tillväxt"] = dict(
 nar="For companies that are serious about owning their keywords and taking market share.",
 krok="Do you want to not just be seen, but own your most important keywords and pass the competitors?",
 fragor=["Which keywords do you want to dominate?","Who are your toughest competitors online?","How much is a top spot worth to you?"],
 problem="The top spots aren't taken by chance – someone works for them every month.",
 losning="SEO Growth is offensive: ongoing content, link building and technical SEO, all measurable.",
 resultat="Position by position you take your most important keywords and more qualified customers find you.",
 ingar=["Everything in SEO Start","Ongoing content production","Link building","Technical SEO","Monthly report"],
 varde="From SEK 9,900/mo you build a growth engine that moves the positions up every month – in competitive industries it's the difference between being seen and disappearing.",
 invandningar=[("\"It's more expensive than Start.\"","Yes, because it's offensive and takes you past competitors. In an industry where everyone fights for the same customers it's usually worth every krona."),
               ("\"We tried SEO before without results.\"","Then it probably wasn't measured properly. With us you see ranking, traffic and leads every month – no guessing.")],
 avslut="May I show you where you rank today and where we can take you in three months?",
 pris="From SEK 9,900/mo, ongoing.")
ES["SEO Tillväxt"] = dict(
 nar="Para empresas que van en serio con dominar sus palabras clave y ganar cuota de mercado.",
 krok="¿Queréis no solo aparecer, sino dominar vuestras palabras clave más importantes y adelantar a la competencia?",
 fragor=["¿Qué palabras clave queréis dominar?","¿Quiénes son vuestros competidores más duros online?","¿Cuánto vale un primer puesto para vosotros?"],
 problem="Los primeros puestos no se ocupan por azar: alguien trabaja por ellos cada mes.",
 losning="SEO Crecimiento es ofensivo: contenido continuo, link building y SEO técnico, todo medible.",
 resultat="Posición a posición conquistáis vuestras palabras clave más importantes y más clientes cualificados os encuentran.",
 ingar=["Todo lo de SEO Start","Producción de contenido continua","Link building","SEO técnico","Informe mensual"],
 varde="Desde 9 900 SEK/mes construís un motor de crecimiento que sube las posiciones cada mes; en sectores competitivos es la diferencia entre aparecer y desaparecer.",
 invandningar=[("\"Es más caro que Start.\"","Sí, porque es ofensivo y os adelanta a los competidores. En un sector donde todos pelean por los mismos clientes suele valer cada euro."),
               ("\"Probamos SEO antes sin resultados.\"","Entonces probablemente no se midió bien. Con nosotros veis ranking, tráfico y leads cada mes, sin adivinanzas.")],
 avslut="¿Os muestro dónde posicionáis hoy y hasta dónde podemos llevaros en tres meses?",
 pris="Desde 9 900 SEK/mes, continuo.")

EN["GEO / AI-synlighet"] = dict(
 nar="For forward-leaning companies that want to stay ahead of competitors in AI search like ChatGPT and Perplexity.",
 krok="More and more people ask ChatGPT instead of Google. Do you know how the AI describes your company today?",
 fragor=["Have you tried asking ChatGPT about your industry?","Do you know whether you're mentioned or not?","How important is it to be ahead of competitors?"],
 problem="If you don't show up in the AI answers you simply don't exist in that conversation – and there's no ad space to buy your way in.",
 losning="GEO makes you the one the AI mentions and recommends: a GEO analysis, an action plan and ongoing tracking.",
 resultat="A head start on a channel your competitors haven't even thought of yet.",
 ingar=["GEO analysis","A concrete action plan","Ongoing tracking of AI visibility"],
 varde="From SEK 6,900/mo you take a spot that's only available right now – before the competitors wake up.",
 invandningar=[("\"Isn't it too early?\"","Quite the opposite – that's exactly why it's worth it. Your competitors aren't there yet, so whoever acts now gets the head start."),
               ("\"How do you measure it?\"","We track how the AI describes and recommends you over time, and show the progress continuously.")],
 avslut="Want to see how AI describes your company right now? That's a good start.",
 pris="From SEK 6,900/mo, ongoing.")
ES["GEO / AI-synlighet"] = dict(
 nar="Para empresas con visión de futuro que quieren adelantarse a la competencia en buscadores de IA como ChatGPT y Perplexity.",
 krok="Cada vez más gente pregunta a ChatGPT en vez de a Google. ¿Sabéis cómo describe la IA a vuestra empresa hoy?",
 fragor=["¿Habéis probado a preguntar a ChatGPT por vuestro sector?","¿Sabéis si os menciona o no?","¿Qué importancia tiene adelantaros a la competencia?"],
 problem="Si no aparecéis en las respuestas de la IA simplemente no existís en esa conversación, y no hay espacio publicitario para entrar.",
 losning="GEO os convierte en lo que la IA menciona y recomienda: un análisis GEO, un plan de acción y seguimiento continuo.",
 resultat="Una ventaja en un canal en el que vuestros competidores ni han pensado.",
 ingar=["Análisis GEO","Un plan de acción concreto","Seguimiento continuo de la visibilidad en IA"],
 varde="Desde 6 900 SEK/mes tomáis un lugar que solo está disponible ahora mismo, antes de que despierten los competidores.",
 invandningar=[("\"¿No es demasiado pronto?\"","Al contrario: por eso vale la pena. Vuestros competidores aún no están, así que quien actúe ahora se lleva la ventaja."),
               ("\"¿Cómo se mide?\"","Seguimos cómo la IA os describe y recomienda con el tiempo, y mostramos la evolución de forma continua.")],
 avslut="¿Queréis ver cómo describe la IA a vuestra empresa ahora mismo? Es un buen comienzo.",
 pris="Desde 6 900 SEK/mes, continuo.")

EN["Designpartner"] = dict(
 nar="For companies with continuous design needs that don't want to hire a full-time designer or chase freelancers.",
 krok="How often do you get stuck because you lack a designer right when you need one?",
 fragor=["What do your design needs look like over a year?","What do you do today when you need design?","How important is a consistent look?"],
 problem="A full-time designer is expensive, and freelancers disappear mid-project.",
 losning="A whole design department on subscription: UI/UX and graphic material, priority access and a queue you fill at your own pace.",
 resultat="Predictable cost, no recruitment and always someone ready.",
 ingar=["UI/UX and graphic material","Priority access","A queue where you submit at your pace","A consistent look across everything you do"],
 varde="From SEK 9,000/mo you get professional design on an ongoing basis at a predictable cost – and skip both recruitment and expensive one-off jobs.",
 invandningar=[("\"We don't need design all the time.\"","Then you pause when the need is small. But most discover they have more ongoing need than they think once the threshold is low."),
               ("\"How many tasks do we get?\"","One at a time in the queue, at your own pace – so you always have something in progress without paying for a full-time hire.")],
 avslut="What are your design needs over the coming months? Shall we get going with a first task?",
 pris="From SEK 9,000/mo, subscription.")
ES["Designpartner"] = dict(
 nar="Para empresas con necesidades de diseño continuas que no quieren contratar a un diseñador a tiempo completo ni perseguir freelance.",
 krok="¿Con qué frecuencia os bloqueáis por falta de un diseñador justo cuando lo necesitáis?",
 fragor=["¿Cómo son vuestras necesidades de diseño a lo largo de un año?","¿Qué hacéis hoy cuando necesitáis diseño?","¿Qué importancia tiene un aspecto coherente?"],
 problem="Un diseñador a tiempo completo es caro, y los freelance desaparecen a mitad de proyecto.",
 losning="Todo un departamento de diseño por suscripción: UI/UX y material gráfico, acceso prioritario y una cola que llenáis a vuestro ritmo.",
 resultat="Coste predecible, sin contratación y siempre alguien disponible.",
 ingar=["UI/UX y material gráfico","Acceso prioritario","Una cola donde enviáis a vuestro ritmo","Un aspecto coherente en todo lo que hacéis"],
 varde="Desde 9 000 SEK/mes tenéis diseño profesional de forma continua a un coste predecible, y os ahorráis tanto la contratación como los encargos puntuales caros.",
 invandningar=[("\"No necesitamos diseño todo el tiempo.\"","Entonces pausáis cuando la necesidad es pequeña. Pero la mayoría descubre que tiene más necesidad continua de la que cree cuando el umbral es bajo."),
               ("\"¿Cuántas tareas tenemos?\"","Una a la vez en la cola, a vuestro ritmo, para tener siempre algo en marcha sin pagar a un empleado a tiempo completo.")],
 avslut="¿Qué necesidades de diseño tenéis los próximos meses? ¿Arrancamos con una primera tarea?",
 pris="Desde 9 000 SEK/mes, suscripción.")

EN["Logotyp & varumärke"] = dict(
 nar="For new companies, rebrands or those that look scattered and want to be remembered.",
 krok="How do you want customers to remember you – and do you charge like the brand you want to be?",
 fragor=["What does your current look like?","What do you want customers to feel?","Where is the logo used today?"],
 problem="A weak brand makes you one of the crowd, forced to compete on price.",
 losning="A logo and identity that feels right and lasts for years: logo, colors, typography and a brand guide.",
 resultat="Customers remember you, and you can charge more.",
 ingar=["Logo","Color palette","Typography","Brand guide for a consistent look"],
 varde="From SEK 12,000 you get a brand that makes everything you do look professional – and lets you charge the market leader's prices.",
 invandningar=[("\"We already have a logo.\"","Good starting point. The question is whether it holds up over time and works everywhere – I can give an honest assessment and show what could lift it."),
               ("\"Is it really worth it?\"","A strong brand lets you charge more and be remembered. It pays off on every deal going forward.")],
 avslut="How do you want customers to perceive you? Shall we put together a first proposal?",
 pris="From SEK 12,000. A great door-opener before a website.")
ES["Logotyp & varumärke"] = dict(
 nar="Para empresas nuevas, rebrandings o quienes se ven dispersos y quieren ser recordados.",
 krok="¿Cómo queréis que os recuerden los clientes, y cobráis como la marca que queréis ser?",
 fragor=["¿Cómo es vuestro aspecto actual?","¿Qué queréis que sientan los clientes?","¿Dónde se usa el logotipo hoy?"],
 problem="Una marca débil os convierte en uno más, obligados a competir por precio.",
 losning="Un logotipo y una identidad que encajan y duran años: logotipo, colores, tipografía y una guía de marca.",
 resultat="Los clientes os recuerdan y podéis cobrar más.",
 ingar=["Logotipo","Paleta de colores","Tipografía","Guía de marca para un aspecto coherente"],
 varde="Desde 12 000 SEK obtenéis una marca que hace que todo lo que hacéis se vea profesional, y os permite cobrar como el líder del mercado.",
 invandningar=[("\"Ya tenemos un logotipo.\"","Buen punto de partida. La cuestión es si aguanta con el tiempo y funciona en todas partes; puedo daros una valoración honesta y mostrar qué lo mejoraría."),
               ("\"¿De verdad vale la pena?\"","Una marca fuerte os permite cobrar más y ser recordados. Se amortiza en cada venta futura.")],
 avslut="¿Cómo queréis que os perciban los clientes? ¿Preparamos una primera propuesta?",
 pris="Desde 12 000 SEK. Un buen abrepuertas antes de una web.")

EN["E-handel Start"] = dict(
 nar="For smaller stores that want to start selling online without a big investment.",
 krok="Do you want to start selling online and have a store that takes payment even while you sleep?",
 fragor=["How many products do you have?","Do you already sell online today?","How do you want to take payment?"],
 problem="Getting started with e-commerce often feels expensive and complicated – so it never happens.",
 losning="A complete store on our own platform with its own CMS, payment and shipping, live quickly.",
 resultat="You start selling now and upgrade as sales grow.",
 ingar=["Its own CMS","Payment via Klarna or Stripe","Shipping and mobile-friendly design","Room for up to about 100 products","Basic SEO"],
 varde="From SEK 19,000 setup and SEK 1,490/mo you get a store that sells around the clock – at a low threshold.",
 invandningar=[("\"Maybe we should use Shopify.\"","You skip Shopify's monthly licenses and app fees. We build on our own platform and handle the operations, so you can focus on selling."),
               ("\"What if we outgrow it?\"","Then you upgrade to Plus or Pro. You start small and grow at your own pace.")],
 avslut="Shall we set up your store and get the first order ticking in?",
 pris="From SEK 19,000 setup + SEK 1,490/mo.")
ES["E-handel Start"] = dict(
 nar="Para tiendas más pequeñas que quieren empezar a vender online sin una gran inversión.",
 krok="¿Queréis empezar a vender online y tener una tienda que cobra incluso mientras dormís?",
 fragor=["¿Cuántos productos tenéis?","¿Ya vendéis online hoy?","¿Cómo queréis cobrar?"],
 problem="Empezar con e-commerce suele parecer caro y complicado, así que no se hace.",
 losning="Una tienda completa en nuestra propia plataforma con CMS propio, pago y envíos, en marcha rápido.",
 resultat="Empezáis a vender ya y ampliáis a medida que crecen las ventas.",
 ingar=["CMS propio","Pago con Klarna o Stripe","Envíos y diseño adaptado a móvil","Espacio para hasta unos 100 productos","SEO básico"],
 varde="Desde 19 000 SEK de alta y 1 490 SEK/mes tenéis una tienda que vende las 24 horas, con un umbral bajo.",
 invandningar=[("\"Quizá deberíamos usar Shopify.\"","Os ahorráis las licencias mensuales y las tarifas de apps de Shopify. Construimos en nuestra plataforma y gestionamos la operación, para que os centréis en vender."),
               ("\"¿Y si nos quedamos pequeños?\"","Entonces ampliáis a Plus o Pro. Empezáis con poco y crecéis a vuestro ritmo.")],
 avslut="¿Montamos vuestra tienda y hacemos que entre el primer pedido?",
 pris="Desde 19 000 SEK de alta + 1 490 SEK/mes.")

EN["E-handel Plus"] = dict(
 nar="For stores that are starting to grow and need more power to sell more.",
 krok="Is your store starting to grow and you need more power – more products, campaigns and repeat customers?",
 fragor=["Roughly how many products do you have?","Do you want to work with discount codes and newsletters?","What stops you from selling more today?"],
 problem="A store that starts selling but can't grow quickly becomes a bottleneck.",
 losning="Our most popular e-commerce package: more products, multiple payment options, discount codes, customer accounts and newsletters.",
 resultat="Higher average order and customers who come back.",
 ingar=["Up to about 1,000 products","Multiple payment options","Discount codes and customer accounts","Newsletter integration","On-page SEO"],
 varde="From SEK 35,000 setup and SEK 2,490/mo you get features built to raise the average order and bring customers back.",
 invandningar=[("\"It's a step up in price.\"","Yes, but the features are there to sell more – discount codes, customer accounts and newsletters usually pay back the difference quickly."),
               ("\"We handle marketing ourselves.\"","Perfect – then Plus gives you the tools like newsletters and discount codes, which make your work more effective.")],
 avslut="Want to see how it would work for your range?",
 pris="From SEK 35,000 setup + SEK 2,490/mo. Most popular.")
ES["E-handel Plus"] = dict(
 nar="Para tiendas que empiezan a crecer y necesitan más potencia para vender más.",
 krok="¿Empieza a crecer vuestra tienda y necesitáis más potencia: más productos, campañas y clientes que repiten?",
 fragor=["¿Aproximadamente cuántos productos tenéis?","¿Queréis trabajar con códigos de descuento y newsletters?","¿Qué os impide vender más hoy?"],
 problem="Una tienda que empieza a vender pero no puede crecer se convierte rápido en un cuello de botella.",
 losning="Nuestro paquete de e-commerce más popular: más productos, varias opciones de pago, códigos de descuento, cuentas de cliente y newsletters.",
 resultat="Mayor ticket medio y clientes que vuelven.",
 ingar=["Hasta unos 1 000 productos","Varias opciones de pago","Códigos de descuento y cuentas de cliente","Integración de newsletter","SEO on-page"],
 varde="Desde 35 000 SEK de alta y 2 490 SEK/mes obtenéis funciones hechas para subir el ticket medio y hacer que los clientes vuelvan.",
 invandningar=[("\"Es un salto de precio.\"","Sí, pero las funciones están para vender más: códigos de descuento, cuentas de cliente y newsletters suelen recuperar la diferencia rápido."),
               ("\"Nosotros llevamos el marketing.\"","Perfecto: Plus os da las herramientas como newsletters y códigos de descuento, que hacen vuestro trabajo más eficaz.")],
 avslut="¿Queréis ver cómo funcionaría para vuestro catálogo?",
 pris="Desde 35 000 SEK de alta + 2 490 SEK/mes. El más popular.")

EN["E-handel Pro"] = dict(
 nar="For large ranges and business systems that must talk to the store – enterprise level.",
 krok="Do you have a large range and systems that need to talk to the store, like stock and finance?",
 fragor=["How many products and which systems do you use?","Do you sell B2B with customer-specific prices?","Do you need multiple languages or currencies?"],
 problem="When you sell for real the bottleneck is rarely the store but all the manual work around it.",
 losning="Enterprise e-commerce with unlimited range, ERP integration, B2B pricing and real-time stock.",
 resultat="A store that scales with you instead of slowing you down.",
 ingar=["Unlimited products","ERP integration (Fortnox/Visma)","B2B pricing and real-time stock","Multiple languages and currencies","Priority support with SLA"],
 varde="From SEK 59,000 setup and SEK 4,900/mo you get an e-commerce that removes the manual work and scales without braking.",
 invandningar=[("\"We already have a business system.\"","Perfect – we integrate with it (Fortnox, Visma and more) so orders, stock and invoices sync automatically."),
               ("\"It's a big investment.\"","It is. But for a large range the saved time and automatic flows pay it back quickly.")],
 avslut="Which systems does the store need to connect to? Shall we map it out together?",
 pris="From SEK 59,000 setup + SEK 4,900/mo.")
ES["E-handel Pro"] = dict(
 nar="Para catálogos grandes y sistemas de gestión que deben hablar con la tienda: nivel enterprise.",
 krok="¿Tenéis un catálogo grande y sistemas que necesitan hablar con la tienda, como stock y contabilidad?",
 fragor=["¿Cuántos productos y qué sistemas usáis?","¿Vendéis B2B con precios por cliente?","¿Necesitáis varios idiomas o monedas?"],
 problem="Cuando vendéis en serio, el cuello de botella rara vez es la tienda sino todo el trabajo manual alrededor.",
 losning="E-commerce enterprise con catálogo ilimitado, integración ERP, precios B2B y stock en tiempo real.",
 resultat="Una tienda que escala con vosotros en vez de frenaros.",
 ingar=["Productos ilimitados","Integración ERP (Fortnox/Visma)","Precios B2B y stock en tiempo real","Varios idiomas y monedas","Soporte prioritario con SLA"],
 varde="Desde 59 000 SEK de alta y 4 900 SEK/mes obtenéis un e-commerce que elimina el trabajo manual y escala sin frenar.",
 invandningar=[("\"Ya tenemos un sistema de gestión.\"","Perfecto: lo integramos (Fortnox, Visma y más) para que pedidos, stock y facturas se sincronicen automáticamente."),
               ("\"Es una gran inversión.\"","Lo es. Pero para un catálogo grande el tiempo ahorrado y los flujos automáticos lo recuperan rápido.")],
 avslut="¿A qué sistemas necesita conectarse la tienda? ¿Lo trazamos juntos?",
 pris="Desde 59 000 SEK de alta + 4 900 SEK/mes.")

EN["Startpaket (Hemsida + SEO)"] = dict(
 nar="For customers who want both to be seen and to have a site that converts – from day one.",
 krok="Do you want both a site that converts and an engine that pulls in traffic – from day one?",
 fragor=["Do you have a site today, and does it rank?","How important is it to start being seen quickly?","What's the goal for the next six months?"],
 problem="A beautiful site with no visitors is a silent shop. Traffic without a selling site is buckets with holes.",
 losning="The Starter bundle combines a business website with ongoing SEO at a discounted price.",
 resultat="The whole foundation in place: a site that converts and an engine that pulls in traffic every month.",
 ingar=["Business website (up to seven pages, own CMS)","On-page SEO and Google Analytics","Ongoing SEO with keywords and report","Discounted bundle price"],
 varde="For SEK 18,000 plus SEK 3,900/mo you get both the site and the traffic – a natural first step for anyone who wants to grow digitally.",
 invandningar=[("\"Can't we take the site first and SEO later?\"","You can, but then you lose the first months. Starting SEO right away means the traffic starts building while the site is new."),
               ("\"It's a monthly cost.\"","Yes, but it's what makes the site actually bring in customers. A site without traffic costs you more in lost deals.")],
 avslut="Shall I run the numbers on the Starter bundle for you?",
 pris="SEK 18,000 + SEK 3,900/mo.")
ES["Startpaket (Hemsida + SEO)"] = dict(
 nar="Para clientes que quieren aparecer y tener una web que convierte, desde el primer día.",
 krok="¿Queréis tanto una web que convierte como un motor que atrae tráfico, desde el primer día?",
 fragor=["¿Tenéis web hoy, y posiciona?","¿Qué importancia tiene empezar a aparecer pronto?","¿Cuál es el objetivo de los próximos seis meses?"],
 problem="Una web bonita sin visitas es una tienda en silencio. Tráfico sin una web que venda son cubos con agujeros.",
 losning="El Paquete inicial combina una web corporativa con SEO continuo a precio rebajado.",
 resultat="Toda la base lista: una web que convierte y un motor que atrae tráfico cada mes.",
 ingar=["Web corporativa (hasta siete páginas, CMS propio)","SEO on-page y Google Analytics","SEO continuo con palabras clave e informe","Precio de paquete rebajado"],
 varde="Por 18 000 SEK más 3 900 SEK/mes obtenéis tanto la web como el tráfico, un primer paso natural para quien quiere crecer en digital.",
 invandningar=[("\"¿No podemos hacer la web primero y el SEO después?\"","Podéis, pero perdéis los primeros meses. Empezar el SEO ya hace que el tráfico se construya mientras la web es nueva."),
               ("\"Es un coste mensual.\"","Sí, pero es lo que hace que la web realmente traiga clientes. Una web sin tráfico os cuesta más en ventas perdidas.")],
 avslut="¿Os hago los números del Paquete inicial?",
 pris="18 000 SEK + 3 900 SEK/mes.")

EN["Tillväxtpaket"] = dict(
 nar="For companies that want to accelerate for real and take market share fast.",
 krok="Do you want to not just be seen, but take market share fast on both Google and AI search?",
 fragor=["How aggressively do you want to grow over the next year?","Which channels do you use today?","What would happen if you got twice as many enquiries?"],
 problem="Doing one thing at a time isn't enough when you want to take market share – it's the whole that wins.",
 losning="The Growth bundle combines a selling website, offensive SEO and GEO in one.",
 resultat="A complete digital growth engine we optimise continuously – you dominate both Google and AI search.",
 ingar=["Selling business website","Offensive SEO (content, links, technical)","GEO / AI visibility","Ongoing optimization and report"],
 varde="From SEK 25,000 plus SEK 14,900/mo you get an engine that takes market share while competitors do one channel at a time.",
 invandningar=[("\"It's a big monthly cost.\"","It's an offensive package for those who mean business. Set it against what market share and more customers are worth – it's a growth investment, not a cost."),
               ("\"Can we start smaller?\"","Absolutely – then we start with the Starter bundle and step up to Growth when you want to accelerate.")],
 avslut="Want to see a concrete plan for the next three months?",
 pris="From SEK 25,000 + SEK 14,900/mo.")
ES["Tillväxtpaket"] = dict(
 nar="Para empresas que quieren acelerar de verdad y ganar cuota de mercado rápido.",
 krok="¿Queréis no solo aparecer, sino ganar cuota de mercado rápido en Google y en la búsqueda con IA?",
 fragor=["¿Con qué agresividad queréis crecer el próximo año?","¿Qué canales usáis hoy?","¿Qué pasaría si recibierais el doble de solicitudes?"],
 problem="Hacer una cosa cada vez no basta cuando queréis ganar cuota: gana el conjunto.",
 losning="El Paquete de crecimiento combina una web que vende, SEO ofensivo y GEO en uno.",
 resultat="Un motor de crecimiento digital completo que optimizamos de forma continua: dominais Google y la búsqueda con IA.",
 ingar=["Web corporativa que vende","SEO ofensivo (contenido, enlaces, técnico)","GEO / Visibilidad en IA","Optimización continua e informe"],
 varde="Desde 25 000 SEK más 14 900 SEK/mes obtenéis un motor que gana cuota mientras los competidores hacen un canal cada vez.",
 invandningar=[("\"Es un coste mensual grande.\"","Es un paquete ofensivo para quien va en serio. Ponedlo frente a lo que valen la cuota de mercado y más clientes: es una inversión de crecimiento, no un coste."),
               ("\"¿Podemos empezar más pequeño?\"","Por supuesto: empezamos con el Paquete inicial y subimos a Crecimiento cuando queráis acelerar.")],
 avslut="¿Queréis ver un plan concreto para los próximos tres meses?",
 pris="Desde 25 000 SEK + 14 900 SEK/mes.")

EN["MVP-paket (MVP + Designpartner)"] = dict(
 nar="For startups building a new product that want both development and design in one team.",
 krok="Are you building a new product and want both development and ongoing design – without compromising on the impression?",
 fragor=["What's the product idea?","How important is design and impression to your audience?","How fast do you want to move?"],
 problem="A product that works but looks cheap loses customers and investors. A beautiful product that doesn't work does the same.",
 losning="The MVP bundle combines an MVP with an ongoing design partner – product and design in one.",
 resultat="A working product and continuous design that refines it further, at a discounted design rate.",
 ingar=["MVP with core features","Ongoing design partner (UI/UX)","Discounted design rate","One team for both build and design"],
 varde="From SEK 29,000 plus SEK 7,000/mo you get both a product and design that develops it – perfect for startups that want to move fast.",
 invandningar=[("\"Isn't just the MVP enough first?\"","It can be, but design from the start means you dare to show the product to customers and investors earlier – and then you learn faster."),
               ("\"We have our own designer.\"","Great – then we can focus on the build. But many startups find that ongoing design without hiring is a big relief.")],
 avslut="Tell me about your idea and I'll show you how we get going this month.",
 pris="From SEK 29,000 + SEK 7,000/mo.")
ES["MVP-paket (MVP + Designpartner)"] = dict(
 nar="Para startups que construyen un producto nuevo y quieren desarrollo y diseño en un mismo equipo.",
 krok="¿Estáis construyendo un producto nuevo y queréis desarrollo y diseño continuo, sin sacrificar la imagen?",
 fragor=["¿Cuál es la idea de producto?","¿Qué importancia tiene el diseño y la imagen para vuestro público?","¿A qué velocidad queréis moveros?"],
 problem="Un producto que funciona pero parece barato pierde clientes e inversores. Un producto bonito que no funciona, igual.",
 losning="El Paquete MVP combina un MVP con un socio de diseño continuo: producto y diseño en uno.",
 resultat="Un producto funcional y diseño continuo que lo refina, a un precio de diseño rebajado.",
 ingar=["MVP con funciones esenciales","Socio de diseño continuo (UI/UX)","Precio de diseño rebajado","Un equipo para construir y diseñar"],
 varde="Desde 29 000 SEK más 7 000 SEK/mes obtenéis un producto y un diseño que lo desarrolla, perfecto para startups que quieren moverse rápido.",
 invandningar=[("\"¿No basta primero con el MVP?\"","Puede bastar, pero el diseño desde el inicio hace que os atreváis a mostrar el producto a clientes e inversores antes, y así aprendéis más rápido."),
               ("\"Tenemos nuestro propio diseñador.\"","Genial: entonces nos centramos en la construcción. Pero muchas startups descubren que el diseño continuo sin contratar es un gran alivio.")],
 avslut="Contadme vuestra idea y os muestro cómo arrancamos este mes.",
 pris="Desde 29 000 SEK + 7 000 SEK/mes.")

EN["Full digital närvaro"] = dict(
 nar="For customers who want a partner that takes full responsibility for their digital presence.",
 krok="Do you want a partner that takes full responsibility for the digital side, so you can focus on your business?",
 fragor=["How many suppliers do you have for the digital side today?","What takes the most time and energy?","What would it be worth to have everything in one place?"],
 problem="Juggling ten suppliers for site, SEO, GEO and design steals time you'd rather spend on your customers.",
 losning="Full digital presence gathers website or app, SEO, GEO and design under one roof, with a dedicated contact.",
 resultat="You focus on what you do best – we own the digital and make it deliver.",
 ingar=["Website or app","SEO and GEO","Design","A dedicated contact","A tailored quote based on your goals"],
 varde="You get everything in one place and a partner who knows your business – instead of spending time coordinating suppliers.",
 invandningar=[("\"What does it cost?\"","It depends on what you need – we put together a tailored quote based on your goals, so you pay for the right things."),
               ("\"We already have suppliers.\"","Then we can take over parts one at a time, or complement where it's missing. The point is you get a partner who sees the whole.")],
 avslut="Shall we book a meeting and map out your needs?",
 pris="A tailored quote based on your goals.")
ES["Full digital närvaro"] = dict(
 nar="Para clientes que quieren un socio que asuma la responsabilidad total de su presencia digital.",
 krok="¿Queréis un socio que asuma la responsabilidad total de lo digital, para que podáis centraros en vuestro negocio?",
 fragor=["¿Cuántos proveedores tenéis para lo digital hoy?","¿Qué consume más tiempo y energía?","¿Qué valdría tener todo en un solo lugar?"],
 problem="Hacer malabares con diez proveedores para web, SEO, GEO y diseño roba tiempo que preferiríais dedicar a vuestros clientes.",
 losning="Presencia digital completa reúne web o app, SEO, GEO y diseño bajo un mismo techo, con un contacto dedicado.",
 resultat="Os centráis en lo que mejor hacéis; nosotros nos hacemos cargo de lo digital y hacemos que rinda.",
 ingar=["Web o app","SEO y GEO","Diseño","Un contacto dedicado","Un presupuesto a medida según vuestros objetivos"],
 varde="Tenéis todo en un lugar y un socio que conoce vuestro negocio, en vez de perder tiempo coordinando proveedores.",
 invandningar=[("\"¿Cuánto cuesta?\"","Depende de lo que necesitéis: preparamos un presupuesto a medida según vuestros objetivos, para que paguéis por lo correcto."),
               ("\"Ya tenemos proveedores.\"","Entonces podemos asumir partes una a una, o complementar donde falte. La idea es que tengáis un socio que ve el conjunto.")],
 avslut="¿Reservamos una reunión y trazamos vuestras necesidades?",
 pris="Presupuesto a medida según vuestros objetivos.")

# ── Emit ────────────────────────────────────────────────────────────────────
ORDER = list(NAMES.keys())
parts = []
for pkg in ORDER:
    en_g, es_g = EN[pkg], ES[pkg]
    pkg_en, pkg_es = NAMES[pkg]
    parts.append(f"""UPDATE public.training_items ti
SET title_en = {slit('Sales guide: ' + pkg_en)},
    title_es = {slit('Guía de ventas: ' + pkg_es)},
    body_en = {jbody(en_g, LABELS['en'])},
    body_es = {jbody(es_g, LABELS['es'])}
FROM public.training_categories cat
WHERE ti.category_id = cat.id AND cat.slug = 'saljmanus'
  AND ti.title = {slit('Säljguide: ' + pkg)};""")

sql = ("-- Translate the 17 Säljguide playbooks to en/es (title + body).\n\n"
       + "\n\n".join(parts) + "\n")
with open(OUT, "w", encoding="utf-8") as f:
    f.write(sql)

import re
docs = re.findall(r"\$j\$(.*?)\$j\$", sql, re.S)
for d in docs:
    json.loads(d)
print("wrote", os.path.basename(OUT), "with", len(ORDER), "guides,", len(docs), "docs")
