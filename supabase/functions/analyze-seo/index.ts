import { createClient } from "npm:@supabase/supabase-js@2";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/http.ts";
import { getCached, setCached } from "../_shared/cache.ts";
import { at } from "../_shared/analysisText.ts";

const FIRECRAWL_CACHE_TTL_SECONDS = 24 * 60 * 60;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  // Must include ALL headers sent by the client (preflight will fail otherwise)
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RankedKeyword {
  keyword: string;
  position: number;
  search_volume: number;
  traffic: number;
  traffic_cost: number;
  cpc: number;
  url: string;
}

interface SeoAnalysisResult {
  // On-page SEO metrics
  title_tag: string | null;
  meta_description: string | null;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  word_count: number;
  internal_links_count: number;
  external_links_count: number;
  images_count: number;
  images_without_alt: number;
  
  // Technical SEO
  has_robots_txt: boolean;
  has_sitemap: boolean;
  is_https: boolean;
  has_canonical: boolean;
  canonical_url: string | null;
  has_open_graph: boolean;
  has_twitter_cards: boolean;
  mobile_friendly: boolean;
  
  // Content analysis - from on-page
  primary_keywords: Array<{ keyword: string; count: number; density: number }>;
  keyword_density: Record<string, number>;
  
  // DataForSEO - REAL keyword rankings
  ranked_keywords: RankedKeyword[];
  total_ranked_keywords: number;
  total_organic_traffic: number;
  total_traffic_cost: number;
  top_positions: number; // Keywords in top 10
  
  // AI-generated insights
  estimated_keywords: Array<{ keyword: string; estimated_position: string; opportunity: string }>;
  visibility_score: number;
  ai_summary: string;
  ai_opportunities: Array<{ title: string; description: string; priority: 'high' | 'medium' | 'low' }>;
  // True when the site blocks automated tools (bot protection), so the scraped
  // on-page data may be incomplete/unreliable.
  automated_access_blocked?: boolean;
}

async function scrapeWithFirecrawl(url: string, apiKey: string): Promise<{ success: boolean; data?: any; error?: string; blocked?: boolean }> {
  // Serve a recent cached scrape for this URL to avoid re-billing Firecrawl.
  const cacheKey = `firecrawl:scrape:${url}`;
  const cached = await getCached<any>(cacheKey);
  if (cached) {
    console.log('Firecrawl cache hit for', url);
    return { success: true, data: cached, blocked: false };
  }
  try {
    const response = await fetchWithRetry('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'html', 'links'],
        onlyMainContent: false,
      }),
    }, { timeoutMs: 45_000, label: 'Firecrawl scrape' });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      // Firecrawl surfaces the target site's status; 403 / bot-block pages mean
      // the site blocks automated tools, so our on-page data would be unreliable.
      const msg = String(data?.error || `Firecrawl error: ${response.status}`);
      const blocked = response.status === 403 || /403|forbidden|blocked|bot|captcha|cloudflare/i.test(msg);
      return { success: false, error: msg, blocked };
    }

    const scraped = data.data || data;
    // Detect a block even when Firecrawl returns 200 with a tiny challenge page.
    const html: string = scraped?.html || '';
    const markdown: string = scraped?.markdown || '';
    const statusCode: number | undefined = scraped?.metadata?.statusCode;
    const blocked =
      statusCode === 403 ||
      ((html.length + markdown.length) < 600 &&
        /(access denied|forbidden|are you a robot|verify you are human|captcha|cloudflare|attention required)/i.test(html + markdown));

    // Only cache clean, non-blocked scrapes so we never serve a block page.
    if (!blocked) {
      await setCached(cacheKey, scraped, FIRECRAWL_CACHE_TTL_SECONDS, 'firecrawl');
    }

    return { success: true, data: scraped, blocked };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Firecrawl request failed' };
  }
}

