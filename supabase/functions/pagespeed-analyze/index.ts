import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { getCached, setCached } from "../_shared/cache.ts";

// Reuse a recent analysis of the same URL+strategy to avoid re-billing PSI.
const PSI_CACHE_TTL_SECONDS = 24 * 60 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Must include ALL headers sent by the client (preflight will fail otherwise)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Simple punycode encoding for internationalized domain names
function toASCII(domain: string): string {
  // Check if the domain contains non-ASCII characters
  // eslint-disable-next-line no-control-regex -- avsiktlig ASCII-detektering (0x00–0x7F)
  if (!/[^\x00-\x7F]/.test(domain)) {
    return domain; // Already ASCII
  }
  
  // Split domain into parts and encode each part
  const parts = domain.split('.');
  const encodedParts = parts.map(part => {
    // eslint-disable-next-line no-control-regex -- avsiktlig ASCII-detektering (0x00–0x7F)
    if (!/[^\x00-\x7F]/.test(part)) {
      return part; // ASCII part, no encoding needed
    }
    
    // Use punycode encoding (simplified implementation)
    try {
      // Deno/browser have built-in URL which handles IDN
      const testUrl = new URL(`https://${part}.test`);
      const encoded = testUrl.hostname.replace('.test', '');
      return encoded;
    } catch {
      // Fallback: manual punycode prefix for simple cases
      return `xn--${encodeNonASCII(part)}`;
    }
  });
  
  return encodedParts.join('.');
}

