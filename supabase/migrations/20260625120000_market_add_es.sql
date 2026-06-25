-- Allow Spain (ES) as a market for outreach sequences.
-- The original constraint (20260421090813) limited market to SE/US/DE.
ALTER TABLE public.outreach_sequences DROP CONSTRAINT IF EXISTS outreach_sequences_market_check;
ALTER TABLE public.outreach_sequences ADD CONSTRAINT outreach_sequences_market_check
  CHECK (market IN ('SE', 'US', 'DE', 'ES'));