async function fetchDataForSEO(domain: string, login: string, password: string): Promise<{
  success: boolean;
  keywords?: RankedKeyword[];
  totalKeywords?: number;
  totalTraffic?: number;
  totalTrafficCost?: number;
  topPositions?: number;
  error?: string;
}> {
  try {
    // DataForSEO uses Basic Auth
    const credentials = btoa(`${login}:${password}`);
    
    // Use Ranked Keywords endpoint - returns all keywords a domain ranks for
    const response = await fetchWithRetry('https://api.dataforseo.com/v3/dataforseo_labs/google/ranked_keywords/live', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([
        {
          target: domain,
          language_code: 'sv',
          location_code: 2752, // Sweden
          limit: 50, // Top 50 keywords
          order_by: ['keyword_data.keyword_info.search_volume,desc'],
          filters: [
            ['ranked_serp_element.serp_item.rank_group', '<=', 100]
          ],
        },
      ]),
    }, { timeoutMs: 45_000, label: 'DataForSEO' });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('DataForSEO API error:', data);
      return { success: false, error: data.status_message || `DataForSEO error: ${response.status}` };
    }

    if (data.status_code !== 20000) {
      console.error('DataForSEO response error:', data);
      return { success: false, error: data.status_message || 'DataForSEO request failed' };
    }

    const result = data.tasks?.[0]?.result?.[0];
    
    if (!result) {
      console.log('No ranking data found for domain:', domain);
      return { 
        success: true, 
        keywords: [],
        totalKeywords: 0,
        totalTraffic: 0,
        totalTrafficCost: 0,
        topPositions: 0,
      };
    }

    // Extract keyword data
    const keywords: RankedKeyword[] = (result.items || []).map((item: any) => ({
      keyword: item.keyword_data?.keyword || '',
      position: item.ranked_serp_element?.serp_item?.rank_group || 0,
      search_volume: item.keyword_data?.keyword_info?.search_volume || 0,
      traffic: item.ranked_serp_element?.serp_item?.etv || 0, // Estimated Traffic Value
      traffic_cost: item.ranked_serp_element?.serp_item?.estimated_paid_traffic_cost || 0,
      cpc: item.keyword_data?.keyword_info?.cpc || 0,
      url: item.ranked_serp_element?.serp_item?.url || '',
    })).filter((k: RankedKeyword) => k.keyword && k.position > 0);

    // Calculate totals
    const totalTraffic = keywords.reduce((sum, k) => sum + k.traffic, 0);
    const totalTrafficCost = keywords.reduce((sum, k) => sum + k.traffic_cost, 0);
    const topPositions = keywords.filter(k => k.position <= 10).length;

    console.log('DataForSEO results:', {
      domain,
      totalKeywords: result.total_count || keywords.length,
      keywordsReturned: keywords.length,
      totalTraffic: Math.round(totalTraffic),
      topPositions,
    });

    return {
      success: true,
      keywords,
      totalKeywords: result.total_count || keywords.length,
      totalTraffic: Math.round(totalTraffic),
      totalTrafficCost: Math.round(totalTrafficCost * 100) / 100,
      topPositions,
    };
  } catch (error) {
    console.error('DataForSEO fetch error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'DataForSEO request failed' };
  }
}

