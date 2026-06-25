import { supabase } from '@/integrations/supabase/client';
import { getActiveMarket } from '@/hooks/useMarket';

// Type for analysis records from DB
interface Analysis {
  id: string;
  url: string;
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  created_at: string;
  raw_data: PageSpeedResult | null;
  lead_id?: string | null;
  customer_id?: string | null;
  analyzed_by?: string | null;
}

export interface PageSpeedMetrics {
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  speedIndex: number;
  totalBlockingTime: number;
  cumulativeLayoutShift: number;
  timeToInteractive: number;
  firstInputDelay?: number;
  interactionToNextPaint?: number;
}

export interface AuditDetail {
  id: string;
  title: string;
  description: string;
  score: number | null;
  displayValue?: string;
  savings?: string;
}

export interface PageSpeedResult {
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  pwa_score?: number;
  /** Which PageSpeed strategy produced this result. Stored so mobile and
   *  desktop analyses of the same URL are tracked (and deduped) separately. */
  strategy?: 'mobile' | 'desktop';
  metrics: PageSpeedMetrics;
  opportunities: AuditDetail[];
  diagnostics: AuditDetail[];
  performanceAudits?: AuditDetail[];
  accessibilityAudits?: AuditDetail[];
  seoAudits?: AuditDetail[];
  bestPracticesAudits?: AuditDetail[];
  pwaAudits?: AuditDetail[];
  passedAudits?: AuditDetail[];
  screenshot?: string;
  finalUrl?: string;
  fetchTime?: string;
}

export interface AnalysisResponse {
  success: boolean;
  data?: PageSpeedResult;
  error?: string;
}

export interface SummaryResponse {
  success: boolean;
  summary?: string;
  technicalSummary?: string;
  customerSummary?: string;
  error?: string;
}

// Normalize URL for comparison - removes protocol, www, and trailing slashes
export function normalizeUrl(url: string): string {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '')
    .toLowerCase();
}

export const webAnalysisApi = {
  // Check for recent analysis of same URL (within 3 days). When a strategy is
  // given, only a same-strategy analysis counts as a match, so switching
  // between mobile and desktop always runs a fresh analysis.
  async findRecentAnalysis(url: string, strategy?: 'mobile' | 'desktop'): Promise<{ found: boolean; analysis?: Analysis; error?: string }> {
    const normalizedUrl = normalizeUrl(url);
    const sameStrategy = (a: any) =>
      !strategy || ((a.raw_data as any)?.strategy ?? undefined) === strategy;

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // Try exact match first (fast), then fall back to fetching recent analyses
    const { data, error } = await supabase
      .from('web_analyses')
      .select('*')
      .eq('url', url)
      .gte('created_at', threeDaysAgo.toISOString())
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Error checking for recent analysis:', error);
      return { found: false, error: error.message };
    }

    // First try exact match
    let match = data?.find(a => normalizeUrl(a.url) === normalizedUrl && sameStrategy(a));

    // If no exact match, do a broader search with normalized URL variants
    if (!match) {
      const variants = [
        url,
        url.replace(/^https?:\/\//, 'https://'),
        url.replace(/^https?:\/\//, 'http://'),
        `https://www.${normalizedUrl}`,
        `https://${normalizedUrl}`,
        `http://${normalizedUrl}`,
      ];
      const { data: data2 } = await supabase
        .from('web_analyses')
        .select('*')
        .in('url', variants)
        .gte('created_at', threeDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      match = data2?.find(a => normalizeUrl(a.url) === normalizedUrl && sameStrategy(a));
    }

    if (match) {
      return { 
        found: true, 
        analysis: {
          ...match,
          raw_data: match.raw_data as unknown as PageSpeedResult | null,
        } as Analysis 
      };
    }

    return { found: false };
  },

  // Find a lead by normalized URL - uses server-side filtering for performance
  async findLeadByUrl(url: string): Promise<{ id: string; company_name: string | null; contact_name: string | null; email: string | null; phone: string | null } | null> {
    const normalizedUrl = normalizeUrl(url);
    
    // Build URL variants to search for
    const variants = [
      url,
      `https://${normalizedUrl}`,
      `http://${normalizedUrl}`,
      `https://www.${normalizedUrl}`,
      `http://www.${normalizedUrl}`,
    ];

    const { data, error } = await supabase
      .from('leads')
      .select('id, company_name, contact_name, email, phone, website')
      .in('website', variants)
      .limit(10);

    if (error || !data) {
      console.error('Error finding lead by URL:', error);
      return null;
    }

    const match = data.find(lead => lead.website && normalizeUrl(lead.website) === normalizedUrl);
    
    if (match) {
      return {
        id: match.id,
        company_name: match.company_name,
        contact_name: match.contact_name,
        email: match.email,
        phone: match.phone,
      };
    }

    return null;
  },

  // Find all analyses matching a URL - uses server-side filtering for performance
  async findAnalysesByUrl(url: string): Promise<Analysis[]> {
    const normalizedUrl = normalizeUrl(url);
    
    // Build URL variants to search for server-side
    const variants = [
      url,
      `https://${normalizedUrl}`,
      `http://${normalizedUrl}`,
      `https://www.${normalizedUrl}`,
      `http://www.${normalizedUrl}`,
    ];

    const { data, error } = await supabase
      .from('web_analyses')
      .select('*')
      .in('url', variants)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) {
      console.error('Error finding analyses by URL:', error);
      return [];
    }

    // Final client-side normalize filter (handles edge cases)
    const matches = data.filter(a => normalizeUrl(a.url) === normalizedUrl);
    
    return matches.map(match => ({
      ...match,
      raw_data: match.raw_data as unknown as PageSpeedResult | null,
    })) as Analysis[];
  },

  async analyzeUrl(url: string, strategy: 'mobile' | 'desktop' = 'desktop'): Promise<AnalysisResponse> {
    // Lighthouse audit titles/descriptions are localised server-side; pass the
    // user's current app language (persisted by the LanguageProvider).
    const language =
      (typeof localStorage !== 'undefined' && localStorage.getItem('app-language')) || 'sv';
    const { data, error } = await supabase.functions.invoke('pagespeed-analyze', {
      body: { url, strategy, language },
    });

    if (error) {
      console.error('Analysis error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  async generateSummary(analysisData: PageSpeedResult & { url: string }, type: 'both' | 'technical' | 'customer' = 'both'): Promise<SummaryResponse> {
    const { data, error } = await supabase.functions.invoke('generate-analysis-summary', {
      body: { analysisData, type, market: getActiveMarket() },
    });

    if (error) {
      console.error('Summary error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  async saveAnalysis(
    url: string, 
    result: PageSpeedResult, 
    customerId?: string
  ): Promise<{ success: boolean; id?: string; error?: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return { success: false, error: 'Inte inloggad' };
    }

     
    const rawData = JSON.parse(JSON.stringify(result));
    
    const { data, error } = await supabase
      .from('web_analyses')
      .insert([{
        url,
        performance_score: result.performance_score,
        accessibility_score: result.accessibility_score,
        best_practices_score: result.best_practices_score,
        seo_score: result.seo_score,
        raw_data: rawData,
        customer_id: customerId || null,
        analyzed_by: user.id,
      }])
      .select('id')
      .single();

    if (error) {
      console.error('Save error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  },

  // Helper to get score rating
  getScoreRating(score: number): 'good' | 'needs-improvement' | 'poor' {
    if (score >= 90) return 'good';
    if (score >= 50) return 'needs-improvement';
    return 'poor';
  },

  // Helper to format time
  formatTime(ms: number): string {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  },
};
