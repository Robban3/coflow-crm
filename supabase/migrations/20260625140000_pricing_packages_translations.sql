-- One-time backfill of EN/ES translations for the seeded pricing packages.
-- Matches on (category, name) and only fills rows where the English variant is
-- still empty, so manual edits and re-runs are never clobbered. Currency stays
-- "kr" (Swedish kronor); thousands use comma in EN and space in ES.

-- ── Hemsidor → Websites / Sitios web ────────────────────────────────────────
UPDATE public.pricing_packages SET
  category_en='Websites', category_es='Sitios web',
  name_en='Landing page', name_es='Página de aterrizaje',
  price_en='from 9,000 kr', price_es='desde 9 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Perfect for campaigns and launches', description_es='Perfecto para campañas y lanzamientos',
  features_en='["1 page","Mobile-friendly","Contact form","Basic SEO"]'::jsonb,
  features_es='["1 página","Adaptado a móvil","Formulario de contacto","SEO básico"]'::jsonb
WHERE category='Hemsidor' AND name='Landningssida' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Websites', category_es='Sitios web',
  name_en='Business website', name_es='Sitio web de empresa',
  price_en='18,000 kr', price_es='18 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Our most popular – a complete site', description_es='El más popular: un sitio completo',
  features_en='["Up to 7 pages","CMS – update it yourself","Responsive design","On-page SEO","Google Analytics"]'::jsonb,
  features_es='["Hasta 7 páginas","CMS: actualízalo tú mismo","Diseño responsive","SEO on-page","Google Analytics"]'::jsonb
WHERE category='Hemsidor' AND name='Företagshemsida' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Websites', category_es='Sitios web',
  name_en='E-commerce', name_es='Comercio electrónico',
  price_en='from 35,000 kr', price_es='desde 35 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Sell online', description_es='Vende en línea',
  features_en='["Online shop","Payment solution","Product catalogue","SEO-optimised"]'::jsonb,
  features_es='["Tienda online","Solución de pago","Catálogo de productos","Optimizado para SEO"]'::jsonb
WHERE category='Hemsidor' AND name='E-handel' AND name_en IS NULL;

-- ── MVP & Appar → MVP & Apps / MVP y apps ───────────────────────────────────
UPDATE public.pricing_packages SET
  category_en='MVP & Apps', category_es='MVP y apps',
  name_en='MVP', name_es='MVP',
  price_en='from 29,000 kr', price_es='desde 29 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Validate your idea fast', description_es='Valida tu idea rápido',
  features_en='["Functional MVP","Core features","Delivered in 4–6 weeks","Source code included"]'::jsonb,
  features_es='["MVP funcional","Funciones esenciales","Entrega en 4–6 semanas","Código fuente incluido"]'::jsonb
WHERE category='MVP & Appar' AND name='MVP' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='MVP & Apps', category_es='MVP y apps',
  name_en='Web app', name_es='Aplicación web',
  price_en='from 49,000 kr', price_es='desde 49 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Tailor-made web application', description_es='Aplicación web a medida',
  features_en='["Login & roles","Database","Admin panel","Scalable architecture"]'::jsonb,
  features_es='["Inicio de sesión y roles","Base de datos","Panel de administración","Arquitectura escalable"]'::jsonb
WHERE category='MVP & Appar' AND name='Webbapp' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='MVP & Apps', category_es='MVP y apps',
  name_en='Mobile app (iOS & Android)', name_es='App móvil (iOS y Android)',
  price_en='from 79,000 kr', price_es='desde 79 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Cross-platform app', description_es='App multiplataforma',
  features_en='["iOS + Android","Publishing to App Store & Google Play","Push notifications","Backend included"]'::jsonb,
  features_es='["iOS + Android","Publicación en App Store y Google Play","Notificaciones push","Backend incluido"]'::jsonb
WHERE category='MVP & Appar' AND name='Mobilapp (iOS & Android)' AND name_en IS NULL;

-- ── SEO & GEO → SEO & GEO / SEO y GEO ───────────────────────────────────────
UPDATE public.pricing_packages SET
  category_en='SEO & GEO', category_es='SEO y GEO',
  name_en='SEO Start', name_es='SEO Start',
  price_en='from 4,900 kr', price_es='desde 4 900 kr',
  unit_en='/mo', unit_es='/mes',
  description_en='Get started with visibility', description_es='Empieza con la visibilidad',
  features_en='["On-page optimisation","Keyword research","Monthly report"]'::jsonb,
  features_es='["Optimización on-page","Análisis de palabras clave","Informe mensual"]'::jsonb
