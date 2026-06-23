-- Lightweight cache for expensive external API responses (PageSpeed Insights,
-- Firecrawl) so the same URL analysed repeatedly within a short window does not
-- re-hit (and re-bill) the provider. Keyed by an opaque string; rows expire via
-- expires_at (and are read only when still fresh).
--
-- Only edge functions (service role) touch this table; RLS is enabled with no
-- policies so it is inaccessible to normal authenticated/anon users.
CREATE TABLE IF NOT EXISTS public.api_cache (
  cache_key text PRIMARY KEY,
  provider text,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON public.api_cache (expires_at);

ALTER TABLE public.api_cache ENABLE ROW LEVEL SECURITY;

-- Best-effort cleanup of expired rows (daily) if pg_cron is available.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('purge-api-cache')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'purge-api-cache');
    PERFORM cron.schedule('purge-api-cache', '0 4 * * *',
      $cron$ DELETE FROM public.api_cache WHERE expires_at < now(); $cron$);
  END IF;
END $$;
