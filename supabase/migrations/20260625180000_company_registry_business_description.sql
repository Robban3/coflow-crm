-- Persist the company's business description (verksamhetsbeskrivning) from
-- Bolagsverket. Like status, the client already fetches it but it was dropped
-- because there was no column to store it in.
ALTER TABLE public.company_registry ADD COLUMN IF NOT EXISTS business_description text;
