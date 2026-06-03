const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface TechnicalAnalysisData {
  url: string;
  performance_score: number;
  accessibility_score: number;
  best_practices_score: number;
  seo_score: number;
  pwa_score?: number;
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
  performanceAudits?: Array<{ title: string; description: string }>;
  accessibilityAudits?: Array<{ title: string; description: string }>;
  seoAudits?: Array<{ title: string; description: string }>;
  bestPracticesAudits?: Array<{ title: string; description: string }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { analysisData } = await req.json() as { analysisData: TechnicalAnalysisData };

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

    // Build detailed technical context
    const performanceProblems = analysisData.performanceAudits?.slice(0, 5).map(a => `- ${a.title}`).join('\n') || '';
    const accessibilityProblems = analysisData.accessibilityAudits?.slice(0, 5).map(a => `- ${a.title}`).join('\n') || '';
    const seoProblems = analysisData.seoAudits?.slice(0, 5).map(a => `- ${a.title}`).join('\n') || '';
    const bestPracticesProblems = analysisData.bestPracticesAudits?.slice(0, 5).map(a => `- ${a.title}`).join('\n') || '';

    const prompt = `Du är en pedagogisk webbteknisk expert. Din uppgift är att förklara tekniska webbanalysresultat på ett lättförståeligt och lärorikt sätt. Användaren är inte teknisk men vill förstå VARFÖR resultatet blev som det blev.

Webbplats: ${analysisData.url}

POÄNG (0-100):
- Prestanda: ${analysisData.performance_score}/100
- Tillgänglighet: ${analysisData.accessibility_score}/100
- Best Practices: ${analysisData.best_practices_score}/100
- SEO: ${analysisData.seo_score}/100
${analysisData.pwa_score !== undefined ? `- PWA: ${analysisData.pwa_score}/100` : ''}

CORE WEB VITALS (Googles viktigaste mätvärden):
- First Contentful Paint (FCP): ${Math.round(analysisData.metrics.firstContentfulPaint)}ms
  → Hur snabbt det första synliga innehållet visas
- Largest Contentful Paint (LCP): ${Math.round(analysisData.metrics.largestContentfulPaint)}ms
  → Hur snabbt huvudinnehållet (största bilden/texten) laddas. Bör vara under 2500ms.
- Speed Index: ${Math.round(analysisData.metrics.speedIndex)}ms
  → Hur snabbt sidan visuellt fylls med innehåll
- Total Blocking Time (TBT): ${Math.round(analysisData.metrics.totalBlockingTime)}ms
  → Tid då sidan inte svarar på klick/input. Bör vara under 200ms.
- Cumulative Layout Shift (CLS): ${analysisData.metrics.cumulativeLayoutShift.toFixed(3)}
  → Hur mycket element "hoppar runt" när sidan laddas. Bör vara under 0.1.
- Time to Interactive (TTI): ${Math.round(analysisData.metrics.timeToInteractive)}ms
  → När sidan blir helt interaktiv

FÖRBÄTTRINGSMÖJLIGHETER (vad som kan göras bättre):
${analysisData.opportunities.map(o => `- ${o.title}${o.savings ? ` (potentiell besparing: ${o.savings})` : ''}`).join('\n') || 'Inga specifika'}

DIAGNOSTISKA PROBLEM:
${analysisData.diagnostics.map(d => `- ${d.title}`).join('\n') || 'Inga specifika'}

${performanceProblems ? `PRESTANDA-PROBLEM:\n${performanceProblems}` : ''}
${accessibilityProblems ? `\nTILLGÄNGLIGHETS-PROBLEM:\n${accessibilityProblems}` : ''}
${seoProblems ? `\nSEO-PROBLEM:\n${seoProblems}` : ''}
${bestPracticesProblems ? `\nBEST PRACTICES-PROBLEM:\n${bestPracticesProblems}` : ''}

---

Skriv en PEDAGOGISK TEKNISK FÖRKLARING som hjälper användaren förstå:

## 🔍 Varför ser resultatet ut så här?

Förklara på ett enkelt sätt varför poängen blev som de blev. Om prestanda är låg (under 50), förklara varför en sida som "ser bra ut" ändå kan få dåliga poäng. Använd vardagliga liknelser.

## 📊 Vad betyder mätvärdena?

Gå igenom de viktigaste Core Web Vitals och förklara vad de faktiska värdena innebär. Använd trafikljus-logik: 🟢 Bra, 🟡 Behöver förbättras, 🔴 Dåligt.

## 🎓 Lär dig mer

Ge 2-3 korta "visste du att"-fakta om webbprestanda som är relevanta för denna analys. T.ex. "Visste du att 53% av mobilanvändare lämnar en sida som tar mer än 3 sekunder att ladda?"

## 🛠️ Tekniska åtgärder förklarat

Lista de 3-5 viktigaste tekniska problemen och förklara VAD de är och VARFÖR de påverkar resultatet, på ett sätt som en icke-teknisk person förstår.

Skriv på svenska. Var pedagogisk och uppmuntrande, inte dömande. Hjälp användaren förstå att dessa saker går att åtgärda.`;

    console.log('Generating technical AI summary for:', analysisData.url);

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
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: 'För många förfrågningar. Vänta en stund och försök igen.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: 'AI-krediter slut. Kontakta administratören.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI Gateway error:', errorText);
      return new Response(
        JSON.stringify({ success: false, error: 'Kunde inte generera teknisk sammanfattning' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResult = await response.json();
    const summary = aiResult.choices?.[0]?.message?.content || 'Ingen sammanfattning genererad';

    console.log('Technical summary generated successfully');

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error generating technical summary:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Ett fel uppstod' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
