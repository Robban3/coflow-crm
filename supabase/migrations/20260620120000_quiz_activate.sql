-- Switch the Quiz category to the interactive engine: the app renders <QuizApp/>
-- for kind='quiz' (like 'sandbox'). Remove the old static quiz training_items so
-- there is no duplicate content behind the new interactive view.
UPDATE public.training_categories SET kind = 'quiz' WHERE slug = 'quiz';

DELETE FROM public.training_items ti
USING public.training_categories cat
WHERE ti.category_id = cat.id
  AND cat.slug = 'quiz';
