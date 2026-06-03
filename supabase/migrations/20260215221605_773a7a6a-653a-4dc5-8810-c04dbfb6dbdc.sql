
-- Add new unified AI-synlighet pricing columns + website rebuild price
ALTER TABLE public.organization_pricing
  ADD COLUMN IF NOT EXISTS ai_visibility_start_monthly integer DEFAULT 4900,
  ADD COLUMN IF NOT EXISTS ai_visibility_growth_monthly integer DEFAULT 8900,
  ADD COLUMN IF NOT EXISTS ai_visibility_dominate_monthly integer DEFAULT 14900,
  ADD COLUMN IF NOT EXISTS website_rebuild_from_price integer DEFAULT 18000,
  ADD COLUMN IF NOT EXISTS show_website_upsell boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS currency text DEFAULT 'SEK',
  ADD COLUMN IF NOT EXISTS billing_period_label text DEFAULT '/ mån';
