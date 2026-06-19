#!/usr/bin/env python3
"""Generate SQL migrations for training translations (en/es) + a sales-process
example. Run from repo root: python3 scripts/gen_training_translations.py
Writes the two migration files under supabase/migrations/."""
import json, os

MIG_DIR = os.path.join(os.path.dirname(__file__), "..", "supabase", "migrations")


def doc(text: str) -> str:
    """blank-line-separated paragraphs -> TipTap doc JSON string."""
    paras = [p.strip() for p in text.strip().split("\n\n") if p.strip()]
    d = {
        "type": "doc",
        "content": [
            {"type": "paragraph", "content": [{"type": "text", "text": p}]}
            for p in paras
        ],
    }
    return json.dumps(d, ensure_ascii=False)


def jlit(text: str) -> str:
    """JSON body as a dollar-quoted ::jsonb literal."""
    return "$j$" + doc(text) + "$j$::jsonb"


def slit(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


# ── Sales-process example (sv/en/es) — inserted as a new item, sort 0 ────────
PROC_SV_TITLE = "Säljprocessen – exempel från första kontakt till avslut"
PROC_EN_TITLE = "The sales process – an example from first contact to close"
PROC_ES_TITLE = "El proceso de ventas: un ejemplo del primer contacto al cierre"

PROC_SV = """Så här kan en affär se ut från start till mål. Använd den som mall – stegen är alltid desamma, även om tempot varierar.

1. Prospektering: Du hittar Bygg & Co, ett lokalt byggföretag med en daterad hemsida som inte rankar på Google. Du noterar en konkret iakttagelse: de syns inte på sökordet "takläggare Göteborg".

2. Första kontakt (kallt samtal): Du ringer, är kort och nyfiken och bokar ett videomöte. Målet är inte att sälja – bara att boka mötet. Se manuset för kalla samtal.

3. Behovsanalys (mötet): Du lägger mest tid här. Det visar sig att de får för få förfrågningar och tappar jobb till en konkurrent som ligger högre på Google. Nu vet du exakt vilket problem du ska lösa.

4. Förslag och offert: Du föreslår Startpaketet – en ny hemsida (18 000 kr) plus löpande SEO (3 900 kr/mån) – och kopplar varje del till det de berättade: "Du sa att ni tappar jobb till X – det här är precis vad som vänder det."

5. Invändningshantering: De säger "det är lite dyrt". Du bekräftar och vänder till värde: ett enda extra takjobb i månaden betalar hela investeringen. Se invändningshanteringen.

6. Avslut: Du föreslår nästa steg konkret: "Jag sätter igång på måndag, så är ni live om tre veckor. Ska vi köra?" Du bokar tiden direkt.

7. Leverans och merförsäljning: Sajten levereras, SEO börjar ge resultat och efter tre månader ringer du om GEO – nu när de litar på er. Nöjda kunder blir återkommande kunder.

Kom ihåg: lyssna mer än du pratar, koppla allt till kundens egna ord, och föreslå alltid ett tydligt nästa steg."""

PROC_EN = """Here is what a deal can look like from start to finish. Use it as a template – the steps are always the same, even if the pace varies.

1. Prospecting: You find Bygg & Co, a local construction firm with a dated website that doesn't rank on Google. You note one concrete observation: they don't show up for "roofer Gothenburg".

2. First contact (cold call): You call, stay short and curious, and book a video meeting. The goal isn't to sell – just to book the meeting. See the cold-call script.

3. Needs analysis (the meeting): Spend most of your time here. It turns out they get too few enquiries and lose jobs to a competitor who ranks higher on Google. Now you know exactly which problem to solve.

4. Proposal and quote: You suggest the Starter bundle – a new website (SEK 18,000) plus ongoing SEO (SEK 3,900/mo) – and tie each part to what they told you: "You said you lose jobs to X – this is exactly what turns that around."

5. Handling objections: They say "it's a bit expensive". You acknowledge it and turn to value: a single extra roofing job a month pays for the whole investment. See objection handling.

6. Closing: You propose a concrete next step: "I'll start Monday, so you're live in three weeks. Shall we go?" You book the time right away.

7. Delivery and upsell: The site ships, SEO starts to pay off, and after three months you call about GEO – now that they trust you. Happy customers become repeat customers.

Remember: listen more than you talk, tie everything back to the customer's own words, and always propose a clear next step."""

PROC_ES = """Así puede ser una operación de principio a fin. Úsalo como plantilla: los pasos son siempre los mismos, aunque el ritmo varíe.

1. Prospección: Encuentras a Bygg & Co, una constructora local con una web anticuada que no posiciona en Google. Anotas una observación concreta: no aparecen para "instalador de tejados Gotemburgo".

2. Primer contacto (llamada en frío): Llamas, eres breve y curioso, y agendas una videollamada. El objetivo no es vender, solo conseguir la reunión. Consulta el guion de llamada en frío.

3. Análisis de necesidades (la reunión): Dedica aquí la mayor parte del tiempo. Resulta que reciben muy pocas solicitudes y pierden trabajos frente a un competidor mejor posicionado en Google. Ya sabes exactamente qué problema resolver.

4. Propuesta y presupuesto: Propones el Paquete inicial – una web nueva (18 000 SEK) más SEO continuo (3 900 SEK/mes) – y conectas cada parte con lo que te contaron: "Dijiste que pierdes trabajos frente a X; esto es justo lo que lo revierte."

5. Manejo de objeciones: Dicen "es un poco caro". Lo reconoces y lo conviertes en valor: un solo trabajo de tejado extra al mes paga toda la inversión. Consulta el manejo de objeciones.

6. Cierre: Propones un siguiente paso concreto: "Empiezo el lunes, así estáis en línea en tres semanas. ¿Lo hacemos?" Agendas la fecha de inmediato.

7. Entrega y venta adicional: La web se entrega, el SEO empieza a dar frutos y, a los tres meses, llamas para hablar de GEO, ahora que confían en ti. Los clientes satisfechos se vuelven recurrentes.

Recuerda: escucha más de lo que hablas, conecta todo con las propias palabras del cliente y propón siempre un siguiente paso claro."""

# ── Translations for existing Säljmanus items, keyed by exact sv title ───────
# Each value: (en_title, es_title, en_body, es_body)
T = {}

T["Säljpitch: Landningssida"] = (
 "Sales pitch: Landing page",
 "Pitch de ventas: Página de aterrizaje",
 """Imagine every ad krona actually landing somewhere that sells. A landing page is exactly that – one razor-sharp page built for a single goal: turning visitors into customers.

You get a lightning-fast, mobile-friendly page with a message that hits home, a form that captures every lead, and SEO baked in. From SEK 9,000 you're live – often this very week.

Most businesses lose deals by sending traffic to a cluttered site. You won't. Shall we set up your first page and start capturing leads right away?""",
 """Imagina que cada euro de publicidad aterriza en un lugar que realmente vende. Una página de aterrizaje es justo eso: una única página afilada con un solo objetivo: convertir visitantes en clientes.

Obtienes una página ultrarrápida y adaptada a móvil, con un mensaje que da en el blanco, un formulario que capta cada lead y SEO de base. Desde 9 000 SEK estás en línea, a menudo esta misma semana.

La mayoría pierde ventas por enviar tráfico a una web desordenada. Tú no. ¿Montamos tu primera página y empezamos a captar leads ya?""",
)

T["Säljpitch: Företagshemsida"] = (
 "Sales pitch: Business website",
 "Pitch de ventas: Web corporativa",
 """Your customers decide in three seconds. A slow or dated site sends them straight to your competitor – for good. Those are deals you never even know you lost.

Our business website gives you the opposite: a fast, sharp, sales-driven site you're proud to send people to. Up to seven pages, your own CMS so you update it yourself, responsive design, on-page SEO and Google Analytics – all for SEK 18,000.

It's our most popular package, and that's no accident. Want me to show examples and put together a proposal for your new site?""",
 """Tus clientes deciden en tres segundos. Una web lenta o anticuada los envía directos a la competencia, para siempre. Son ventas que ni siquiera sabes que perdiste.

Nuestra web corporativa te da lo contrario: un sitio rápido, atractivo y orientado a vender que te enorgullece mostrar. Hasta siete páginas, tu propio CMS para actualizarla tú mismo, diseño responsive, SEO on-page y Google Analytics, todo por 18 000 SEK.

Es nuestro paquete más popular, y no es casualidad. ¿Te muestro ejemplos y preparo una propuesta para tu nueva web?""",
)

T["Säljpitch: MVP"] = (
 "Sales pitch: MVP",
 "Pitch de ventas: MVP",
 """The biggest risk with a new product isn't building the wrong thing – it's spending six months and hundreds of thousands before you know anyone even wants it.

An MVP flips that around. We build a sharp first version with the core features in 4–6 weeks, from SEK 29,000, and you own the source code. Suddenly you have something real to show customers and investors – not a pitch, but a product.

The fastest companies win because they learn from reality first. Shall we sketch out your MVP right now?""",
 """El mayor riesgo de un producto nuevo no es construir algo equivocado, sino invertir medio año y cientos de miles antes de saber si alguien lo quiere.

Un MVP le da la vuelta. Construimos una primera versión afilada con las funciones esenciales en 4–6 semanas, desde 29 000 SEK, y tú eres dueño del código. De repente tienes algo real que mostrar a clientes e inversores: no una idea, sino un producto.

Las empresas más rápidas ganan porque aprenden antes de la realidad. ¿Esbozamos tu MVP ahora mismo?""",
)

T["Säljpitch: Webbapp"] = (
 "Sales pitch: Web app",
 "Pitch de ventas: Aplicación web",
 """When an ordinary website isn't enough, you're often stuck in manual work, spreadsheets and double effort. Imagine the system doing it for you instead.

We build a custom web app that solves exactly your problem – login, roles, database, admin panel and an architecture that grows with you, from SEK 49,000. It's the difference between chasing your process and owning it.

Tell me how you work today and I'll show you concretely what we can automate away. How much time would you win each week?""",
 """Cuando una web normal no basta, sueles quedar atrapado en trabajo manual, hojas de cálculo y tareas duplicadas. Imagina que el sistema lo hace por ti.

Construimos una aplicación web a medida que resuelve justo tu problema: inicio de sesión, roles, base de datos, panel de administración y una arquitectura que crece contigo, desde 49 000 SEK. Es la diferencia entre perseguir tu proceso y dominarlo.

Cuéntame cómo trabajáis hoy y te muestro en concreto qué podemos automatizar. ¿Cuánto tiempo ganaríais cada semana?""",
)

T["Säljpitch: Mobilapp"] = (
 "Sales pitch: Mobile app",
 "Pitch de ventas: Aplicación móvil",
 """There's no more valuable spot than your customer's pocket. Your own app means you're one tap away – with push notifications that take you right into their day, again and again.

We build for both iOS and Android from the same codebase – faster and cheaper than two separate apps. From SEK 79,000 you get development, push, backend and publishing in the App Store and Google Play. We handle the whole journey from idea to launch.

Picture your customers with your logo on their home screen. What should the app do for them – and for your repeat sales?""",
 """No hay lugar más valioso que el bolsillo de tu cliente. Tu propia app significa estar a un toque de distancia, con notificaciones push que te llevan directo a su día, una y otra vez.

Desarrollamos para iOS y Android desde la misma base de código: más rápido y barato que dos apps separadas. Desde 79 000 SEK incluye desarrollo, push, backend y publicación en App Store y Google Play. Nos encargamos de todo el camino, de la idea al lanzamiento.

Imagina a tus clientes con tu logo en la pantalla de inicio. ¿Qué debe hacer la app por ellos y por tus ventas recurrentes?""",
)

T["Säljpitch: SEO Start"] = (
 "Sales pitch: SEO Start",
 "Pitch de ventas: SEO Start",
 """Right now someone is googling exactly what you sell. The uncomfortable question: do they find you, or your competitor? Every day on page two is customers you give away for free.

With SEO Start we lay the groundwork to turn that around. From SEK 4,900/mo you get on-page optimization, keyword analysis and a clear monthly report where you see the curve pointing up – in black and white.

The best part? The traffic you build costs nothing per click and doesn't vanish when you stop advertising. Shall we start with a quick visibility analysis so you see where you stand today?""",
 """Ahora mismo alguien está buscando en Google justo lo que vendes. La pregunta incómoda: ¿te encuentran a ti o a tu competidor? Cada día en la segunda página son clientes que regalas gratis.

Con SEO Start ponemos la base para darle la vuelta. Desde 4 900 SEK/mes obtienes optimización on-page, análisis de palabras clave y un informe mensual claro donde ves la curva subir, negro sobre blanco.

¿Lo mejor? El tráfico que construyes no cuesta nada por clic y no desaparece cuando dejas de anunciarte. ¿Empezamos con un análisis rápido de visibilidad para ver dónde estás hoy?""",
)

T["Säljpitch: SEO Tillväxt"] = (
 "Sales pitch: SEO Growth",
 "Pitch de ventas: SEO Crecimiento",
 """The top spots on Google aren't free – but they're not taken by chance either. Someone works for them every month. With SEO Growth, that someone is you.

From SEK 9,900/mo we drive content, link building and technical SEO offensively and measurably. Position by position we take your most important keywords, and more qualified customers find you – while your competitor wonders what happened.

This is the package for those who are serious about growing. May I show you where you rank today and exactly where we can take you?""",
 """Los primeros puestos en Google no son gratis, pero tampoco se ocupan por azar. Alguien trabaja por ellos cada mes. Con SEO Crecimiento, ese alguien eres tú.

Desde 9 900 SEK/mes impulsamos contenido, link building y SEO técnico de forma ofensiva y medible. Posición a posición conquistamos tus palabras clave más importantes, y más clientes cualificados te encuentran, mientras tu competidor se pregunta qué pasó.

Este es el paquete para quien va en serio con crecer. ¿Te muestro dónde posicionas hoy y exactamente hasta dónde podemos llevarte?""",
)

T["Säljpitch: GEO / AI-synlighet"] = (
 "Sales pitch: GEO / AI visibility",
 "Pitch de ventas: GEO / Visibilidad en IA",
 """Your customers have already started asking ChatGPT and Perplexity instead of googling. And here's the uncomfortable part: if the AI doesn't mention you, you simply don't exist in that conversation. No second chance, no ad space.

GEO is about becoming the one the AI recommends. From SEK 6,900/mo we do a GEO analysis, a concrete action plan and track your AI visibility continuously – on a channel your competitors haven't even thought about yet.

This is the head start that's only available right now. Want to see how AI describes your company today – before someone else takes the spot?""",
 """Tus clientes ya han empezado a preguntar a ChatGPT y Perplexity en lugar de buscar en Google. Y aquí está lo incómodo: si la IA no te menciona, simplemente no existes en esa conversación. Sin segunda oportunidad, sin espacio publicitario.

GEO consiste en convertirte en el que la IA recomienda. Desde 6 900 SEK/mes hacemos un análisis GEO, un plan de acción concreto y seguimos tu visibilidad en IA de forma continua, en un canal en el que tus competidores ni han pensado.

Es la ventaja que solo está disponible ahora mismo. ¿Quieres ver cómo describe la IA tu empresa hoy, antes de que otro tome ese lugar?""",
)

T["Säljpitch: Designpartner"] = (
 "Sales pitch: Design partner",
 "Pitch de ventas: Socio de diseño",
 """Good design makes you look like the market leader – and lets you charge the market leader's prices. But a full-time designer is expensive, and freelancers disappear mid-project.

As a design partner you get a whole design department on subscription. From SEK 9,000/mo: UI/UX and graphic material, priority access and a queue where you submit requests at your own pace. Predictable cost, zero recruitment, always someone ready.

Imagine never being stuck again because you lack a designer. What are your design needs over the coming months?""",
 """Un buen diseño te hace parecer el líder del mercado y te permite cobrar como el líder del mercado. Pero un diseñador a tiempo completo es caro, y los freelance desaparecen a mitad de proyecto.

Como socio de diseño obtienes todo un departamento de diseño por suscripción. Desde 9 000 SEK/mes: UI/UX y material gráfico, acceso prioritario y una cola donde envías solicitudes a tu ritmo. Coste predecible, cero contratación, siempre alguien disponible.

Imagina no volver a bloquearte por falta de un diseñador. ¿Qué necesidades de diseño tienes los próximos meses?""",
)

T["Säljpitch: Logotyp & varumärke"] = (
 "Sales pitch: Logo & brand",
 "Pitch de ventas: Logotipo y marca",
 """A strong brand does two things at once: customers remember you, and they're willing to pay more. A weak brand does the opposite – you become one of the crowd, forced to compete on price.

We create a logo and identity that feels right and lasts for years. From SEK 12,000 you get a logo, colors, typography and a brand guide so everything you do looks consistent and professional – on the site, on social media, on the invoice.

First impressions only happen once. How do you want your customers to perceive you?""",
 """Una marca fuerte hace dos cosas a la vez: los clientes te recuerdan y están dispuestos a pagar más. Una marca débil hace lo contrario: te vuelves uno más, obligado a competir por precio.

Creamos un logotipo y una identidad que encajan y duran años. Desde 12 000 SEK obtienes logotipo, colores, tipografía y una guía de marca para que todo lo que hagas se vea coherente y profesional: en la web, en redes, en la factura.

La primera impresión solo ocurre una vez. ¿Cómo quieres que te perciban tus clientes?""",
)

T["Säljpitch: E-handel Start"] = (
 "Sales pitch: E-commerce Start",
 "Pitch de ventas: E-commerce Start",
 """Picture your store open around the clock, taking payments while you sleep. Starting to sell online doesn't have to be expensive or complicated – and you don't have to wait.

E-commerce Start gives you a complete store on our own platform. From SEK 19,000 setup and SEK 1,490/mo: your own CMS, payment via Klarna or Stripe, shipping, mobile-friendly design and room for up to a hundred products.

You go live now and upgrade as sales grow. Shall we set up your store and get the first order ticking in?""",
 """Imagina tu tienda abierta las 24 horas, cobrando mientras duermes. Empezar a vender online no tiene por qué ser caro ni complicado, y no tienes que esperar.

E-commerce Start te da una tienda completa en nuestra propia plataforma. Desde 19 000 SEK de alta y 1 490 SEK/mes: tu propio CMS, pago con Klarna o Stripe, envíos, diseño adaptado a móvil y espacio para hasta cien productos.

Te pones en marcha ya y amplías a medida que crecen las ventas. ¿Montamos tu tienda y hacemos que entre el primer pedido?""",
)

T["Säljpitch: E-handel Plus"] = (
 "Sales pitch: E-commerce Plus",
 "Pitch de ventas: E-commerce Plus",
 """A store that starts selling but can't grow quickly becomes a bottleneck. E-commerce Plus is built for the next level – more products, more purchases, more automation.

Our most popular e-commerce package: from SEK 35,000 setup and SEK 2,490/mo you get up to a thousand products, multiple payment options, discount codes, customer accounts, newsletters and on-page SEO. All on our own platform that we manage for you.

Every feature is there to raise your average order and bring customers back. Want to see how it would work for your range?""",
 """Una tienda que empieza a vender pero no puede crecer se convierte rápido en un cuello de botella. E-commerce Plus está hecho para el siguiente nivel: más productos, más compras, más automatización.

Nuestro paquete de e-commerce más popular: desde 35 000 SEK de alta y 2 490 SEK/mes obtienes hasta mil productos, varias opciones de pago, códigos de descuento, cuentas de cliente, newsletters y SEO on-page. Todo en nuestra propia plataforma que gestionamos por ti.

Cada función está para subir tu ticket medio y hacer que los clientes vuelvan. ¿Quieres ver cómo funcionaría para tu catálogo?""",
)

T["Säljpitch: E-handel Pro"] = (
 "Sales pitch: E-commerce Pro",
 "Pitch de ventas: E-commerce Pro",
 """When you sell for real, the bottleneck is rarely the store – it's all the manual work around it. Orders typed by hand, stock that doesn't add up, systems that don't talk to each other.

E-commerce Pro is our enterprise level. From SEK 59,000 setup and SEK 4,900/mo: unlimited products, ERP integration with Fortnox or Visma, B2B pricing, real-time stock, multiple languages and currencies, and priority support.

We build an e-commerce that scales with you instead of slowing you down. Which systems does it need to connect to?""",
 """Cuando vendes en serio, el cuello de botella rara vez es la tienda: es todo el trabajo manual alrededor. Pedidos escritos a mano, stock que no cuadra, sistemas que no se hablan.

E-commerce Pro es nuestro nivel enterprise. Desde 59 000 SEK de alta y 4 900 SEK/mes: productos ilimitados, integración ERP con Fortnox o Visma, precios B2B, stock en tiempo real, varios idiomas y monedas, y soporte prioritario.

Construimos un e-commerce que escala contigo en vez de frenarte. ¿A qué sistemas necesita conectarse?""",
)

T["Säljpitch: Startpaket (Hemsida + SEO)"] = (
 "Sales pitch: Starter bundle (Website + SEO)",
 "Pitch de ventas: Paquete inicial (Web + SEO)",
 """A beautiful site with no visitors is a silent shop. Traffic without a selling site is buckets with holes. You need both – from day one.

The Starter bundle combines a business website with ongoing SEO at a discounted price: SEK 18,000 plus SEK 3,900/mo. You get the whole foundation in place – a site that converts and an engine that pulls in traffic every month.

It's the obvious first step for anyone serious about growing digitally. Shall I run the numbers for you?""",
 """Una web bonita sin visitas es una tienda en silencio. Tráfico sin una web que venda son cubos con agujeros. Necesitas ambos, desde el primer día.

El Paquete inicial combina una web corporativa con SEO continuo a precio rebajado: 18 000 SEK más 3 900 SEK/mes. Tienes toda la base lista: una web que convierte y un motor que atrae tráfico cada mes.

Es el primer paso evidente para quien va en serio con crecer en digital. ¿Te hago los números?""",
)

T["Säljpitch: Tillväxtpaket"] = (
 "Sales pitch: Growth bundle",
 "Pitch de ventas: Paquete de crecimiento",
 """Want to not just be seen but take market share? Then doing one thing well isn't enough – it's the whole that wins. The Growth bundle gives you the entire engine.

From SEK 25,000 plus SEK 14,900/mo we combine a selling website, offensive SEO and GEO in one – so you dominate both Google and AI search while competitors tackle one channel at a time.

This is the package for those who want to move positions fast and measurably. Want to see a concrete plan for the next three months?""",
 """¿Quieres no solo aparecer, sino ganar cuota de mercado? Entonces hacer una sola cosa bien no basta: gana el conjunto. El Paquete de crecimiento te da el motor completo.

Desde 25 000 SEK más 14 900 SEK/mes combinamos una web que vende, SEO ofensivo y GEO en uno: dominas Google y la búsqueda con IA mientras la competencia ataca un canal cada vez.

Es el paquete para quien quiere avanzar posiciones rápido y de forma medible. ¿Quieres ver un plan concreto para los próximos tres meses?""",
)

T["Säljpitch: MVP-paket (MVP + Designpartner)"] = (
 "Sales pitch: MVP bundle (MVP + Design partner)",
 "Pitch de ventas: Paquete MVP (MVP + Socio de diseño)",
 """A product that works but looks cheap loses both customers and investors. A beautiful product that doesn't work does the same. The winner has both – from the start.

The MVP bundle combines an MVP with an ongoing design partner. From SEK 29,000 plus SEK 7,000/mo you get a working product and continuous design that refines it further – at a discounted design rate.

It's the setup for startups that want to move fast without compromising on the impression. Tell me about your idea and I'll show you how we get going this month.""",
 """Un producto que funciona pero parece barato pierde clientes e inversores. Un producto bonito que no funciona, igual. El ganador tiene ambos, desde el principio.

El Paquete MVP combina un MVP con un socio de diseño continuo. Desde 29 000 SEK más 7 000 SEK/mes obtienes un producto funcional y diseño continuo que lo refina, a un precio de diseño rebajado.

Es la fórmula para startups que quieren moverse rápido sin sacrificar la imagen. Cuéntame tu idea y te muestro cómo arrancamos este mes.""",
)

T["Säljpitch: Full digital närvaro"] = (
 "Sales pitch: Full digital presence",
 "Pitch de ventas: Presencia digital completa",
 """Digital is no longer something you do on the side – it's where the business is won. But juggling ten different suppliers for site, SEO, GEO and design steals time you'd rather spend on your customers.

Full digital presence gathers everything under one roof: website or app, SEO, GEO and design, with a dedicated contact who knows your business. We put together a tailored quote based on your goals.

You focus on what you do best – we own the digital and make it deliver. Shall we book a meeting and map out your full potential?""",
 """Lo digital ya no es algo que haces aparte: es donde se gana el negocio. Pero hacer malabares con diez proveedores distintos para web, SEO, GEO y diseño roba tiempo que preferirías dedicar a tus clientes.

Presencia digital completa lo reúne todo bajo un mismo techo: web o app, SEO, GEO y diseño, con un contacto dedicado que conoce tu negocio. Preparamos un presupuesto a medida según tus objetivos.

Tú te centras en lo que mejor haces; nosotros nos hacemos cargo de lo digital y hacemos que rinda. ¿Reservamos una reunión y trazamos todo tu potencial?""",
)

# ── Scripts ─────────────────────────────────────────────────────────────────
T["Manus: Kallt samtal"] = (
 "Script: Cold call",
 "Guion: Llamada en frío",
 """Opening: Hi [name], this is [your name] from Applabbet. I'll keep it short and I know I'm interrupting something – give me 30 seconds to explain why I'm calling, then you tell me if it's interesting?

Hook: We help companies like yours win more customers through their website, SEO and AI visibility. I noticed [concrete observation about their site or industry] and thought there might be something to gain here.

Qualify: How do you work on bringing in new customers digitally today?

Goal – book the meeting: This is best taken on a short video call where I show you concretely what we see. Does Tuesday at 10 or Thursday at 2 work?

Remember: the goal of the call isn't to sell – it's to book the meeting. Be short, curious, and listen more than you talk.""",
 """Apertura: Hola [nombre], soy [tu nombre] de Applabbet. Seré breve y sé que interrumpo algo: dame 30 segundos para explicarte por qué llamo y luego me dices si te interesa.

Gancho: Ayudamos a empresas como la tuya a conseguir más clientes mediante su web, SEO y visibilidad en IA. Vi que [observación concreta sobre su web o sector] y pensé que quizá haya algo que ganar aquí.

Calificar: ¿Cómo trabajáis hoy para conseguir nuevos clientes en digital?

Objetivo – agendar la reunión: Esto se ve mejor en una videollamada corta donde te muestro en concreto lo que vemos. ¿Te va el martes a las 10 o el jueves a las 14?

Recuerda: el objetivo de la llamada no es vender, es agendar la reunión. Sé breve, curioso y escucha más de lo que hablas.""",
)

T["Manus: Första mötet"] = (
 "Script: First meeting",
 "Guion: Primera reunión",
 """1. Build rapport: Thank them for their time, make brief small talk and set the agenda. I thought we'd start with me getting to know your business, then I'll show how we can help, and we'll see if it's a good fit. Sound good?

2. Needs analysis – spend most time here: Ask open questions and listen. What are your goals for the coming year? How do you get customers today? What works and what chafes? What would happen if you got twice as many enquiries?

3. Pitch – tie it to their answers: Present only what solves what they told you. You said this was your biggest challenge – that's exactly what this package solves.

4. Handle objections: Acknowledge, turn to value and ask a question. See objection handling.

5. Close: Propose the next step concretely. I'll prepare a proposal and a quote by Friday, and we'll go through it together. Does that work? Book the time before you finish.""",
 """1. Crear sintonía: Agradéceles su tiempo, haz una breve charla informal y fija la agenda. He pensado empezar conociendo vuestro negocio, luego os muestro cómo podemos ayudar y vemos si encaja. ¿Os parece bien?

2. Análisis de necesidades – dedica aquí la mayor parte del tiempo: Haz preguntas abiertas y escucha. ¿Cuáles son vuestros objetivos para el próximo año? ¿Cómo conseguís clientes hoy? ¿Qué funciona y qué molesta? ¿Qué pasaría si recibierais el doble de solicitudes?

3. Pitch – conéctalo con sus respuestas: Presenta solo lo que resuelve lo que te contaron. Dijiste que este era vuestro mayor reto: es justo lo que resuelve este paquete.

4. Maneja objeciones: Reconoce, convierte en valor y haz una pregunta. Consulta el manejo de objeciones.

5. Cierre: Propón el siguiente paso en concreto. Preparo una propuesta y un presupuesto para el viernes y lo revisamos juntos. ¿Te va bien? Agenda la hora antes de terminar.""",
)

# ── Objections ──────────────────────────────────────────────────────────────
T["Invändning: Det är för dyrt"] = (
 "Objection: It's too expensive",
 "Objeción: Es demasiado caro",
 """When someone says it's too expensive, they usually mean they don't see the value yet – not that the money is missing. Acknowledge, then turn the conversation to return.

Reply: I understand, it's an investment. May I ask – what is a new customer worth to you? If the site brings in just one extra customer a month, it's paid for itself. We can also start at a smaller level and build on when it delivers results.

Question: What would need to happen for this to feel like an obvious investment?""",
 """Cuando alguien dice que es demasiado caro, suele significar que aún no ve el valor, no que falte el dinero. Reconócelo y lleva la conversación al retorno.

Respuesta: Lo entiendo, es una inversión. ¿Puedo preguntar cuánto vale un cliente nuevo para ti? Si la web trae solo un cliente extra al mes, ya se ha pagado sola. También podemos empezar con un nivel más pequeño y ampliar cuando dé resultados.

Pregunta: ¿Qué tendría que pasar para que esto te pareciera una inversión evidente?""",
)

T["Invändning: Vi har redan en hemsida"] = (
 "Objection: We already have a website",
 "Objeción: Ya tenemos una web",
 """That they have a website is good – it means they understand the value. The question is whether it performs.

Reply: Great, then you already have the foundation. May I ask – how many customers or leads does it bring in a month? Many websites are pretty brochures that don't sell. We can do a quick analysis and show you exactly where you're losing visitors.

Question: Shall I run a free analysis of your current site so you can see how it holds up?""",
 """Que tengan una web es bueno: significa que entienden el valor. La cuestión es si rinde.

Respuesta: Estupendo, entonces ya tenéis la base. ¿Puedo preguntar cuántos clientes o leads trae al mes? Muchas webs son folletos bonitos que no venden. Podemos hacer un análisis rápido y mostraros exactamente dónde perdéis visitantes.

Pregunta: ¿Hago un análisis gratuito de vuestra web actual para que veáis cómo está?""",
)

T["Invändning: Vi gör det själva internt"] = (
 "Objection: We do it ourselves in-house",
 "Objeción: Lo hacemos nosotros internamente",
 """Respect the competence, but point to time and opportunity cost.

Reply: It's impressive that you have the skills in-house. The question is whether that's where you make the most money – every hour on the website or SEO is an hour away from your core business. We do it faster so you can focus on what you do best.

Question: What would you rather spend those hours on?""",
 """Respeta la competencia, pero señala el tiempo y el coste de oportunidad.

Respuesta: Es admirable que tengáis la capacidad internamente. La cuestión es si ahí es donde más dinero ganáis: cada hora en la web o el SEO es una hora fuera de vuestro negocio principal. Nosotros lo hacemos más rápido para que os centréis en lo que mejor hacéis.

Pregunta: ¿En qué preferiríais invertir esas horas?""",
)

T["Invändning: Vi har ingen tid just nu"] = (
 "Objection: We have no time right now",
 "Objeción: Ahora mismo no tenemos tiempo",
 """Lack of time is often a question of priorities. Make it easy and low-threshold.

Reply: That's exactly why we're a good partner – we handle pretty much everything for you, you just need a short check-in. And the best time to build visibility is before you need it. Shall we book 20 minutes next week, with no obligation?

Question: Which day suits best – Tuesday or Thursday?""",
 """La falta de tiempo suele ser una cuestión de prioridades. Hazlo fácil y de bajo compromiso.

Respuesta: Justo por eso somos un buen socio: nos encargamos de prácticamente todo por vosotros, solo necesitáis una breve puesta al día. Y el mejor momento para construir visibilidad es antes de necesitarla. ¿Reservamos 20 minutos la próxima semana, sin compromiso?

Pregunta: ¿Qué día os viene mejor, el martes o el jueves?""",
)

T["Invändning: Skicka information så återkommer vi"] = (
 "Objection: Send some information and we'll get back to you",
 "Objeción: Envíanos información y os contactamos",
 """The classic polite brush-off. Keep the initiative without being pushy.

Reply: Absolutely, I'll gladly send something. To make it relevant – what matters most to you right now: more customers, a more modern site or better visibility? Then I'll send examples that fit you, and we'll have a quick check-in later this week.

Question: Does a short follow-up on Friday work?""",
 """El clásico rechazo cortés. Mantén la iniciativa sin ser insistente.

Respuesta: Por supuesto, te envío algo con gusto. Para que sea relevante, ¿qué es lo más importante para ti ahora: más clientes, una web más moderna o mejor visibilidad? Así te mando ejemplos que encajen y hacemos una breve puesta al día más adelante esta semana.

Pregunta: ¿Te va bien un seguimiento corto el viernes?""",
)

T["Invändning: Vi är nöjda med vår nuvarande leverantör"] = (
 "Objection: We're happy with our current supplier",
 "Objeción: Estamos contentos con nuestro proveedor actual",
 """Never attack the competitor. Plant a seed and keep the door open.

Reply: Great that you have someone you're happy with – that's valuable. We don't need to replace them. Many customers use us as a complement for things like SEO or GEO, which are often missing. May I show what you could add?

Question: What does your current supplier do really well – and what are you missing?""",
 """Nunca ataques al competidor. Siembra una semilla y deja la puerta abierta.

Respuesta: Qué bien que tengáis a alguien con quien estáis a gusto, eso vale mucho. No hace falta reemplazarlos. Muchos clientes nos usan como complemento para cosas como SEO o GEO, que suelen faltar. ¿Os muestro qué podríais añadir?

Pregunta: ¿Qué hace muy bien vuestro proveedor actual y qué echáis en falta?""",
)

T["Invändning: Funkar SEO och GEO verkligen?"] = (
 "Objection: Do SEO and GEO really work?",
 "Objeción: ¿De verdad funcionan el SEO y el GEO?",
 """Meet skepticism with concrete examples and measurability.

Reply: You're right to be critical – there are a lot of empty promises in this industry. The difference is that we measure everything – you see ranking, traffic and leads in black and white every month. And GEO is new: your competitors aren't showing up in ChatGPT yet, which is your head start.

Question: Shall I show how you rank today and what's possible in three months?""",
 """Responde al escepticismo con ejemplos concretos y mensurabilidad.

Respuesta: Haces bien en ser crítico: hay muchas promesas vacías en este sector. La diferencia es que nosotros lo medimos todo: ves ranking, tráfico y leads negro sobre blanco cada mes. Y el GEO es nuevo: tus competidores aún no aparecen en ChatGPT, y esa es tu ventaja.

Pregunta: ¿Te muestro cómo posicionas hoy y qué es posible en tres meses?""",
)

T["Invändning: Vi måste tänka på det"] = (
 "Objection: We need to think about it",
 "Objeción: Tenemos que pensarlo",
 """A soft no often hides an uncertainty. Find out what's blocking it.

Reply: Of course, smart not to rush. May I ask – is it the price, the timing or something else you want to think over? Then I can help you with that specific part instead of you sitting and pondering on your own.

Question: What's the biggest question that needs answering for you to feel confident?""",
 """Un no suave suele esconder una duda. Averigua qué lo frena.

Respuesta: Por supuesto, es sensato no precipitarse. ¿Puedo preguntar si es el precio, el momento u otra cosa lo que queréis meditar? Así os ayudo justo con esa parte en lugar de que le deis vueltas solos.

Pregunta: ¿Cuál es la mayor duda que hay que resolver para que os sintáis seguros?""",
)


def write_process():
    path = os.path.join(MIG_DIR, "20260619150000_sales_process_example.sql")
    sql = f"""-- Add a worked sales-process example under Säljmanus (sv/en/es), shown first.
INSERT INTO public.training_items
  (category_id, title, title_en, title_es, body, body_en, body_es, sort_order, is_published)
SELECT cat.id, {slit(PROC_SV_TITLE)}, {slit(PROC_EN_TITLE)}, {slit(PROC_ES_TITLE)},
       {jlit(PROC_SV)}, {jlit(PROC_EN)}, {jlit(PROC_ES)}, 0, true
FROM public.training_categories cat
WHERE cat.slug = 'saljmanus'
  AND NOT EXISTS (
    SELECT 1 FROM public.training_items ti
    WHERE ti.category_id = cat.id AND ti.title = {slit(PROC_SV_TITLE)}
  );
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(sql)
    print("wrote", path)


def write_seed():
    path = os.path.join(MIG_DIR, "20260619160000_training_translations_seed.sql")
    rows = []
    for sv_title, (en_title, es_title, en_body, es_body) in T.items():
        rows.append(
            f"  ({slit(sv_title)}, {slit(en_title)}, {slit(es_title)}, "
            f"{jlit(en_body)}, {jlit(es_body)})"
        )
    values = ",\n".join(rows)
    sql = f"""-- Seed en/es translations for the Säljmanus items (pitches, scripts,
-- objections). Matches existing rows by their Swedish title and fills the
-- *_en / *_es columns; the UI falls back to Swedish where these are null.
UPDATE public.training_items ti
SET title_en = v.title_en,
    title_es = v.title_es,
    body_en  = v.body_en,
    body_es  = v.body_es
FROM (VALUES
{values}
) AS v(title_sv, title_en, title_es, body_en, body_es)
JOIN public.training_categories cat ON cat.slug = 'saljmanus'
WHERE ti.category_id = cat.id AND ti.title = v.title_sv;
"""
    with open(path, "w", encoding="utf-8") as f:
        f.write(sql)
    print("wrote", path)


if __name__ == "__main__":
    write_process()
    write_seed()
