-- Add market column to outreach_sequences with default 'SE'
ALTER TABLE public.outreach_sequences
ADD COLUMN IF NOT EXISTS market VARCHAR(2) NOT NULL DEFAULT 'SE'
CHECK (market IN ('SE', 'US', 'DE'));

-- Ensure any existing rows (in case column existed as nullable) are set to 'SE'
UPDATE public.outreach_sequences SET market = 'SE' WHERE market IS NULL;