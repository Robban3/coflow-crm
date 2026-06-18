-- Training feature: a shared CMS (categories + items) for Applabbet staff.
-- Access is gated by EMAIL DOMAIN (@applabbet.com): any such user can view,
-- admins among them can edit. RLS is the real defense; the UI mirrors it.

-- Helper: is the current user an Applabbet user (email ends with @applabbet.com)?
CREATE OR REPLACE FUNCTION public.is_applabbet_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) LIKE '%@applabbet.com'
$$;

-- Helper: may the current user EDIT training content? (explicit admin allowlist)
CREATE OR REPLACE FUNCTION public.is_applabbet_training_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) IN ('robert@applabbet.com', 'oliver@applabbet.com')
$$;

-- Categories = the dynamic sidebar submenus (single shared set)
CREATE TABLE public.training_categories (
  id          uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  kind        text NOT NULL DEFAULT 'content',  -- 'content' | 'sandbox'
  sort_order  integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  created_by  uuid REFERENCES auth.users(id)
);

-- Content items (lessons / resources) within a category
CREATE TABLE public.training_items (
  id           uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id  uuid NOT NULL REFERENCES public.training_categories(id) ON DELETE CASCADE,
  title        text NOT NULL,
  body         jsonb,            -- TipTap document JSON
  video_url    text,
  sort_order   integer NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_training_categories_sort ON public.training_categories (sort_order);
CREATE INDEX idx_training_items_cat ON public.training_items (category_id, sort_order);

ALTER TABLE public.training_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_items ENABLE ROW LEVEL SECURITY;

-- updated_at maintenance (function already exists in the schema)
CREATE TRIGGER update_training_categories_updated_at
  BEFORE UPDATE ON public.training_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_training_items_updated_at
  BEFORE UPDATE ON public.training_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── RLS: training_categories ──────────────────────────────────────────────
CREATE POLICY "Applabbet users can view training categories"
  ON public.training_categories FOR SELECT TO authenticated
  USING (public.is_applabbet_user());

CREATE POLICY "Applabbet admins can insert training categories"
  ON public.training_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can update training categories"
  ON public.training_categories FOR UPDATE TO authenticated
  USING (public.is_applabbet_training_admin())
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can delete training categories"
  ON public.training_categories FOR DELETE TO authenticated
  USING (public.is_applabbet_training_admin());

-- ── RLS: training_items ───────────────────────────────────────────────────
CREATE POLICY "Applabbet users can view training items"
  ON public.training_items FOR SELECT TO authenticated
  USING (public.is_applabbet_user());

CREATE POLICY "Applabbet admins can insert training items"
  ON public.training_items FOR INSERT TO authenticated
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can update training items"
  ON public.training_items FOR UPDATE TO authenticated
  USING (public.is_applabbet_training_admin())
  WITH CHECK (public.is_applabbet_training_admin());

CREATE POLICY "Applabbet admins can delete training items"
  ON public.training_items FOR DELETE TO authenticated
  USING (public.is_applabbet_training_admin());

-- ── Seed the initial categories ───────────────────────────────────────────
INSERT INTO public.training_categories (name, slug, kind, sort_order)
VALUES
  ('Onboarding','onboarding','content',1),
  ('Säljprocess','saljprocess','content',2),
  ('Produktkunskap','produktkunskap','content',3),
  ('Kurser','kurser','content',4),
  ('Säljmanus','saljmanus','content',5),
  ('FAQ','faq','content',6),
  ('Videor','videor','content',7),
  ('Dokument','dokument','content',8),
  ('Quiz','quiz','content',9),
  ('Sandbox','sandbox','sandbox',10)
ON CONFLICT (slug) DO NOTHING;