WHERE category='SEO & GEO' AND name='SEO Start' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='SEO & GEO', category_es='SEO y GEO',
  name_en='SEO Growth', name_es='SEO Crecimiento',
  price_en='from 9,900 kr', price_es='desde 9 900 kr',
  unit_en='/mo', unit_es='/mes',
  description_en='For those who want to grow', description_es='Para quienes quieren crecer',
  features_en='["Content production","Link building","Technical SEO","Ongoing optimisation"]'::jsonb,
  features_es='["Producción de contenido","Construcción de enlaces","SEO técnico","Optimización continua"]'::jsonb
WHERE category='SEO & GEO' AND name='SEO Tillväxt' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='SEO & GEO', category_es='SEO y GEO',
  name_en='GEO / AI visibility', name_es='GEO / Visibilidad IA',
  price_en='from 6,900 kr', price_es='desde 6 900 kr',
  unit_en='/mo', unit_es='/mes',
  description_en='Get seen in ChatGPT, Perplexity & AI search', description_es='Aparece en ChatGPT, Perplexity y búsqueda con IA',
  features_en='["GEO analysis","Action plan","AI visibility report","Ongoing follow-up"]'::jsonb,
  features_es='["Análisis GEO","Plan de acción","Informe de visibilidad IA","Seguimiento continuo"]'::jsonb
WHERE category='SEO & GEO' AND name='GEO / AI-synlighet' AND name_en IS NULL;

-- ── Design → Design / Diseño ────────────────────────────────────────────────
UPDATE public.pricing_packages SET
  category_en='Design', category_es='Diseño',
  name_en='Design partner', name_es='Socio de diseño',
  price_en='from 9,000 kr', price_es='desde 9 000 kr',
  unit_en='/mo', unit_es='/mes',
  description_en='Ongoing design whenever you need it', description_es='Diseño continuo cuando lo necesites',
  features_en='["UI/UX design","Graphic assets","Priority access","Queued requests"]'::jsonb,
  features_es='["Diseño UI/UX","Material gráfico","Acceso prioritario","Solicitudes en cola"]'::jsonb
WHERE category='Design' AND name='Designpartner' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Design', category_es='Diseño',
  name_en='Logo & brand', name_es='Logotipo y marca',
  price_en='from 12,000 kr', price_es='desde 12 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Build a strong brand', description_es='Construye una marca fuerte',
  features_en='["Logo","Colour & typography","Brand guide"]'::jsonb,
  features_es='["Logotipo","Color y tipografía","Guía de marca"]'::jsonb
WHERE category='Design' AND name='Logotyp & varumärke' AND name_en IS NULL;

-- ── Paket & kombinationer → Packages & bundles / Paquetes y combinaciones ────
UPDATE public.pricing_packages SET
  category_en='Packages & bundles', category_es='Paquetes y combinaciones',
  name_en='Starter bundle', name_es='Paquete inicial',
  price_en='18,000 kr + 3,900 kr/mo', price_es='18 000 kr + 3 900 kr/mes',
  unit_en='combo', unit_es='combo',
  description_en='Website + SEO Start', description_es='Sitio web + SEO Start',
  features_en='["Business website","SEO Start","Discounted monthly price"]'::jsonb,
  features_es='["Sitio web de empresa","SEO Start","Precio mensual con descuento"]'::jsonb
WHERE category='Paket & kombinationer' AND name='Startpaket' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Packages & bundles', category_es='Paquetes y combinaciones',
  name_en='Growth bundle', name_es='Paquete de crecimiento',
  price_en='from 25,000 kr + 14,900 kr/mo', price_es='desde 25 000 kr + 14 900 kr/mes',
  unit_en='combo', unit_es='combo',
  description_en='Website + SEO Growth + GEO', description_es='Sitio web + SEO Crecimiento + GEO',
  features_en='["Business website","SEO Growth","GEO / AI visibility","Best for fast growth"]'::jsonb,
  features_es='["Sitio web de empresa","SEO Crecimiento","GEO / Visibilidad IA","Ideal para crecer rápido"]'::jsonb
WHERE category='Paket & kombinationer' AND name='Tillväxtpaket' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Packages & bundles', category_es='Paquetes y combinaciones',
  name_en='MVP bundle', name_es='Paquete MVP',
  price_en='from 29,000 kr + 7,000 kr/mo', price_es='desde 29 000 kr + 7 000 kr/mes',
  unit_en='combo', unit_es='combo',
  description_en='MVP + Design partner', description_es='MVP + Socio de diseño',
  features_en='["MVP development","Ongoing design partner","Discounted design price"]'::jsonb,
  features_es='["Desarrollo de MVP","Socio de diseño continuo","Precio de diseño con descuento"]'::jsonb
