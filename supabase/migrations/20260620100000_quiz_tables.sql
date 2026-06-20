-- Interactive quiz tables. Mirrors the training feature's email-domain RLS:
-- any @applabbet.com user can read; only the training admins can write.
-- A "quiz" groups a bank of multiple-choice questions; the app shows a random
-- subset per attempt and grades it client-side.

CREATE TABLE public.quizzes (
  id             uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key            text NOT NULL UNIQUE,           -- stable slug, e.g. 'grundkurs'
  title          text NOT NULL,
  title_en       text,
  title_es       text,
  description     text,
  description_en  text,
  description_es  text,
  sort_order     integer NOT NULL DEFAULT 0,
  is_published   boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES auth.users(id)
);

CREATE TABLE public.quiz_questions (
  id              uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quiz_id         uuid NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question        text NOT NULL,
  question_en     text,
  question_es     text,
  options         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- array of option strings
  options_en      jsonb,
  options_es      jsonb,
  correct_index   integer NOT NULL DEFAULT 0,           -- index into the base options array
  explanation     text,
  explanation_en  text,
  explanation_es  text,
  sort_order      integer NOT NULL DEFAULT 0,
  is_published    boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_quizzes_sort ON public.quizzes (sort_order);
CREATE INDEX idx_quiz_questions_quiz ON public.quiz_questions (quiz_id, sort_order);

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_quizzes_updated_at
  BEFORE UPDATE ON public.quizzes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_quiz_questions_updated_at
  BEFORE UPDATE ON public.quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: quizzes ───────────────────────────────────────────────────────────
CREATE POLICY "Applabbet users can view quizzes"
  ON public.quizzes FOR SELECT TO authenticated
  USING (public.is_applabbet_user());

CREATE POLICY "Applabbet admins can insert quizzes"
  ON public.quizzes FOR INSERT TO authenticated
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can update quizzes"
  ON public.quizzes FOR UPDATE TO authenticated
  USING (public.is_applabbet_training_admin())
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can delete quizzes"
  ON public.quizzes FOR DELETE TO authenticated
  USING (public.is_applabbet_training_admin());

-- ── RLS: quiz_questions ────────────────────────────────────────────────────
CREATE POLICY "Applabbet users can view quiz questions"
  ON public.quiz_questions FOR SELECT TO authenticated
  USING (public.is_applabbet_user());

CREATE POLICY "Applabbet admins can insert quiz questions"
  ON public.quiz_questions FOR INSERT TO authenticated
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can update quiz questions"
  ON public.quiz_questions FOR UPDATE TO authenticated
  USING (public.is_applabbet_training_admin())
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can delete quiz questions"
  ON public.quiz_questions FOR DELETE TO authenticated
  USING (public.is_applabbet_training_admin());
