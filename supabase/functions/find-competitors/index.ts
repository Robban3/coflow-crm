import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SearchRequest {
  query: string;
  location?: string;
  excludeUrl?: string;
  limit?: number;
}

interface PlaceResult {
  id: string;
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  websiteUri?: string;
  rating?: number;
}

serve(async (req) => {
  // Handle CORS
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

    const { query, location, excludeUrl, limit = 5 }: SearchRequest = await req.json();

    if (!query) {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const GOOGLE_PLACES_API_KEY = Deno.env.get('GOOGLE_PLACES_API_KEY');
    
    if (!GOOGLE_PLACES_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'Google Places API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use Places API (New) - Text Search
    const searchQuery = location ? `${query} in ${location}` : `${query} i Sverige`;
    
    const searchUrl = 'https://places.googleapis.com/v1/places:searchText';
    
    const requestBody = {
      textQuery: searchQuery,
      languageCode: 'sv',
      regionCode: 'SE',
      maxResultCount: Math.min(limit + 3, 20), // Get a few extra to account for filtering
    };

    const searchResponse = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.websiteUri,places.rating',
      },
      body: JSON.stringify(requestBody),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Google Places API (New) error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to search for competitors', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const searchData = await searchResponse.json();
    const results: PlaceResult[] = searchData.places || [];

    // Normalize URL for comparison
    const normalizeUrl = (url: string): string => {
      try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        return parsed.hostname.replace('www.', '').toLowerCase();
      } catch {
        return url.toLowerCase();
      }
    };

    const excludeNormalized = excludeUrl ? normalizeUrl(excludeUrl) : null;

    // Process results
    const competitors: Array<{
      name: string;
      address: string;
      website?: string;
      rating?: number;
      placeId: string;
    }> = [];

    for (const place of results) {
      // Skip if this is the same URL as the lead's website
      if (place.websiteUri && excludeNormalized) {
        const competitorNormalized = normalizeUrl(place.websiteUri);
        if (competitorNormalized === excludeNormalized) {
          continue;
        }
      }

      competitors.push({
        name: place.displayName?.text || 'Okänt företag',
        address: place.formattedAddress || '',
        website: place.websiteUri,
        rating: place.rating,
        placeId: place.id,
      });

      if (competitors.length >= limit) {
        break;
      }
    }

    return new Response(
      JSON.stringify({ 
        competitors,
        query: searchQuery,
        totalFound: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in find-competitors:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
