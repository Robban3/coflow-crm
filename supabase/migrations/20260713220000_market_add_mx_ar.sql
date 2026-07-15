-- Allow Mexico (MX) and Argentina (AR) as markets for outreach sequences.
-- The previous constraint (20260713210000) limited market to SE/US/DE/ES/UK/KR/CA/AU/IE.
ALTER TABLE public.outreach_sequences DROP CONSTRAINT IF EXISTS outreach_sequences_market_check;
ALTER TABLE public.outreach_sequences ADD CONSTRAINT outreach_sequences_market_check
  CHECK (market IN ('SE', 'US', 'DE', 'ES', 'UK', 'KR', 'CA', 'AU', 'IE', 'MX', 'AR'));
