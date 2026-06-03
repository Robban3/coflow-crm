import { validateFirecrawlRequest } from "../_shared/validation.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, x-supabase-client-platform, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ExtractedData {
  companyName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  orgNumber?: string;
  description?: string;
  industry?: string;
  socialLinks?: {
    linkedin?: string;
    facebook?: string;
    twitter?: string;
    instagram?: string;
  };
  logoUrl?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate request body
    const rawBody = await req.json();
    const validation = validateFirecrawlRequest(rawBody);
    
    if (!validation.success || !validation.data) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error || 'URL krävs' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { url } = validation.data;

    const apiKey = Deno.env.get('FIRECRAWL_API_KEY');
    if (!apiKey) {
      console.error('FIRECRAWL_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Firecrawl-integration är inte konfigurerad' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format URL
    let formattedUrl = url.trim();
    if (!formattedUrl.startsWith('http://') && !formattedUrl.startsWith('https://')) {
      formattedUrl = `https://${formattedUrl}`;
    }

    console.log('Extracting company data from:', formattedUrl);

    // Use Firecrawl's scrape endpoint with markdown format
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: formattedUrl,
        formats: ['markdown'],
        onlyMainContent: false, // We need full page to find contact info in footer
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Firecrawl API error:', data);
      return new Response(
        JSON.stringify({ success: false, error: data.error || `Firecrawl-fel: ${response.status}` }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the data from response
    const markdown = data.data?.markdown || data.markdown || '';
    const metadata = data.data?.metadata || data.metadata || {};

    // Parse company information from markdown and metadata
    const extractedData: ExtractedData = {
      companyName: extractCompanyName(metadata.title, formattedUrl),
      contactName: undefined, // Hard to extract reliably
      email: extractEmail(markdown),
      phone: extractPhone(markdown),
      address: undefined, // Would need more sophisticated parsing
      orgNumber: extractOrgNumber(markdown),
      description: metadata.description || undefined,
      industry: undefined,
      socialLinks: extractSocialLinks(markdown),
      logoUrl: undefined,
    };

    console.log('Extraction complete:', {
      companyName: extractedData.companyName,
      hasEmail: !!extractedData.email,
      hasPhone: !!extractedData.phone,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: extractedData,
        sourceUrl: formattedUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting data:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Ett fel uppstod vid extrahering' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper: Extract company name from page title
function extractCompanyName(title: string | undefined, url: string): string | undefined {
  if (title) {
    // Remove common suffixes
    let name = title
      .split('|')[0]
      .split('-')[0]
      .split('–')[0]
      .split('•')[0]
      .trim();
    
    // Remove common words
    name = name
      .replace(/\s*(AB|HB|KB|Aktiebolag|Handelsbolag|Kommanditbolag)\s*$/i, '')
      .trim();
    
    if (name.length > 2) {
      return name;
    }
  }
  
  // Fallback: extract from URL
  try {
    const hostname = new URL(url).hostname;
    const domain = hostname.replace(/^www\./, '').split('.')[0];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch {
    return undefined;
  }
}

// Helper: Extract email from markdown
function extractEmail(text: string): string | undefined {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex);
  if (matches) {
    // Filter out common non-contact emails and prioritize info/kontakt emails
    const filtered = matches.filter(email => 
      !email.includes('example.com') && 
      !email.includes('placeholder') &&
      !email.includes('noreply') &&
      !email.includes('no-reply') &&
      !email.includes('@sentry') &&
      !email.includes('wixpress')
    );
    
    // Prioritize common contact emails
    const priority = filtered.find(e => 
      e.startsWith('info@') || 
      e.startsWith('kontakt@') || 
      e.startsWith('contact@') ||
      e.startsWith('hej@')
    );
    
    return priority || filtered[0];
  }
  return undefined;
}

// Helper: Extract phone from markdown
function extractPhone(text: string): string | undefined {
  // Swedish phone patterns
  const patterns = [
    // International format: +46 XX XXX XX XX
    /\+46[\s-]?\d{1,3}[\s-]?\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}/g,
    // Swedish format: 0XX-XXX XX XX or 0XX XXX XX XX
    /0\d{1,3}[\s-]\d{2,3}[\s-]?\d{2,3}[\s-]?\d{2}/g,
    // Mobile: 07X-XXX XX XX
    /07\d[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}/g,
  ];
  
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      return matches[0].trim();
    }
  }
  return undefined;
}

// Helper: Extract Swedish org number
function extractOrgNumber(text: string): string | undefined {
  // Swedish org number: 6 digits, dash/space, 4 digits
  const orgRegex = /\b(\d{6})[-\s]?(\d{4})\b/g;
  const matches = text.match(orgRegex);
  if (matches) {
    // Format consistently
    const match = matches[0];
    const clean = match.replace(/\s/g, '-');
    // Validate it looks like an org number (starts with correct digits)
    if (/^[125-9]\d{5}-\d{4}$/.test(clean)) {
      return clean;
    }
  }
  return undefined;
}

// Helper: Extract social media links
function extractSocialLinks(text: string): ExtractedData['socialLinks'] {
  const links: ExtractedData['socialLinks'] = {};
  
  const linkedinMatch = text.match(/https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_-]+/i);
  if (linkedinMatch) links.linkedin = linkedinMatch[0];
  
  const facebookMatch = text.match(/https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9._-]+/i);
  if (facebookMatch) links.facebook = facebookMatch[0];
  
  const twitterMatch = text.match(/https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[a-zA-Z0-9_]+/i);
  if (twitterMatch) links.twitter = twitterMatch[0];
  
  const instagramMatch = text.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9._]+/i);
  if (instagramMatch) links.instagram = instagramMatch[0];
  
  return Object.keys(links).length > 0 ? links : undefined;
}