const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface PhoneNumber {
  number: string;
  operator: string | null;
  type: string | null;
}

interface Vehicle {
  model: string;
  regNumber: string | null;
  color: string | null;
  type: string | null;
  year: number | null;
}

interface FleetDataResult {
  success: boolean;
  data?: {
    vehicleCount: number | null;
    vehicles: Vehicle[];
    phoneSubscriptionCount: number | null;
    phoneNumbers: PhoneNumber[];
    phoneOperator: string | null;
    leasingCompany: string | null;
    sourceUrl: string | null;
    rawData: Record<string, unknown>;
  };
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgNumber, companyName } = await req.json();

    if (!orgNumber && !companyName) {
      return new Response(
        JSON.stringify({ success: false, error: 'Org-nummer eller företagsnamn krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl-anslutning ej konfigurerad' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Find the company page URL on merinfo.se
    const searchTerm = orgNumber ? orgNumber.replace(/\D/g, '') : companyName;
    const searchQuery = `site:merinfo.se/foretag ${searchTerm}`;

    console.log('Step 1: Searching for company page:', searchQuery);

    const searchResponse = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: searchQuery,
        limit: 5,
      }),
    });

    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error('Search error:', errorData);
      return new Response(
        JSON.stringify({ success: false, error: `Sökning misslyckades: ${errorData.error || searchResponse.status}` }),
        { status: searchResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const results = searchData?.data || [];
    
    // Find the base company URL.
    let companyBaseUrl: string | null = null;
    for (const result of results) {
      const url = String(result?.url || '').trim();
      if (!url) continue;

      // Accept merinfo company pages, but strip any known subpage suffix
      if (url.includes('merinfo.se/foretag/')) {
        companyBaseUrl = url
          .replace(/\/(telefonnummer|telefoner|fordon)(\/.*)?$/i, '')
          .replace(/\/$/, '');
        break;
      }
    }

    if (!companyBaseUrl) {
      console.log('No company page found');
      return new Response(
        JSON.stringify({ success: false, error: 'Kunde inte hitta företaget på merinfo.se' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Found company base URL:', companyBaseUrl);

    // Step 2: Scrape the vehicles page and phones page
    const vehiclesUrl = `${companyBaseUrl}/fordon`;
    const phonesUrl = `${companyBaseUrl}/telefonnummer`; // Fixed: was /telefoner, correct is /telefonnummer

    console.log('Step 2: Scraping subpages:', { vehiclesUrl, phonesUrl });

    // Scrape both pages in parallel - add waitFor for dynamic content
    const [vehiclesResponse, phonesResponse] = await Promise.all([
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: vehiclesUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false, // Get full page to capture tables
          waitFor: 3000, // Wait 3 seconds for dynamic content
        }),
      }),
      fetch('https://api.firecrawl.dev/v1/scrape', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: phonesUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: false, // Get full page to capture tables
          waitFor: 5000, // Wait 5 seconds for phone data to load (often requires JS)
        }),
      }),
    ]);

    const vehiclesData = vehiclesResponse.ok ? await vehiclesResponse.json() : null;
    const phonesData = phonesResponse.ok ? await phonesResponse.json() : null;

    console.log('Vehicles response status:', vehiclesResponse.status);
    console.log('Phones response status:', phonesResponse.status);

    // Parse the scraped data - try markdown first, then HTML
    const vehiclesMarkdown = vehiclesData?.data?.markdown || vehiclesData?.markdown || '';
    const vehiclesHtml = vehiclesData?.data?.html || vehiclesData?.html || '';
    const phonesMarkdown = phonesData?.data?.markdown || phonesData?.markdown || '';
    const phonesHtml = phonesData?.data?.html || phonesData?.html || '';

    console.log('Vehicles markdown length:', vehiclesMarkdown.length);
    console.log('Vehicles HTML length:', vehiclesHtml.length);
    console.log('Phones markdown length:', phonesMarkdown.length);
    console.log('Phones HTML length:', phonesHtml.length);
    console.log('Phones markdown preview:', phonesMarkdown.slice(0, 2000));
    console.log('Phones HTML preview:', phonesHtml.slice(0, 3000));

    const result = parseFleetData(vehiclesMarkdown, vehiclesHtml, phonesMarkdown, phonesHtml, companyBaseUrl);
    
    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error fetching fleet data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Okänt fel';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Normalize Swedish phone number to a consistent format
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Handle international prefixes like 0046
  if (cleaned.startsWith('0046')) {
    cleaned = '+46' + cleaned.slice(4);
  }
  
  // Convert +46 to 0
  if (cleaned.startsWith('+46')) {
    cleaned = '0' + cleaned.slice(3);
  } else if (cleaned.startsWith('46') && cleaned.length > 9) {
    cleaned = '0' + cleaned.slice(2);
  }
  
  // Format nicely: 08-123 456 78 or 070-123 45 67
  if (cleaned.length === 10 && cleaned.startsWith('0')) {
    if (cleaned.startsWith('07') || cleaned.startsWith('08')) {
      // Mobile or Stockholm: 07X-XXX XX XX or 08-XXX XXX XX
      if (cleaned.startsWith('07')) {
        return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)} ${cleaned.slice(6, 8)} ${cleaned.slice(8)}`;
      } else {
        return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`;
      }
    }
  } else if (cleaned.length === 9 && cleaned.startsWith('0')) {
    // Shorter format: 0X-XXX XX XX
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2, 5)} ${cleaned.slice(5, 7)} ${cleaned.slice(7)}`;
  }
  
  return cleaned;
}

// Key used for de-duplication: keep digits only and normalize Swedish country code
function phoneDedupeKey(phone: string): string {
  let digits = phone.replace(/\D/g, '');
  // 0046XXXXXXXXX -> 46XXXXXXXXX
  if (digits.startsWith('0046')) digits = digits.slice(2);
  // 46XXXXXXXXX -> 0XXXXXXXXX
  if (digits.startsWith('46')) digits = '0' + digits.slice(2);
  return digits;
}

function parseFleetData(
  vehiclesMarkdown: string, 
  vehiclesHtml: string,
  phonesMarkdown: string, 
  phonesHtml: string,
  sourceUrl: string
): FleetDataResult {
  // Parse vehicles
  let vehicleCount: number | null = null;
  const vehicles: Vehicle[] = [];

  // Look for "Totalt antal fordon: X" pattern
  const totalVehiclesMatch = vehiclesMarkdown.match(/Totalt antal fordon[:\s]+(\d+)/i);
  if (totalVehiclesMatch) {
    vehicleCount = parseInt(totalVehiclesMatch[1], 10);
  }

  // Parse individual vehicles from table rows
  const vehicleTablePattern = /\|\s*\[?([^\]|]+)\]?\s*\|\s*([A-Z0-9]{5,7})?\s*\|\s*([^\|]+)?\s*\|\s*([^\|]+)?\s*\|\s*(\d{4})?\s*\|/gi;
  let vehicleMatch;
  while ((vehicleMatch = vehicleTablePattern.exec(vehiclesMarkdown)) !== null) {
    const model = vehicleMatch[1]?.trim();
    if (model && !model.includes('Märke') && !model.includes('modell') && model.length > 2) {
      vehicles.push({
        model: model.replace(/\[|\]/g, '').trim(),
        regNumber: vehicleMatch[2]?.trim() || null,
        color: vehicleMatch[3]?.trim() || null,
        type: vehicleMatch[4]?.trim() || null,
        year: vehicleMatch[5] ? parseInt(vehicleMatch[5], 10) : null,
      });
    }
  }

  // Alternative parsing for different markdown formats
  if (vehicles.length === 0) {
    const vehicleLinePattern = /^([A-Za-zÅÄÖåäöé\s\d.]+?)\s+([A-Z]{2,3}\d{2,3}[A-Z]?)\s+(Vit|Svart|Grå|Blå|Röd|Grön|Silver|Brun|Beige|Orange|Gul)\s+([A-Za-zÅÄÖåäö\s]+?)\s+(\d{4})/gm;
    let lineMatch;
    while ((lineMatch = vehicleLinePattern.exec(vehiclesMarkdown)) !== null) {
      vehicles.push({
        model: lineMatch[1]?.trim() || '',
        regNumber: lineMatch[2]?.trim() || null,
        color: lineMatch[3]?.trim() || null,
        type: lineMatch[4]?.trim() || null,
        year: lineMatch[5] ? parseInt(lineMatch[5], 10) : null,
      });
    }
  }

  if (vehicleCount === null && vehicles.length > 0) {
    vehicleCount = vehicles.length;
  }

  // Parse phones - combine markdown and HTML parsing
  let phoneSubscriptionCount: number | null = null;
  const phoneNumbersSet = new Map<string, PhoneNumber>(); // key = phoneDedupeKey
  let phoneOperator: string | null = null;

  // Look for phone count
  const phoneCountPatterns = [
    /(\d+)\s*(?:st\s+)?telefonnummer/i,
    /Telefonnummer[:\s]*(\d+)/i,
    /(\d+)\s*telefon/i,
  ];
  
  const combinedPhoneText = phonesMarkdown + ' ' + phonesHtml;
  
  for (const pattern of phoneCountPatterns) {
    const match = combinedPhoneText.match(pattern);
    if (match && match[1]) {
      phoneSubscriptionCount = parseInt(match[1], 10);
      break;
    }
  }

  // 1) Prefer parsing the markdown table (most accurate: includes operator + type)
  // Example row:
  // | [08-128 603 01](tel:+46812860301) | ... | Tele2 Sverige AB | ... | ... | Fast |
  const mdLines = phonesMarkdown.split(/\r?\n/);
  for (const line of mdLines) {
    if (!line.trim().startsWith('|')) continue;
    // Skip header/separator rows
    if (line.includes('Telefonnummer') && line.includes('Operatör')) continue;
    if (/^\|\s*-{2,}\s*\|/i.test(line.trim())) continue;

    const cols = line
      .split('|')
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
    if (cols.length < 3) continue;

    const rawNumberCol = cols[0];
    const rawOperatorCol = cols[2];
    const rawTypeCol = cols[5] ?? null;

    // Extract human-readable number (prefer the visible text inside [..])
    const bracketMatch = rawNumberCol.match(/\[([^\]]+)\]/);
    const fallbackTelMatch = rawNumberCol.match(/tel:([^\)\s]+)/i);
    const rawNumber = (bracketMatch?.[1] || fallbackTelMatch?.[1] || rawNumberCol).trim();
    const key = phoneDedupeKey(rawNumber);
    if (key.length < 8) continue;

    const normalizedPretty = normalizePhoneNumber(rawNumber);
    const operator = rawOperatorCol && !/kontakta oss/i.test(rawOperatorCol) ? rawOperatorCol : null;
    const type = rawTypeCol && !/kontakta oss/i.test(rawTypeCol) ? rawTypeCol : null;

    if (!phoneNumbersSet.has(key)) {
      phoneNumbersSet.set(key, {
        number: normalizedPretty,
        operator,
        type,
      });
    } else {
      // Enrich existing entry
      const existing = phoneNumbersSet.get(key)!;
      if (!existing.operator && operator) existing.operator = operator;
      if (!existing.type && type) existing.type = type;
    }
  }

  // 2) Fallback: Swedish phone number patterns (HTML + markdown)
  const phonePatterns = [
    // Standard formats with area code
    /(?:^|\s|>|\|)(\+?46[-\s]?\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,4})(?:\s|<|\||$)/g,
    /(?:^|\s|>|\|)(0\d{1,3}[-\s]?\d{2,3}[-\s]?\d{2,3}[-\s]?\d{2,4})(?:\s|<|\||$)/g,
    // Mobile numbers
    /(?:^|\s|>|\|)(07\d[-\s]?\d{3}[-\s]?\d{2}[-\s]?\d{2})(?:\s|<|\||$)/g,
    // Stockholm numbers
    /(?:^|\s|>|\|)(08[-\s]?\d{3}[-\s]?\d{3}[-\s]?\d{2})(?:\s|<|\||$)/g,
    // href="tel:" links
    /href="tel:([^"]+)"/gi,
    // Any digit sequence that looks like a phone (10-13 digits)
    /(?:^|\s|>|\|)((?:\+46|0)\d{8,11})(?:\s|<|\||$)/g,
  ];

  // Extract from HTML first (more reliable for structured data)
  for (const pattern of phonePatterns) {
    let match;
    // Reset lastIndex for global patterns
    pattern.lastIndex = 0;
    while ((match = pattern.exec(phonesHtml)) !== null) {
      let rawNumber = match[1]?.trim();
      if (!rawNumber) continue;
      
      // Clean up HTML entities and extra chars
      rawNumber = rawNumber.replace(/&nbsp;/g, ' ').replace(/%20/g, ' ');
      
      // Validate - must have enough digits
      const digitCount = (rawNumber.match(/\d/g) || []).length;
      if (digitCount < 8 || digitCount > 15) continue;
      
      const normalizedPretty = normalizePhoneNumber(rawNumber);
      const key = phoneDedupeKey(rawNumber);
      if (key.length >= 8 && !phoneNumbersSet.has(key)) {
        phoneNumbersSet.set(key, {
          number: normalizedPretty,
          operator: null,
          type: null,
        });
      }
    }
  }

  // Also try markdown
  for (const pattern of phonePatterns) {
    let match;
    pattern.lastIndex = 0;
    while ((match = pattern.exec(phonesMarkdown)) !== null) {
      let rawNumber = match[1]?.trim();
      if (!rawNumber) continue;
      
      const digitCount = (rawNumber.match(/\d/g) || []).length;
      if (digitCount < 8 || digitCount > 15) continue;
      
      const normalizedPretty = normalizePhoneNumber(rawNumber);
      const key = phoneDedupeKey(rawNumber);
      if (key.length >= 8 && !phoneNumbersSet.has(key)) {
        phoneNumbersSet.set(key, {
          number: normalizedPretty,
          operator: null,
          type: null,
        });
      }
    }
  }

  // Determine operator based on extracted phone rows (avoid picking up unrelated words on the page)
  const operatorCounts = new Map<string, number>();
  for (const p of phoneNumbersSet.values()) {
    if (!p.operator) continue;
    operatorCounts.set(p.operator, (operatorCounts.get(p.operator) || 0) + 1);
  }
  if (operatorCounts.size > 0) {
    let maxCount = 0;
    for (const [op, count] of operatorCounts) {
      if (count > maxCount) {
        maxCount = count;
        phoneOperator = op;
      }
    }
  }

  // Convert map to array
  const phoneNumbers = Array.from(phoneNumbersSet.values());

  // Update operator for all phones
  if (phoneOperator) {
    for (const phone of phoneNumbers) {
      if (!phone.operator) {
        phone.operator = phoneOperator;
      }
    }
  }

  // Set phone count from array if not found
  if (phoneSubscriptionCount === null && phoneNumbers.length > 0) {
    phoneSubscriptionCount = phoneNumbers.length;
  }

  // Parse leasing company from vehicles page
  let leasingCompany: string | null = null;
  const leasingPatterns = [
    /(LeasePlan|Arval|ALD|Athlon|Alphabet|Northmill|Drivalia|Volkswagen Finans|Volvofinans|Toyota Financial|BMW Financial)/i,
  ];
  
  for (const pattern of leasingPatterns) {
    const match = vehiclesMarkdown.match(pattern);
    if (match && match[1]) {
      leasingCompany = match[1].trim();
      break;
    }
  }

  // Check if we found any useful data
  const hasData = vehicleCount !== null || vehicles.length > 0 || 
                  phoneSubscriptionCount !== null || phoneNumbers.length > 0;
  
  if (!hasData) {
    return { 
      success: false, 
      error: 'Kunde inte extrahera fordons- eller telefonidata. Datan kan saknas för detta företag.' 
    };
  }

  return {
    success: true,
    data: {
      vehicleCount,
      vehicles,
      phoneSubscriptionCount,
      phoneNumbers,
      phoneOperator,
      leasingCompany,
      sourceUrl,
      rawData: {
        vehiclesMarkdownPreview: vehiclesMarkdown.slice(0, 2000),
        phonesMarkdownPreview: phonesMarkdown.slice(0, 2000),
        phonesHtmlPreview: phonesHtml.slice(0, 3000),
      },
    },
  };
}
