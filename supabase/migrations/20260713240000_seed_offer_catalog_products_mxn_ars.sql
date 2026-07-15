-- Spanish package catalogues for Mexico (MXN) and Argentina (ARS). Separate
-- product sets named "<name> (MX)" / "(AR)". Prices = SEK × rate (MXN 1.8,
-- ARS 153), rounded. Local VAT: Mexico IVA 16%, Argentina IVA 21%.
-- Idempotent per (organization_id, name).

-- ── Mexico (MXN, ×1.8, VAT 16%) ──────────────────────────────────────────────
INSERT INTO public.products (organization_id, name, description, unit_price, unit, vat_rate, is_active)
SELECT o.id, v.name, v.description, v.unit_price, v.unit, 16, true
FROM public.organizations o
CROSS JOIN (VALUES
  ('Página de aterrizaje (MX)', 'Página de aterrizaje enfocada para campañas/lanzamientos (Astro).', 16200, 'ud'),
  ('Sitio web corporativo (MX)', 'Sitio web corporativo de varias páginas, hasta 7 páginas (Astro). CMS propio incluido.', 32400, 'ud'),
  ('Sitio web dinámico / App web (MX)', 'Inicio de sesión, reservas, calculadora, portal de clientes (React).', 88200, 'ud'),
  ('E-commerce Start (MX)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $2,700/mes aparte.', 34200, 'ud'),
  ('E-commerce Plus (MX)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $4,500/mes aparte.', 63000, 'ud'),
  ('E-commerce Pro (MX)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $8,800/mes aparte.', 106200, 'ud'),
  ('Integración ERP/contabilidad (MX)', 'Complemento e-commerce (integración con ERP/sistema contable).', 16200, 'ud'),
  ('Idioma y moneda adicional (MX)', 'Complemento, por idioma.', 8800, 'ud'),
  ('MVP (MX)', 'Función central validada (React), 4–6 semanas.', 52200, 'ud'),
  ('App web (MX)', 'Aplicación web lista para producción (React).', 88200, 'ud'),
  ('App móvil (MX)', 'iOS + Android (React Native).', 142200, 'ud'),
  ('Logotipo y marca (MX)', 'Logotipo, paleta de colores, tipografía, guía de marca.', 21600, 'ud'),
  ('SEO Start (MX)', 'Optimización on-page, análisis de palabras clave, informe mensual.', 8800, 'mes'),
  ('SEO Crecimiento (MX)', 'Contenido, link building, SEO técnico, optimización continua.', 17800, 'mes'),
  ('Visibilidad IA Start (MX)', 'Optimización GEO base, schema markup, informe mensual.', 8800, 'mes'),
  ('Visibilidad IA Crecimiento (MX)', 'GEO avanzado, estrategia de contenidos, informes semanales.', 16000, 'mes'),
  ('Visibilidad IA Dominate (MX)', 'Optimización completa, monitoreo de competencia, asesor dedicado.', 26800, 'mes'),
  ('Nuevo sitio optimizado para IA (MX)', 'Reconstrucción del sitio, complemento de visibilidad IA.', 32400, 'ud'),
  ('Socio de diseño (MX)', 'Socio de diseño continuo.', 16200, 'mes')
) AS v(name, description, unit_price, unit)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.organization_id = o.id AND p.name = v.name);

-- ── Argentina (ARS, ×153, VAT 21%) ───────────────────────────────────────────
INSERT INTO public.products (organization_id, name, description, unit_price, unit, vat_rate, is_active)
SELECT o.id, v.name, v.description, v.unit_price, v.unit, 21, true
FROM public.organizations o
CROSS JOIN (VALUES
  ('Página de aterrizaje (AR)', 'Página de aterrizaje enfocada para campañas/lanzamientos (Astro).', 1377000, 'ud'),
  ('Sitio web corporativo (AR)', 'Sitio web corporativo de varias páginas, hasta 7 páginas (Astro). CMS propio incluido.', 2754000, 'ud'),
  ('Sitio web dinámico / App web (AR)', 'Inicio de sesión, reservas, calculadora, portal de clientes (React).', 7497000, 'ud'),
  ('E-commerce Start (AR)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $228.000/mes aparte.', 2907000, 'ud'),
  ('E-commerce Plus (AR)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $381.000/mes aparte.', 5355000, 'ud'),
  ('E-commerce Pro (AR)', 'Plataforma propia de e-commerce. Puesta en marcha — cuota de operación $750.000/mes aparte.', 9027000, 'ud'),
  ('Integración ERP/contabilidad (AR)', 'Complemento e-commerce (integración con ERP/sistema contable).', 1377000, 'ud'),
  ('Idioma y moneda adicional (AR)', 'Complemento, por idioma.', 750000, 'ud'),
  ('MVP (AR)', 'Función central validada (React), 4–6 semanas.', 4437000, 'ud'),
  ('App web (AR)', 'Aplicación web lista para producción (React).', 7497000, 'ud'),
  ('App móvil (AR)', 'iOS + Android (React Native).', 12087000, 'ud'),
  ('Logotipo y marca (AR)', 'Logotipo, paleta de colores, tipografía, guía de marca.', 1836000, 'ud'),
  ('SEO Start (AR)', 'Optimización on-page, análisis de palabras clave, informe mensual.', 750000, 'mes'),
  ('SEO Crecimiento (AR)', 'Contenido, link building, SEO técnico, optimización continua.', 1515000, 'mes'),
  ('Visibilidad IA Start (AR)', 'Optimización GEO base, schema markup, informe mensual.', 750000, 'mes'),
  ('Visibilidad IA Crecimiento (AR)', 'GEO avanzado, estrategia de contenidos, informes semanales.', 1362000, 'mes'),
  ('Visibilidad IA Dominate (AR)', 'Optimización completa, monitoreo de competencia, asesor dedicado.', 2280000, 'mes'),
  ('Nuevo sitio optimizado para IA (AR)', 'Reconstrucción del sitio, complemento de visibilidad IA.', 2754000, 'ud'),
  ('Socio de diseño (AR)', 'Socio de diseño continuo.', 1377000, 'mes')
) AS v(name, description, unit_price, unit)
WHERE NOT EXISTS (SELECT 1 FROM public.products p WHERE p.organization_id = o.id AND p.name = v.name);
