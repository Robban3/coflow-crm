-- Add a short description per quiz pointing to its source course (sv/en/es).
UPDATE public.quizzes q
SET description = v.description,
    description_en = v.description_en,
    description_es = v.description_es
FROM (VALUES
  ('grundkurs', 'Baserat på kursen "Grundkurs: Sälj från A till Ö".', 'Based on the course "Foundation course: Selling from A to Z".', 'Basado en el curso "Curso base: Vender de la A a la Z".'),
  ('behovsanalys', 'Baserat på kursen "Behovsanalys & frågeteknik".', 'Based on the course "Needs analysis & questioning technique".', 'Basado en el curso "Análisis de necesidades y técnica de preguntas".'),
  ('invandningar', 'Baserat på kursen "Invändningshantering & förhandling".', 'Based on the course "Objection handling & negotiation".', 'Basado en el curso "Manejo de objeciones y negociación".'),
  ('motesbokning', 'Baserat på kursen "Mötesbokning & kalla samtal".', 'Based on the course "Booking meetings & cold calls".', 'Basado en el curso "Agendar reuniones y llamadas en frío".'),
  ('seo-geo', 'Baserat på kursen "Digital spetskunskap: SEO & GEO".', 'Based on the course "Digital expertise: SEO & GEO".', 'Basado en el curso "Conocimiento digital: SEO y GEO".'),
  ('produktmastaren', 'Baserat på kursen "Produktmästaren".', 'Based on the course "The product master".', 'Basado en el curso "El maestro de producto".'),
  ('storytelling', 'Baserat på kursen "Storytelling & pitch".', 'Based on the course "Storytelling & pitch".', 'Basado en el curso "Storytelling y pitch".'),
  ('crm', 'Baserat på kursen "CRM-mästaren".', 'Based on the course "The CRM master".', 'Basado en el curso "El maestro del CRM".')
) AS v(key, description, description_en, description_es)
WHERE q.key = v.key;
