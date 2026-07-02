-- Allow United Kingdom (UK) as a market for outreach sequences.
-- The previous constraint (20260625120000) limited market to SE/US/DE/ES.
ALTER TABLE public.outreach_sequences DROP CONSTRAINT IF EXISTS outreach_sequences_market_check;
ALTER TABLE public.outreach_sequences ADD CONSTRAINT outreach_sequences_market_check
  CHECK (market IN ('SE', 'US', 'DE', 'ES', 'UK'));