function extractSeoMetrics(html: string, markdown: string, links: string[], baseUrl: string): Partial<SeoAnalysisResult> {
  const urlObj = new URL(baseUrl);
  const domain = urlObj.hostname;
  
  // Determine HTTPS from the actual URL parsed
  const is_https = urlObj.protocol === 'https:';
  
  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title_tag = titleMatch ? titleMatch[1].trim() : null;
  
  // Extract meta description - multiple patterns for better matching
  let meta_description: string | null = null;
  const metaDescPatterns = [
    /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i,
    /<meta\s+name="description"\s+content="([^"]+)"/i,
    /<meta\s+content="([^"]+)"\s+name="description"/i,
  ];
  for (const pattern of metaDescPatterns) {
    const match = html.match(pattern);
    if (match) {
      meta_description = match[1].trim();
      break;
    }
  }
  
  // Count headings
  const h1_count = (html.match(/<h1[^>]*>/gi) || []).length;
  const h2_count = (html.match(/<h2[^>]*>/gi) || []).length;
  const h3_count = (html.match(/<h3[^>]*>/gi) || []).length;
  
  // Word count from markdown
  const textContent = markdown.replace(/[#*_[\]()!`]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = textContent.split(' ').filter(w => w.length > 2);
  const word_count = words.length;
  
  // Link analysis
  const internal_links_count = links.filter(link => {
    try {
      const linkUrl = new URL(link, baseUrl);
      return linkUrl.hostname === domain || linkUrl.hostname.endsWith('.' + domain);
    } catch {
      return link.startsWith('/') || link.startsWith('#');
    }
  }).length;
  
  const external_links_count = Math.max(0, links.length - internal_links_count);
  
  // Image analysis - more robust regex
  const imgPattern = /<img\s[^>]*>/gi;
  const images = html.match(imgPattern) || [];
  const images_count = images.length;
  const images_without_alt = images.filter(img => {
    // Check if alt attribute exists and has a value
    const hasAlt = /alt\s*=\s*["'][^"']+["']/i.test(img);
    return !hasAlt;
  }).length;
  
  // Canonical check - multiple patterns
  let has_canonical = false;
  let canonical_url: string | null = null;
  const canonicalPatterns = [
    /<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i,
  ];
  for (const pattern of canonicalPatterns) {
    const match = html.match(pattern);
    if (match) {
      has_canonical = true;
      canonical_url = match[1];
      break;
    }
  }
  
  // Open Graph - check for various og: properties
  const has_open_graph = /<meta[^>]*property=["']og:(title|description|image|url)["']/i.test(html);
  
  // Twitter Cards - check for twitter: name properties
  const has_twitter_cards = /<meta[^>]*name=["']twitter:(card|title|description|image)["']/i.test(html);
  
  // Mobile friendly (viewport meta tag with proper content)
  const viewportMatch = html.match(/<meta[^>]*name=["']viewport["'][^>]*content=["']([^"']+)["']/i);
  const mobile_friendly = viewportMatch ? viewportMatch[1].includes('width=') : false;
  
  // Extract keywords from content
  const wordFrequency: Record<string, number> = {};
  const stopWords = new Set([
    'och', 'att', 'det', 'som', 'för', 'med', 'den', 'till', 'är', 'på', 'av', 'en', 'ett', 'har', 'kan', 'om', 'inte', 'de', 'vi', 'var', 'detta',
    'the', 'and', 'for', 'you', 'are', 'with', 'this', 'that', 'have', 'from', 'can', 'will', 'your', 'all', 'has', 'been', 'our', 'more', 'was', 'but'
  ]);
  
  words.forEach(word => {
    const lower = word.toLowerCase().replace(/[^a-zåäö0-9]/gi, '');
    // Filter out URL fragments, hex codes, technical artifacts
    if (lower.length > 3 && lower.length < 30 && !stopWords.has(lower) && !/^\d+$/.test(lower)
      && !/^[a-f0-9]{6,}$/i.test(lower)  // hex codes
      && !/^(https?|www|com|html|css|js|png|jpg|svg|webp|avif|woff|usm|enc|auto|static|media|wix)/i.test(lower) // URL/tech fragments
      && !/\d{3,}/.test(lower) // long number sequences
    ) {
      wordFrequency[lower] = (wordFrequency[lower] || 0) + 1;
    }
  });
  
  const sortedKeywords = Object.entries(wordFrequency)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15)
    .map(([keyword, count]) => ({
      keyword,
      count,
      density: word_count > 0 ? Math.round((count / word_count) * 1000) / 10 : 0,
    }));
  
  return {
    title_tag,
    meta_description,
    h1_count,
    h2_count,
    h3_count,
    word_count,
    internal_links_count,
    external_links_count,
    images_count,
    images_without_alt,
    is_https,
    has_canonical,
    canonical_url,
    has_open_graph,
    has_twitter_cards,
    mobile_friendly,
    primary_keywords: sortedKeywords,
    keyword_density: Object.fromEntries(sortedKeywords.slice(0, 5).map(k => [k.keyword, k.density])),
  };
}

async function checkRobotsTxt(baseUrl: string): Promise<boolean> {
  try {
    const url = new URL('/robots.txt', baseUrl);
    const response = await fetch(url.href, { 
      method: 'GET',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
    });
    if (!response.ok) return false;
    const text = await response.text();
    // Verify it's actually a robots.txt file (contains User-agent or Sitemap)
    return text.toLowerCase().includes('user-agent') || text.toLowerCase().includes('sitemap');
  } catch {
    return false;
  }
}

async function checkSitemap(baseUrl: string): Promise<boolean> {
  try {
    // Check common sitemap locations
    const sitemapUrls = [
      new URL('/sitemap.xml', baseUrl).href,
      new URL('/sitemap_index.xml', baseUrl).href,
    ];
    
    for (const sitemapUrl of sitemapUrls) {
      try {
        const response = await fetch(sitemapUrl, { 
          method: 'GET',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SEOBot/1.0)' },
        });
        if (response.ok) {
          const text = await response.text();
          // Verify it's actually XML with sitemap content
          if (text.includes('<?xml') && (text.includes('<urlset') || text.includes('<sitemapindex'))) {
            return true;
          }
        }
      } catch {
        continue;
      }
    }
    return false;
  } catch {
    return false;
  }
}

async function generateAiInsights(
  seoData: Partial<SeoAnalysisResult>,
  rankedKeywords: RankedKeyword[],
  url: string,
  apiKey: string,
  lighthouseSeoScore: number | null = null,
  lang: string = "svenska"
): Promise<{ summary: string; opportunities: any[]; estimatedKeywords: any[]; visibilityScore: number }> {
  const hasRealRankings = rankedKeywords.length > 0;
  // Without real Google rankings, prefer Lighthouse's standardized SEO score
  // (the same free score shown in the rest of the web analysis) so the number
  // stays consistent instead of using a separate home-grown on-page calc.
  const baseScore = (!hasRealRankings && typeof lighthouseSeoScore === 'number')
    ? lighthouseSeoScore
    : calculateVisibilityScore(seoData, rankedKeywords);
  
  // Format top keywords for AI context
  const topKeywordsContext = rankedKeywords.slice(0, 10).map(k => 
    `"${k.keyword}" (pos ${k.position}, ${k.search_volume} sökningar/mån, ${Math.round(k.traffic)} besök/mån)`
  ).join('\n');
  
  const keywordSummary = rankedKeywords.length > 0 
    ? `RIKTIGA GOOGLE-RANKINGAR (från DataForSEO):
Totalt antal rankade sökord: ${seoData.total_ranked_keywords || rankedKeywords.length}
Sökord i topp 10: ${seoData.top_positions || rankedKeywords.filter(k => k.position <= 10).length}
Uppskattat organisk trafik: ${seoData.total_organic_traffic || 0} besök/mån
Trafik värde: $${seoData.total_traffic_cost || 0}

Top 10 sökord efter sökvolym:
${topKeywordsContext}`
    : 'Inga Google-rankingar hittades för denna domän (ny eller liten sajt)';

  const prompt = `Du är en SEO-expert. Analysera följande FAKTISKA SEO-data för ${url} och ge:

1. En kort sammanfattning (max 150 ord) på ${lang} om webbplatsens synlighet i Google baserat på dessa FAKTISKA mätvärden
2. 3-5 konkreta förbättringsmöjligheter med prioritet (high/medium/low) baserat på de FAKTISKA bristerna
3. Identifiera 5 potential-sökord som webbplatsen borde fokusera på (baserat på innehåll och nuvarande rankingar)
4. Ge en visibility score 0-100 baserat på faktiska rankingar och on-page SEO

${keywordSummary}

ON-PAGE SEO-MÄTVÄRDEN:
- Titel (${seoData.title_tag ? seoData.title_tag.length + ' tecken' : 'SAKNAS'}): ${seoData.title_tag || 'Ingen titel hittad'}
- Meta-beskrivning (${seoData.meta_description ? seoData.meta_description.length + ' tecken' : 'SAKNAS'}): ${seoData.meta_description ? seoData.meta_description.substring(0, 100) + '...' : 'Ingen meta-beskrivning'}
- H1-taggar: ${seoData.h1_count} st
- H2-taggar: ${seoData.h2_count} st
- Ordantal: ${seoData.word_count} ord
- HTTPS: ${seoData.is_https ? 'JA - Säker anslutning' : 'NEJ - Osäker anslutning'}
- Canonical-tagg: ${seoData.has_canonical ? 'JA' : 'NEJ'}
- Open Graph: ${seoData.has_open_graph ? 'JA' : 'NEJ'}
- Robots.txt: ${seoData.has_robots_txt ? 'JA' : 'NEJ'}
- Sitemap.xml: ${seoData.has_sitemap ? 'JA' : 'NEJ'}
- Bilder: ${seoData.images_count} st (${seoData.images_without_alt} utan alt-text)

BERÄKNAD BASPOÄNG: ${baseScore}/100

VIKTIGT: Om sajten har sökord som rankar i Google, inkludera konkreta tips för att förbättra dessa positioner. Om sajten saknar rankingar, fokusera på grundläggande SEO och content-strategi.`;

  try {
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini-2.5-flash',
        messages: [
          { role: 'system', content: `Du är en SEO-expert som ger konkreta, säljbara insikter. Skriv ALLA textfält på ${lang}. Basera alltid dina svar på de faktiska mätvärdena - särskilt de riktiga Google-rankingarna från DataForSEO. Svara alltid med JSON.` },
          { role: 'user', content: prompt },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'seo_analysis',
              description: 'Return SEO analysis results based on actual metrics',
              parameters: {
                type: 'object',
                properties: {
                  summary: { type: 'string', description: 'Swedish summary based on actual metrics' },
                  opportunities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        description: { type: 'string' },
                        priority: { type: 'string', enum: ['high', 'medium', 'low'] },
                      },
                      required: ['title', 'description', 'priority'],
                    },
                  },
                  estimatedKeywords: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        keyword: { type: 'string' },
                        estimated_position: { type: 'string' },
                        opportunity: { type: 'string' },
                      },
                      required: ['keyword', 'estimated_position', 'opportunity'],
                    },
                  },
                  visibilityScore: { type: 'number', description: 'Score 0-100 based on actual Google rankings and on-page SEO' },
                },
                required: ['summary', 'opportunities', 'estimatedKeywords', 'visibilityScore'],
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'seo_analysis' } },
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      throw new Error('AI analysis failed');
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      // With real Google rankings we let the AI nudge the blended score; without
      // them the AI would just be guessing, so we trust the measured base score
      // (Lighthouse SEO / on-page) instead of a hallucinated number.
      return {
        summary: args.summary || 'Kunde inte generera sammanfattning',
        opportunities: args.opportunities || [],
        estimatedKeywords: args.estimatedKeywords || [],
        visibilityScore: hasRealRankings
          ? Math.min(100, Math.max(0, args.visibilityScore || baseScore))
          : baseScore,
      };
    }

    throw new Error('Invalid AI response format');
  } catch (error) {
    console.error('AI insights error:', error);
    // Return fallback data
    return {
      summary: at('seoFallbackSummary', lang),
      opportunities: [],
      estimatedKeywords: [],
      visibilityScore: baseScore,
    };
  }
}

