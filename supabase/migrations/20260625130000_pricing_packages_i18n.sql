-- Localised variants for pricing packages (en/es), mirroring the existing
-- name_en/name_es pattern on training_categories. The base columns remain the
-- Swedish/primary values and the fallback; localised columns are optional.
ALTER TABLE public.pricing_packages
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS name_es text,
  ADD COLUMN IF NOT EXISTS category_en text,
  ADD COLUMN IF NOT EXISTS category_es text,
  ADD COLUMN IF NOT EXISTS description_en text,
  ADD COLUMN IF NOT EXISTS description_es text,
  ADD COLUMN IF NOT EXISTS price_en text,
  ADD COLUMN IF NOT EXISTS price_es text,
  ADD COLUMN IF NOT EXISTS unit_en text,
  ADD COLUMN IF NOT EXISTS unit_es text,
  ADD COLUMN IF NOT EXISTS features_en jsonb,
  ADD COLUMN IF NOT EXISTS features_es jsonb;
