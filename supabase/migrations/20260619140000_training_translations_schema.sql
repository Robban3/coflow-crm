-- Add per-language columns so training content (categories + items) can be
-- shown in sv/en/es. The base columns (name/title/body) hold Swedish; the
-- *_en / *_es columns hold optional translations and the UI falls back to the
-- base column when a translation is missing.
ALTER TABLE public.training_categories
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_es text;

ALTER TABLE public.training_items
  ADD COLUMN IF NOT EXISTS title_en text,
  ADD COLUMN IF NOT EXISTS title_es text,
  ADD COLUMN IF NOT EXISTS body_en  jsonb,
  ADD COLUMN IF NOT EXISTS body_es  jsonb;

-- Translate the standard category names (sidebar submenus).
UPDATE public.training_categories AS c
SET name_en = v.en, name_es = v.es
FROM (VALUES
  ('onboarding',     'Onboarding',        'Incorporación'),
  ('saljprocess',    'Sales process',     'Proceso de ventas'),
  ('produktkunskap', 'Product knowledge', 'Conocimiento del producto'),
  ('kurser',         'Courses',           'Cursos'),
  ('saljmanus',      'Sales scripts',     'Guiones de ventas'),
  ('faq',            'FAQ',               'Preguntas frecuentes'),
  ('videor',         'Videos',            'Vídeos'),
  ('dokument',       'Documents',         'Documentos'),
  ('quiz',           'Quiz',              'Cuestionario'),
  ('sandbox',        'Sandbox',           'Sandbox')
) AS v(slug, en, es)
WHERE c.slug = v.slug;
