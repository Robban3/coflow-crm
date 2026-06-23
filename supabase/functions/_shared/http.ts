// Shared HTTP helper for edge functions: a fetch with an abort-based timeout
// and exponential-backoff retries for transient failures (network errors,
// timeouts, HTTP 408/425/429 and 5xx). Most external APIs we call (Firecrawl,
// Gemini, Claude, Google Places, DataForSEO, Resend) had neither, so a single
// blip failed the whole flow or a hung request stalled the function.

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface RetryOptions {
  /** Per-attempt timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Base backoff in ms; attempt N waits baseDelayMs * N (default 600). */
  baseDelayMs?: number;
  /** Optional label for logs. */
  label?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * fetch() with only an abort-based timeout and NO retry. Use this for
 * non-idempotent calls (e.g. sending an email) where retrying a request that
 * may have already succeeded would cause duplicates.
 */
export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 30_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * fetch() with timeout + retry. Returns the final Response (which may still be
 * a non-2xx that the caller should inspect). Throws only if every attempt fails
 * to produce a response (network error / timeout on the last try).
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<Response> {
  const timeoutMs = opts.timeoutMs ?? 30_000;
  const attempts = opts.attempts ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 600;
  const label = opts.label ?? url;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetchWithTimeout(url, init, timeoutMs);
      if (RETRYABLE_STATUS.has(res.status) && attempt < attempts) {
        console.warn(`[fetchWithRetry] ${label} attempt ${attempt}/${attempts} -> HTTP ${res.status}, retrying`);
        await sleep(baseDelayMs * attempt);
        continue;
      }
      return res;
    } catch (e) {
      lastError = e;
      console.warn(`[fetchWithRetry] ${label} attempt ${attempt}/${attempts} failed:`, String(e));
      if (attempt < attempts) {
        await sleep(baseDelayMs * attempt);
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`fetchWithRetry failed: ${label}`);
}