function calculateVisibilityScore(seoData: Partial<SeoAnalysisResult>, rankedKeywords: RankedKeyword[]): number {
  const hasRankings = rankedKeywords.length > 0;

  // REAL RANKINGS (up to 50 points) — only when we actually have DataForSEO data.
  let rankingScore = 0;
  if (hasRankings) {
    // Keywords in top 3 (most valuable)
    const top3 = rankedKeywords.filter(k => k.position <= 3).length;
    rankingScore += Math.min(20, top3 * 4);

    // Keywords in top 10
    const top10 = rankedKeywords.filter(k => k.position > 3 && k.position <= 10).length;
    rankingScore += Math.min(15, top10 * 1.5);

    // Total traffic value
    const totalTraffic = rankedKeywords.reduce((sum, k) => sum + k.traffic, 0);
    if (totalTraffic > 1000) rankingScore += 10;
    else if (totalTraffic > 100) rankingScore += 5;
    else if (totalTraffic > 10) rankingScore += 2;

    // Keyword diversity
    if (rankedKeywords.length > 20) rankingScore += 5;
    else if (rankedKeywords.length > 10) rankingScore += 3;
  }

  // ON-PAGE SEO (up to 50 points)
  let onPageScore = 0;

  // Title (10 points)
  if (seoData.title_tag) {
    onPageScore += 6;
    const titleLen = seoData.title_tag.length;
    if (titleLen >= 30 && titleLen <= 60) onPageScore += 4;
    else if (titleLen > 10) onPageScore += 2;
  }

  // Meta description (10 points)
  if (seoData.meta_description) {
    onPageScore += 6;
    const descLen = seoData.meta_description.length;
    if (descLen >= 120 && descLen <= 160) onPageScore += 4;
    else if (descLen > 50) onPageScore += 2;
  }

  // H1 (5 points)
  const h1Count = seoData.h1_count ?? 0;
  if (h1Count === 1) onPageScore += 5;
  else if (h1Count > 1) onPageScore += 2;

  // HTTPS (5 points - critical)
  if (seoData.is_https) onPageScore += 5;

  // Technical SEO (15 points)
  if (seoData.has_canonical) onPageScore += 3;
  if (seoData.has_open_graph) onPageScore += 2;
  if (seoData.has_twitter_cards) onPageScore += 2;
  if (seoData.mobile_friendly) onPageScore += 3;
  if (seoData.has_robots_txt) onPageScore += 2;
  if (seoData.has_sitemap) onPageScore += 3;

  // Content (5 points)
  const wordCount = seoData.word_count || 0;
  if (wordCount > 1000) onPageScore += 5;
  else if (wordCount > 500) onPageScore += 3;
  else if (wordCount > 300) onPageScore += 2;

  // Without real Google ranking data, half the points are unreachable, which
  // unfairly caps a well-optimised site at ~50 and makes the score misleading.
  // In that case score purely on what we actually measured (on-page), scaled to
  // 0-100. The UI already labels this as "based on on-page SEO".
  if (!hasRankings) {
    return Math.min(100, Math.round(onPageScore * 2));
  }

  return Math.min(100, rankingScore + onPageScore);
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

    const { url, webAnalysisId, leadId, organizationId, market, language } = await req.json();
    const LANG_BY_MARKET: Record<string, string> = { SE: "svenska", US: "engelska", DE: "tyska", ES: "spanska", UK: "engelska", KR: "koreanska", CA: "engelska", AU: "engelska", IE: "engelska" };
    // The reader's UI language wins (the report is shown to the salesperson),
    // falling back to the prospect's market language, then Swedish.
    const LANG_BY_UI: Record<string, string> = { sv: "svenska", en: "engelska", es: "spanska" };
    const aiLang = LANG_BY_UI[String(language || "").toLowerCase()]
      || LANG_BY_MARKET[(market || "SE").toUpperCase()]
      || "svenska";

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: at('urlRequired', language) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get API keys
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    const dataForSeoLogin = Deno.env.get('DATAFORSEO_LOGIN');
    const dataForSeoPassword = Deno.env.get('DATAFORSEO_PASSWORD');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!firecrawlApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl-integration saknas. Aktivera den i inställningarna.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!geminiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: 'AI-nyckel (GEMINI_API_KEY) saknas' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const hasDataForSeo = dataForSeoLogin && dataForSeoPassword;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Format URL properly
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }
    // Remove trailing slashes for consistency
    formattedUrl = formattedUrl.replace(/\/+$/, '');

    // Extract domain for DataForSEO
    const urlObj = new URL(formattedUrl);
    const domain = urlObj.hostname.replace(/^www\./, '');

    console.log('Starting SEO analysis for:', formattedUrl, 'Domain:', domain);

    // Check for cached DataForSEO results (7 days cache)
    let cachedDataForSeo: {
      success: boolean;
      keywords?: RankedKeyword[];
      totalKeywords?: number;
      totalTraffic?: number;
      totalTrafficCost?: number;
      topPositions?: number;
      fromCache?: boolean;
    } | null = null;

    if (hasDataForSeo) {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Look for recent SEO analysis with DataForSEO data for this domain
      const { data: cachedAnalysis } = await supabase
        .from('seo_analyses')
        .select('raw_data, created_at')
        .ilike('url', `%${domain}%`)
        .gte('created_at', sevenDaysAgo.toISOString())
        .not('raw_data', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (cachedAnalysis?.raw_data && 
          typeof cachedAnalysis.raw_data === 'object' &&
          'ranked_keywords' in cachedAnalysis.raw_data &&
          Array.isArray((cachedAnalysis.raw_data as any).ranked_keywords) &&
          (cachedAnalysis.raw_data as any).ranked_keywords.length > 0) {
        
        const rawData = cachedAnalysis.raw_data as any;
        console.log('Using cached DataForSEO data from:', cachedAnalysis.created_at);
        cachedDataForSeo = {
          success: true,
          keywords: rawData.ranked_keywords || [],
          totalKeywords: rawData.total_ranked_keywords || 0,
          totalTraffic: rawData.total_organic_traffic || 0,
          totalTrafficCost: rawData.total_traffic_cost || 0,
          topPositions: rawData.top_positions || 0,
          fromCache: true,
        };
      }
    }

    // Step 1: Run all data gathering in parallel
    // Only call DataForSEO API if we don't have cached data
    const [scrapeResult, dataForSeoResult, hasRobots, hasSitemap] = await Promise.all([
      scrapeWithFirecrawl(formattedUrl, firecrawlApiKey),
      cachedDataForSeo 
        ? Promise.resolve(cachedDataForSeo)
        : (hasDataForSeo 
            ? fetchDataForSEO(domain, dataForSeoLogin!, dataForSeoPassword!)
            : Promise.resolve({ success: false, error: 'DataForSEO not configured' })),
      checkRobotsTxt(formattedUrl),
      checkSitemap(formattedUrl),
    ]);
    
    if (!scrapeResult.success || !scrapeResult.data) {
      const blockedMsg = scrapeResult.blocked
        ? `Sajten "${formattedUrl}" blockerar automatiserade verktyg (t.ex. bot-skydd), så SEO-datan kan inte hämtas. Siffrorna i en webbläsare kan se annorlunda ut.`
        : (scrapeResult.error || 'Kunde inte scrapa webbplatsen');
      // 200 so the client reads our message from the body.
      return new Response(
        JSON.stringify({ success: false, error: blockedMsg, errorCode: scrapeResult.blocked ? 'BLOCKED' : 'SCRAPE_FAILED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const automatedAccessBlocked = scrapeResult.blocked === true;
    const { html, markdown, links = [] } = scrapeResult.data;

    // Step 2: Extract on-page SEO metrics
    const seoMetrics = extractSeoMetrics(html || '', markdown || '', links, formattedUrl);
    seoMetrics.has_robots_txt = hasRobots;
    seoMetrics.has_sitemap = hasSitemap;

    // Step 3: Add DataForSEO results
    let rankedKeywords: RankedKeyword[] = [];
    let totalRankedKeywords = 0;
    let totalOrganicTraffic = 0;
    let totalTrafficCost = 0;
    let topPositions = 0;
    
    if (dataForSeoResult.success && 'keywords' in dataForSeoResult) {
      rankedKeywords = dataForSeoResult.keywords || [];
      totalRankedKeywords = dataForSeoResult.totalKeywords || 0;
      totalOrganicTraffic = dataForSeoResult.totalTraffic || 0;
      totalTrafficCost = dataForSeoResult.totalTrafficCost || 0;
      topPositions = dataForSeoResult.topPositions || 0;
    }
    
    seoMetrics.ranked_keywords = rankedKeywords;
    seoMetrics.total_ranked_keywords = totalRankedKeywords;
    seoMetrics.total_organic_traffic = totalOrganicTraffic;
    seoMetrics.total_traffic_cost = totalTrafficCost;
    seoMetrics.top_positions = topPositions;

    if (!dataForSeoResult.success && hasDataForSeo && 'error' in dataForSeoResult) {
      console.warn('DataForSEO failed:', dataForSeoResult.error);
    }
    
    // Log if we used cached data
    if ('fromCache' in dataForSeoResult && dataForSeoResult.fromCache) {
      console.log('DataForSEO: Used cached data (saved $0.05)');
    }

    // Pull the Lighthouse SEO score (free, standardized, already computed for
    // this URL by the web analysis) to use as the on-page basis when we have no
    // real keyword rankings.
    let lighthouseSeoScore: number | null = null;
    if (webAnalysisId) {
      const { data: wa } = await supabase
        .from('web_analyses')
        .select('seo_score')
        .eq('id', webAnalysisId)
        .maybeSingle();
      if (wa && typeof wa.seo_score === 'number') {
        lighthouseSeoScore = wa.seo_score;
      }
    }

    // Step 4: Generate AI insights with real keyword data
    const aiInsights = await generateAiInsights(seoMetrics, rankedKeywords, formattedUrl, geminiApiKey, lighthouseSeoScore, aiLang);

    // Combine all results
    const result: SeoAnalysisResult = {
      title_tag: seoMetrics.title_tag || null,
      meta_description: seoMetrics.meta_description || null,
      h1_count: seoMetrics.h1_count || 0,
      h2_count: seoMetrics.h2_count || 0,
      h3_count: seoMetrics.h3_count || 0,
      word_count: seoMetrics.word_count || 0,
      internal_links_count: seoMetrics.internal_links_count || 0,
      external_links_count: seoMetrics.external_links_count || 0,
      images_count: seoMetrics.images_count || 0,
      images_without_alt: seoMetrics.images_without_alt || 0,
      has_robots_txt: hasRobots,
      has_sitemap: hasSitemap,
      is_https: seoMetrics.is_https || false,
      has_canonical: seoMetrics.has_canonical || false,
      canonical_url: seoMetrics.canonical_url || null,
      has_open_graph: seoMetrics.has_open_graph || false,
      has_twitter_cards: seoMetrics.has_twitter_cards || false,
      mobile_friendly: seoMetrics.mobile_friendly || false,
      primary_keywords: seoMetrics.primary_keywords || [],
      keyword_density: seoMetrics.keyword_density || {},
      ranked_keywords: rankedKeywords,
      total_ranked_keywords: seoMetrics.total_ranked_keywords || 0,
      total_organic_traffic: seoMetrics.total_organic_traffic || 0,
      total_traffic_cost: seoMetrics.total_traffic_cost || 0,
      top_positions: seoMetrics.top_positions || 0,
      estimated_keywords: aiInsights.estimatedKeywords,
      visibility_score: aiInsights.visibilityScore,
      ai_summary: aiInsights.summary,
      ai_opportunities: aiInsights.opportunities,
      automated_access_blocked: automatedAccessBlocked,
    };

    // Step 5: Save to database if we have the organization context
    let savedId: string | null = null;
    if (organizationId) {
      const { data: savedData, error: saveError } = await supabase
        .from('seo_analyses')
        .insert({
          url: formattedUrl,
          organization_id: organizationId,
          web_analysis_id: webAnalysisId || null,
          lead_id: leadId || null,
          visibility_score: result.visibility_score,
          title_tag: result.title_tag,
          meta_description: result.meta_description,
          h1_count: result.h1_count,
          h2_count: result.h2_count,
          h3_count: result.h3_count,
          word_count: result.word_count,
          internal_links_count: result.internal_links_count,
          external_links_count: result.external_links_count,
          images_count: result.images_count,
          images_without_alt: result.images_without_alt,
          has_robots_txt: result.has_robots_txt,
          has_sitemap: result.has_sitemap,
          is_https: result.is_https,
          has_canonical: result.has_canonical,
          canonical_url: result.canonical_url,
          has_open_graph: result.has_open_graph,
          has_twitter_cards: result.has_twitter_cards,
          mobile_friendly: result.mobile_friendly,
          primary_keywords: result.primary_keywords,
          keyword_density: result.keyword_density,
          estimated_keywords: result.ranked_keywords.length > 0 
            ? result.ranked_keywords.slice(0, 20).map(k => ({
                keyword: k.keyword,
                position: k.position,
                search_volume: k.search_volume,
                traffic: k.traffic,
              }))
            : result.estimated_keywords,
          ai_summary: result.ai_summary,
          ai_opportunities: result.ai_opportunities,
          raw_data: {
            ranked_keywords: result.ranked_keywords,
            total_ranked_keywords: result.total_ranked_keywords,
            total_organic_traffic: result.total_organic_traffic,
            total_traffic_cost: result.total_traffic_cost,
            top_positions: result.top_positions,
            dataforseo_enabled: hasDataForSeo,
            automated_access_blocked: automatedAccessBlocked,
          },
        })
        .select('id')
        .single();

      if (saveError) {
        console.error('Error saving SEO analysis:', saveError);
      } else {
        savedId = savedData?.id || null;
        console.log('SEO analysis saved with ID:', savedId);
      }
    }

    console.log('SEO analysis complete:', {
      url: formattedUrl,
      visibility_score: result.visibility_score,
      is_https: result.is_https,
      ranked_keywords: rankedKeywords.length,
      total_traffic: result.total_organic_traffic,
      top_positions: result.top_positions,
      dataforseo_enabled: hasDataForSeo,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: result,
        savedId,
        webAnalysisId,
        leadId,
        dataForSeoEnabled: hasDataForSeo,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in SEO analysis:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Ett fel uppstod vid SEO-analysen' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