WHERE category='Paket & kombinationer' AND name='MVP-paket' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='Packages & bundles', category_es='Paquetes y combinaciones',
  name_en='Full digital presence', name_es='Presencia digital completa',
  price_en='Contact us', price_es='Contáctanos',
  unit_en='quote', unit_es='presupuesto',
  description_en='All-in-one for maximum impact', description_es='Todo en uno para el máximo impacto',
  features_en='["Website or app","SEO + GEO","Design partner","Dedicated contact person"]'::jsonb,
  features_es='["Sitio web o app","SEO + GEO","Socio de diseño","Persona de contacto dedicada"]'::jsonb
WHERE category='Paket & kombinationer' AND name='Full digital närvaro' AND name_en IS NULL;

-- ── E-handel → E-commerce / Comercio electrónico ────────────────────────────
UPDATE public.pricing_packages SET
  category_en='E-commerce', category_es='Comercio electrónico',
  name_en='E-commerce Start', name_es='E-commerce Start',
  price_en='from 19,000 kr', price_es='desde 19 000 kr',
  unit_en='setup', unit_es='instalación',
  description_en='For smaller stores', description_es='Para tiendas pequeñas',
  features_en='["Platform: from 1,490 kr/mo","Own CMS","Up to ~100 products","Payment (Klarna/Stripe)","Shipping & mobile-friendly","Basic SEO"]'::jsonb,
  features_es='["Plataforma: desde 1 490 kr/mes","CMS propio","Hasta ~100 productos","Pago (Klarna/Stripe)","Envío y adaptado a móvil","SEO básico"]'::jsonb
WHERE category='E-handel' AND name='E-handel Start' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='E-commerce', category_es='Comercio electrónico',
  name_en='E-commerce Plus', name_es='E-commerce Plus',
  price_en='from 35,000 kr', price_es='desde 35 000 kr',
  unit_en='setup', unit_es='instalación',
  description_en='Our most popular – for growing stores', description_es='El más popular: para tiendas en crecimiento',
  features_en='["Platform: from 2,490 kr/mo","Up to ~1,000 products","Multiple payment options","Discount codes & customer accounts","Newsletter integration","On-page SEO + GA/Pixel"]'::jsonb,
  features_es='["Plataforma: desde 2 490 kr/mes","Hasta ~1 000 productos","Varias soluciones de pago","Códigos de descuento y cuentas de cliente","Integración de boletín","SEO on-page + GA/Pixel"]'::jsonb
WHERE category='E-handel' AND name='E-handel Plus' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='E-commerce', category_es='Comercio electrónico',
  name_en='E-commerce Pro', name_es='E-commerce Pro',
  price_en='from 59,000 kr', price_es='desde 59 000 kr',
  unit_en='setup / quote', unit_es='instalación / presupuesto',
  description_en='Large catalogues & integrations', description_es='Catálogos grandes e integraciones',
  features_en='["Platform: from 4,900 kr/mo","Unlimited products","ERP integration (Fortnox/Visma)","B2B pricing & stock levels","Multiple languages & currencies","Priority support (SLA)"]'::jsonb,
  features_es='["Plataforma: desde 4 900 kr/mes","Productos ilimitados","Integración ERP (Fortnox/Visma)","Precios B2B y existencias","Varios idiomas y monedas","Soporte prioritario (SLA)"]'::jsonb
WHERE category='E-handel' AND name='E-handel Pro' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='E-commerce', category_es='Comercio electrónico',
  name_en='Add-on: ERP integration', name_es='Complemento: integración ERP',
  price_en='from 9,000 kr', price_es='desde 9 000 kr',
  unit_en='one-time', unit_es='pago único',
  description_en='Connect your store to your ERP', description_es='Conecta tu tienda con tu ERP',
  features_en='["Fortnox / Visma / Specter","Order & stock sync","Automatic invoices"]'::jsonb,
  features_es='["Fortnox / Visma / Specter","Sincronización de pedidos y stock","Facturas automáticas"]'::jsonb
WHERE category='E-handel' AND name='Tillägg: Affärssystem-integration' AND name_en IS NULL;

UPDATE public.pricing_packages SET
  category_en='E-commerce', category_es='Comercio electrónico',
  name_en='Add-on: Extra language & currency', name_es='Complemento: idioma y moneda extra',
  price_en='from 4,900 kr', price_es='desde 4 900 kr',
  unit_en='per language', unit_es='por idioma',
  description_en='Sell internationally', description_es='Vende internacionalmente',
  features_en='["Translated store","Local currencies","Geo-based shipping"]'::jsonb,
  features_es='["Tienda traducida","Monedas locales","Envío según geolocalización"]'::jsonb
WHERE category='E-handel' AND name='Tillägg: Extra språk & valuta' AND name_en IS NULL;
