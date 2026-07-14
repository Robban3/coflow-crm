-- Allow Canada (CA) as a market for outreach sequences.
-- The previous constraint (20260713130000) limited market to SE/US/DE/ES/UK/KR.
ALTER TABLE public.outreach_sequences DROP CONSTRAINT IF EXISTS outreach_sequences_market_check;
ALTER TABLE public.outreach_sequences ADD CONSTRAINT outreach_sequences_market_check
  CHECK (market IN ('SE', 'US', 'DE', 'ES', 'UK', 'KR', 'CA'));
