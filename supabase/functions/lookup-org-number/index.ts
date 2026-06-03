const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const FIRECRAWL_API_KEY = Deno.env.get('FIRECRAWL_API_KEY');

interface LookupRequest {
  companyName: string;
}

interface LookupResult {
  success: boolean;
  orgNumber?: string;
  companyName?: string;
  sourceUrl?: string;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyName }: LookupRequest = await req.json();

    if (!companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Företagsnamn krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!FIRECRAWL_API_KEY) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl är inte konfigurerat' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up org number for: ${companyName}`);

    // Search on Allabolag.se first (most reliable for Swedish companies)
    const searchQuery = `site:allabolag.se ${companyName} organisationsnummer`;
    
    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 3,
        scrapeOptions: {
          formats: ['markdown'],
        },
      }),
    });

    const searchData = await searchResponse.json();

    if (!searchResponse.ok) {
      console.error('Firecrawl search error:', searchData);
      return new Response(
        JSON.stringify({ success: false, error: 'Sökning misslyckades' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Search results:', JSON.stringify(searchData, null, 2));

    // Parse the results to find org number
    const results = searchData.data || searchData.results || [];
    let foundOrgNumber: string | null = null;
    let foundCompanyName: string | null = null;
    let sourceUrl: string | null = null;

    // Org number patterns (Swedish format: XXXXXX-XXXX or 10 digits)
    const orgNumberPatterns = [
      /(?:org\.?(?:anisations)?(?:nummer|nr)?\.?|organisationsnummer)[\s:]*(\d{6}[-\s]?\d{4})/gi,
      /\b(\d{6}[-]\d{4})\b/g, // Standard format with dash
      /(?:org\.?\s*nr\.?)[\s:]+(\d{10})/gi, // 10 digits without dash
    ];

    for (const result of results) {
      const content = result.markdown || result.content || result.description || '';
      const url = result.url || result.sourceUrl || '';
      
      // Skip if not from Allabolag or merinfo
      if (!url.includes('allabolag.se') && !url.includes('merinfo.se')) {
        continue;
      }

      // Try to extract org number
      for (const pattern of orgNumberPatterns) {
        // Reset lastIndex for global regex
        pattern.lastIndex = 0;
        const match = pattern.exec(content);
        if (match) {
          let orgNum = match[1].replace(/\s/g, '');
          
          // Ensure proper format with dash
          if (orgNum.length === 10 && !orgNum.includes('-')) {
            orgNum = orgNum.substring(0, 6) + '-' + orgNum.substring(6);
          }
          
          // Validate it looks like a real org number (starts with reasonable digits)
          if (/^\d{6}-\d{4}$/.test(orgNum)) {
            foundOrgNumber = orgNum;
            sourceUrl = url;
            
            // Try to extract company name from the result
            const titleMatch = content.match(/^#?\s*([^\n]+)/);
            if (titleMatch) {
              foundCompanyName = titleMatch[1].replace(/[-|]/g, '').trim();
            }
            
            break;
          }
        }
      }

      if (foundOrgNumber) break;
    }

    // If no result from Allabolag, try merinfo.se
    if (!foundOrgNumber) {
      const merinfoQuery = `site:merinfo.se ${companyName}`;
      
      const merinfoResponse = await fetch('https://api.firecrawl.dev/v1/search', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: merinfoQuery,
          limit: 3,
          scrapeOptions: {
            formats: ['markdown'],
          },
        }),
      });

      const merinfoData = await merinfoResponse.json();
      
      if (merinfoResponse.ok) {
        const merinfoResults = merinfoData.data || merinfoData.results || [];
        
        for (const result of merinfoResults) {
          const content = result.markdown || result.content || result.description || '';
          const url = result.url || result.sourceUrl || '';
          
          for (const pattern of orgNumberPatterns) {
            pattern.lastIndex = 0;
            const match = pattern.exec(content);
            if (match) {
              let orgNum = match[1].replace(/\s/g, '');
              
              if (orgNum.length === 10 && !orgNum.includes('-')) {
                orgNum = orgNum.substring(0, 6) + '-' + orgNum.substring(6);
              }
              
              if (/^\d{6}-\d{4}$/.test(orgNum)) {
                foundOrgNumber = orgNum;
                sourceUrl = url;
                break;
              }
            }
          }
          
          if (foundOrgNumber) break;
        }
      }
    }

    if (foundOrgNumber) {
      console.log(`Found org number: ${foundOrgNumber} from ${sourceUrl}`);
      
      return new Response(
        JSON.stringify({
          success: true,
          orgNumber: foundOrgNumber,
          companyName: foundCompanyName || companyName,
          sourceUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('No org number found');
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Inget organisationsnummer hittades. Kontrollera företagsnamnet.',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in lookup-org-number:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
