// Shared cache helper for expensive external API responses, backed by the
// public.api_cache table. Self-contained (creates its own service-role client),
// and best-effort: any failure silently falls through to a live API call.

import { createClient } from "npm:@supabase/supabase-js@2";

function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Return a fresh (non-expired) cached payload for the key, or null. */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const supabase = serviceClient();
    if (!supabase) return null;
    const { data } = await supabase
      .from("api_cache")
      .select("payload, expires_at")
      .eq("cache_key", key)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    return (data?.payload as T) ?? null;
  } catch (_e) {
    return null;
  }
}

/** Store a payload under the key with a TTL (seconds). Best-effort. */
export async function setCached(
  key: string,
  payload: unknown,
  ttlSeconds: number,
  provider?: string,
): Promise<void> {
  try {
    const supabase = serviceClient();
    if (!supabase) return;
    const expires_at = new Date(Date.now() + ttlSeconds * 1000).toISOString();
    await supabase
      .from("api_cache")
      .upsert(
        { cache_key: key, provider: provider ?? null, payload, expires_at, created_at: new Date().toISOString() },
        { onConflict: "cache_key" },
      );
  } catch (_e) {
    // best-effort; never block the request on cache writes
  }
}
