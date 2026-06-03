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
    const { analysisData } = await req.json() as { analysisData: AnalysisData };

    if (!analysisData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Analysdata krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) {
      console.error('LOVABLE_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'AI-tjänsten är inte konfigurerad' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a prompt for generating the summary
    const prompt = `Du är en expert på webbprestanda och SEO. Analysera följande webbplatsresultat och ge en sammanfattning på svenska som är lätt att förstå för både kunden och säljare.

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

Håll språket enkelt och undvik teknisk jargong. Fokusera på affärsvärdet och användarupplevelsen.`;

    console.log('Generating AI summary for:', analysisData.url);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunde inte generera sammanfattning' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const summary = aiResult.choices?.[0]?.message?.content || 'Ingen sammanfattning genererad';

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
        error: error instanceof Error ? error.message : 'Ett fel uppstod' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