// Helper to encode non-ASCII characters
function encodeNonASCII(str: string): string {
  // This is a simplified approach - use URL API for proper encoding
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Convert URL with IDN domain to ASCII-safe URL
function convertIDNUrl(urlString: string): string {
  try {
    const url = new URL(urlString);
    // URL constructor in modern JS/Deno automatically converts IDN to punycode
    return url.href;
  } catch {
    // If URL parsing fails, try to fix it manually
    return urlString;
  }
}

// fetch with an abort-based timeout, so a hung PSI request can't stall the whole
// function (it has no built-in timeout otherwise).
async function fetchWithTimeout(url: string, ms: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface AuditDetail {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  savings?: string;
  items?: Array<Record<string, unknown>>;
}

interface CategoryResult {
  score: number;
  audits: AuditDetail[];
}

interface PageSpeedResult {
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  pwa_score: number;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    speedIndex: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    timeToInteractive: number;
    firstInputDelay: number;
    interactionToNextPaint: number;
  };
  opportunities: AuditDetail[];
  diagnostics: AuditDetail[];
  performanceAudits: AuditDetail[];
  accessibilityAudits: AuditDetail[];
  seoAudits: AuditDetail[];
  bestPracticesAudits: AuditDetail[];
  pwaAudits: AuditDetail[];
  passedAudits: AuditDetail[];
  screenshot?: string;
  finalUrl: string;
  fetchTime: string;
}

function extractAudits(audits: Record<string, unknown>, auditRefs: Array<{ id: string }> | undefined): AuditDetail[] {
  if (!auditRefs) return [];
  
  const result: AuditDetail[] = [];
  
  for (const ref of auditRefs) {
    const audit = audits[ref.id] as Record<string, unknown> | undefined;
    if (!audit) continue;
    
    const details = audit.details as Record<string, unknown> | undefined;
    
    result.push({
      id: ref.id,
      title: (audit.title as string) || ref.id,
      description: (audit.description as string) || '',
      score: audit.score as number | null,
      displayValue: (audit.displayValue as string) || undefined,
      savings: details?.overallSavingsMs 
        ? `${Math.round(details.overallSavingsMs as number)}ms`
        : undefined,
    });
  }
  
  return result;
}

function getFailedAudits(audits: AuditDetail[]): AuditDetail[] {
  return audits.filter(a => a.score !== null && a.score < 0.9);
}

function getPassedAudits(audits: AuditDetail[]): AuditDetail[] {
  return audits.filter(a => a.score === 1);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { url, strategy = 'desktop' } = await req.json();

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL - normalize protocol (case-insensitive check)
    let formattedUrl = url.trim();
    const lower = formattedUrl.toLowerCase();
    if (lower.startsWith('https://') || lower.startsWith('http://')) {
      // Replace whatever-case protocol with lowercase
      formattedUrl = formattedUrl.substring(formattedUrl.indexOf('://') + 3);
      formattedUrl = `${lower.startsWith('https://') ? 'https' : 'http'}://${formattedUrl}`;
    } else {
      formattedUrl = `https://${formattedUrl}`;
    }
    
    // Convert IDN (internationalized domain names) to punycode
    // This handles Swedish characters like ö, ä, å in domain names
    const asciiUrl = convertIDNUrl(formattedUrl);
    console.log('Original URL:', formattedUrl);
    console.log('ASCII URL for API:', asciiUrl);

    console.log('Analyzing URL:', asciiUrl, 'Strategy:', strategy);

    // Serve a recent cached result for this exact URL + strategy if we have one.
    const cacheKey = `psi:${strategy}:${asciiUrl}`;
    const cached = await getCached<PageSpeedResult>(cacheKey);
    if (cached) {
      console.log('PSI cache hit for', cacheKey);
      return new Response(
        JSON.stringify({ success: true, data: cached, cached: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from environment
    const apiKey = Deno.env.get('GOOGLE_PAGESPEED_API_KEY');
    
    // Call PageSpeed Insights API. PWA was removed in Lighthouse 12, and
    // requesting the now-invalid `category=pwa` can make PSI reject the whole
    // request (400), so we only request the four supported categories.
    // Use the ASCII/punycode URL for the API call
    let apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(asciiUrl)}&strategy=${strategy}&category=performance&category=accessibility&category=best-practices&category=seo`;
    
    // Add API key if available (increases quota significantly)
    if (apiKey) {
      apiUrl += `&key=${apiKey}`;
      console.log('Using Google API key for higher quota');
    } else {
      console.log('No API key found, using public quota (limited)');
    }

    // PSI is frequently slow and occasionally returns a transient timeout or
    // Lighthouse runtime error. Retry a few times (with an abort timeout per
    // attempt) so a single hiccup doesn't fail the whole analysis.
    // Keep the total well under the gateway/function wall-clock limit so a slow
    // site can't make the whole call time out (2 x 30s + backoff ~= 62s).
    const MAX_ATTEMPTS = 2;
    const ATTEMPT_TIMEOUT_MS = 30_000;
    const RETRYABLE_HTTP = new Set([408, 429, 500, 502, 503, 504]);

    let data: any = null;
    let failureMessage = `Kunde inte analysera "${formattedUrl}". Försök igen om en stund.`;
    let failureCode: string | number = 'LIGHTHOUSE_ERROR';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let response: Response;
      try {
        response = await fetchWithTimeout(apiUrl, ATTEMPT_TIMEOUT_MS);
      } catch (e) {
        // Network error or our own abort timeout — always retryable.
        console.warn(`PSI attempt ${attempt}/${MAX_ATTEMPTS} failed (network/timeout):`, String(e));
        failureMessage = `Webbplatsen svarade för långsamt. Försök igen om en stund.`;
        failureCode = 'TIMEOUT';
        if (attempt < MAX_ATTEMPTS) { await sleep(attempt * 1500); continue; }
        break;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        console.error(`PSI attempt ${attempt}/${MAX_ATTEMPTS} HTTP ${response.status}:`, JSON.stringify(errorData));

        // Build a user-friendly message from the API error.
        let userMessage = `PageSpeed API-fel: ${response.status}`;
        if (errorData?.error?.message) {
          const errorMessage = errorData.error.message as string;
          if (errorMessage.includes('FAILED_DOCUMENT_REQUEST') || errorMessage.includes('ERR_CONNECTION')) {
            userMessage = `Kunde inte nå webbplatsen "${formattedUrl}". Kontrollera att adressen är korrekt och att webbplatsen är online.`;
          } else if (errorMessage.includes('DNS_FAILURE') || errorMessage.includes('ERR_NAME_NOT_RESOLVED')) {
            userMessage = `Domänen "${formattedUrl}" kunde inte hittas. Kontrollera att adressen är korrekt stavad.`;
          } else if (errorMessage.includes('PROTOCOL_TIMEOUT')) {
            userMessage = `Webbplatsen svarade för långsamt. Försök igen senare.`;
          } else if (errorMessage.includes('INVALID_URL')) {
            userMessage = `Ogiltig URL. Kontrollera att adressen är korrekt formaterad.`;
          } else {
            userMessage = `Analysen misslyckades: ${errorMessage.substring(0, 150)}`;
          }
        }

        // Transient server-side / rate-limit errors are worth retrying; client
        // errors (bad URL, unreachable site) are not.
        if (RETRYABLE_HTTP.has(response.status) && attempt < MAX_ATTEMPTS) {
          failureMessage = userMessage;
          failureCode = response.status;
          await sleep(attempt * 1500);
          continue;
        }
        // Return 200 so supabase.functions.invoke surfaces our message in the
        // body (non-2xx is swallowed into a generic FunctionsHttpError).
        return new Response(
          JSON.stringify({ success: false, error: userMessage, errorCode: response.status }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const body = await response.json();
      const lhr = body.lighthouseResult || {};
      const cats = lhr.categories || {};

      // If Lighthouse couldn't actually analyze the site (too slow, unreachable,
      // or it blocks automated tools), PSI returns a runtimeError and no scores.
      // This is often transient, so retry before giving up.
      if (lhr.runtimeError || cats.performance?.score == null) {
        const rtMsg: string = lhr.runtimeError?.message || '';
        console.warn(`PSI attempt ${attempt}/${MAX_ATTEMPTS} runtimeError:`, rtMsg || '(no scores)');
        failureMessage = `Kunde inte analysera "${formattedUrl}". Sajten kan vara för långsam, otillgänglig eller blockera automatiserade verktyg. Försök igen om en stund.${rtMsg ? ` (${rtMsg.substring(0, 140)})` : ''}`;
        failureCode = 'LIGHTHOUSE_ERROR';
        if (attempt < MAX_ATTEMPTS) { await sleep(attempt * 2000); continue; }
        break;
      }

      data = body; // success
      break;
    }

    // All attempts exhausted without a usable result — surface a clear error
    // instead of saving a misleading all-zeros / undefined report.
    if (!data) {
      // 200 so the client reads our message from the body (see note above).
      return new Response(
        JSON.stringify({ success: false, error: failureMessage, errorCode: failureCode }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract data from Lighthouse result
    const lighthouseResult = data.lighthouseResult || {};
    const categories = lighthouseResult.categories || {};
    const audits = lighthouseResult.audits || {};
    
    // Extract all audits per category
    const performanceAudits = extractAudits(audits, categories.performance?.auditRefs);
    const accessibilityAudits = extractAudits(audits, categories.accessibility?.auditRefs);
    const seoAudits = extractAudits(audits, categories.seo?.auditRefs);
    const bestPracticesAudits = extractAudits(audits, categories['best-practices']?.auditRefs);
    const pwaAudits = extractAudits(audits, categories.pwa?.auditRefs);
    
    // Build opportunities list
    const opportunities: AuditDetail[] = [];
    for (const [id, audit] of Object.entries(audits)) {
      const a = audit as Record<string, unknown>;
      const details = a.details as Record<string, unknown> | undefined;
      if (details?.type === 'opportunity' && a.score !== null && (a.score as number) < 1) {
        opportunities.push({
          id,
          title: (a.title as string) || id,
          description: (a.description as string) || '',
          score: a.score as number,
          displayValue: a.displayValue as string | undefined,
          savings: details.overallSavingsMs 
            ? `${Math.round(details.overallSavingsMs as number)}ms` 
            : undefined,
        });
      }
    }

    // Build diagnostics list
    const diagnostics: AuditDetail[] = [];
    for (const [id, audit] of Object.entries(audits)) {
      const a = audit as Record<string, unknown>;
      const details = a.details as Record<string, unknown> | undefined;
      if (details?.type === 'table' && a.score !== null && (a.score as number) < 1 && 
          !opportunities.find(o => o.id === id)) {
        diagnostics.push({
          id,
          title: (a.title as string) || id,
          description: (a.description as string) || '',
          score: a.score as number,
          displayValue: a.displayValue as string | undefined,
        });
      }
    }

    // Sort by impact (lower score = higher priority)
    opportunities.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));
    diagnostics.sort((a, b) => (a.score ?? 1) - (b.score ?? 1));

    // Get passed audits for positive feedback
    const allAudits = [...performanceAudits, ...accessibilityAudits, ...seoAudits, ...bestPracticesAudits];
    const passedAudits = getPassedAudits(allAudits).slice(0, 10);

    const result: PageSpeedResult = {
      performance_score: Math.round((categories.performance?.score || 0) * 100),
      accessibility_score: Math.round((categories.accessibility?.score || 0) * 100),
      best_practices_score: Math.round((categories['best-practices']?.score || 0) * 100),
      seo_score: Math.round((categories.seo?.score || 0) * 100),
      pwa_score: Math.round((categories.pwa?.score || 0) * 100),
      metrics: {
        firstContentfulPaint: (audits['first-contentful-paint'] as Record<string, unknown>)?.numericValue as number || 0,
        largestContentfulPaint: (audits['largest-contentful-paint'] as Record<string, unknown>)?.numericValue as number || 0,
        speedIndex: (audits['speed-index'] as Record<string, unknown>)?.numericValue as number || 0,
        totalBlockingTime: (audits['total-blocking-time'] as Record<string, unknown>)?.numericValue as number || 0,
        cumulativeLayoutShift: (audits['cumulative-layout-shift'] as Record<string, unknown>)?.numericValue as number || 0,
        timeToInteractive: (audits['interactive'] as Record<string, unknown>)?.numericValue as number || 0,
        firstInputDelay: (audits['max-potential-fid'] as Record<string, unknown>)?.numericValue as number || 0,
        interactionToNextPaint: (audits['interaction-to-next-paint'] as Record<string, unknown>)?.numericValue as number || 0,
      },
      opportunities: opportunities.slice(0, 10),
      diagnostics: diagnostics.slice(0, 10),
      performanceAudits: getFailedAudits(performanceAudits).slice(0, 15),
      accessibilityAudits: getFailedAudits(accessibilityAudits).slice(0, 15),
      seoAudits: getFailedAudits(seoAudits).slice(0, 15),
      bestPracticesAudits: getFailedAudits(bestPracticesAudits).slice(0, 15),
      pwaAudits: getFailedAudits(pwaAudits).slice(0, 15),
      passedAudits,
      screenshot: (audits['final-screenshot'] as Record<string, unknown>)?.details 
        ? ((audits['final-screenshot'] as Record<string, unknown>).details as Record<string, unknown>).data as string
        : undefined,
      finalUrl: lighthouseResult.finalUrl || formattedUrl,
      fetchTime: lighthouseResult.fetchTime || new Date().toISOString(),
    };

    console.log('Analysis complete:', {
      performance: result.performance_score,
      accessibility: result.accessibility_score,
      seo: result.seo_score,
      pwa: result.pwa_score,
      opportunities: result.opportunities.length,
      diagnostics: result.diagnostics.length,
    });

    // Cache the successful result for subsequent identical requests.
    await setCached(cacheKey, result, PSI_CACHE_TTL_SECONDS, 'pagespeed');

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error analyzing page:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Ett fel uppstod vid analysen' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
