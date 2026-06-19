-- The worked sales-process example was seeded under "Säljmanus", but it belongs
-- in the dedicated (empty) "Säljprocess" category. Copy the row there (keeping
-- all languages and the current body) and remove it from Säljmanus.
INSERT INTO public.training_items
  (category_id, title, title_en, title_es, body, body_en, body_es, video_url, sort_order, is_published)
SELECT sp.id, ti.title, ti.title_en, ti.title_es, ti.body, ti.body_en, ti.body_es, ti.video_url, 0, ti.is_published
FROM public.training_items ti
JOIN public.training_categories cat ON cat.id = ti.category_id AND cat.slug = 'saljmanus'
JOIN public.training_categories sp ON sp.slug = 'saljprocess'
WHERE ti.title = 'Säljprocessen – exempel från första kontakt till avslut'
  AND NOT EXISTS (
    SELECT 1 FROM public.training_items x
    WHERE x.category_id = sp.id AND x.title = ti.title
  );

DELETE FROM public.training_items ti
USING public.training_categories cat
WHERE ti.category_id = cat.id
  AND cat.slug = 'saljmanus'
  AND ti.title = 'Säljprocessen – exempel från första kontakt till avslut';
