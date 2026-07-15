import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { callAI, AI_MODELS } from "../_shared/ai.ts";
import { at } from "../_shared/analysisText.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AnalysisData {
  url: string;
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  metrics: {
    firstContentfulPaint: number;
    largestContentfulPaint: number;
    speedIndex: number;
    totalBlockingTime: number;
    cumulativeLayoutShift: number;
    timeToInteractive: number;
  };
  opportunities: Array<{
    id: string;
    title: string;
    description: string;
    savings?: string;
  }>;
  diagnostics: Array<{
    id: string;
    title: string;
    description: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { analysisData, market } = await req.json() as { analysisData: AnalysisData; market?: string };
    const LANG_BY_MARKET: Record<string, string> = { SE: "svenska", US: "engelska", DE: "tyska", ES: "spanska", UK: "engelska", KR: "koreanska", CA: "engelska", AU: "engelska", IE: "engelska" };
    const lang = LANG_BY_MARKET[(market || "SE").toUpperCase()] || "svenska";

    if (!analysisData) {
      return new Response(
        JSON.stringify({ success: false, error: at('analysisDataRequired', lang) }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }


    // Create a prompt for generating the summary
    const prompt = `Du är en expert på webbprestanda och SEO. Analysera följande webbplatsresultat och ge en sammanfattning på ${lang} som är lätt att förstå för både kunden och säljare.

Webbplats: ${analysisData.url}

POÄNG (0-100, där 90+ är bra, 50-89 behöver förbättras, under 50 är dåligt):
- Prestanda: ${analysisData.performance_score}
- Tillgänglighet: ${analysisData.accessibility_score}
- Best Practices: ${analysisData.best_practices_score}
- SEO: ${analysisData.seo_score}

MÄTVÄRDEN:
- First Contentful Paint: ${Math.round(analysisData.metrics.firstContentfulPaint)}ms (hur snabbt första innehållet visas)
- Largest Contentful Paint: ${Math.round(analysisData.metrics.largestContentfulPaint)}ms (hur snabbt huvudinnehållet visas)
- Speed Index: ${Math.round(analysisData.metrics.speedIndex)}ms
- Total Blocking Time: ${Math.round(analysisData.metrics.totalBlockingTime)}ms
- Cumulative Layout Shift: ${analysisData.metrics.cumulativeLayoutShift.toFixed(3)} (hur mycket sidan "hoppar")

FÖRBÄTTRINGSMÖJLIGHETER:
${analysisData.opportunities.map(o => `- ${o.title}${o.savings ? ` (kan spara ${o.savings})` : ''}`).join('\n') || 'Inga specifika'}

PROBLEM:
${analysisData.diagnostics.map(d => `- ${d.title}`).join('\n') || 'Inga specifika'}

Skriv din analys i följande format:

1. **ÖVERGRIPANDE BETYG** (en kort, tydlig sammanfattning i 1-2 meningar)

2. **VAD BETYDER DETTA FÖR BESÖKARE?** (förklara i vanlig svenska vad resultatet innebär för användare av hemsidan)

3. **SÄLJARGUMENT** (2-3 konkreta säljargument en webbyrå kan använda, formulerade som påståenden som visar problemet och möjligheten)

4. **PRIORITERADE FÖRBÄTTRINGAR** (topp 3 åtgärder som bör göras, i prioriteringsordning)

Håll språket enkelt och undvik teknisk jargong. Fokusera på affärsvärdet och användarupplevelsen.

VIKTIGT: Skriv HELA svaret på ${lang}.`;

    console.log('Generating AI summary for:', analysisData.url);

    const aiResult = await callAI({
      model: AI_MODELS.claude,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      maxTokens: 1500,
    });
    const summary = aiResult.choices?.[0]?.message?.content || at('noSummaryGenerated', lang);

    console.log('Summary generated successfully');

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating summary:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'An error occurred'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
