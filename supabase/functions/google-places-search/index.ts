import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { validateGooglePlacesRequest } from "../_shared/validation.ts";
import { getAuthenticatedUserId } from "../_shared/auth.ts";
import { fetchWithRetry } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PlaceResult {
  placeId: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  userRatingsTotal?: number;
  types?: string[];
  openNow?: boolean;
  lat?: number;
  lng?: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Require an authenticated user – this function calls the paid Google Places API
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_PLACES_API_KEY");
    if (!apiKey) {
      throw new Error("GOOGLE_PLACES_API_KEY not configured");
    }

    const rawBody = await req.json();
    const validation = validateGooglePlacesRequest(rawBody);

    if (!validation.success) {
      return new Response(
        JSON.stringify({ success: false, error: validation.error || "Invalid request" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { query, location, radius = 50000, market: marketRaw } = validation.data || rawBody;
    // Optional: locationBias for geo-offset pagination
    const locationBias: { lat: number; lng: number; radius: number } | undefined = rawBody.locationBias;
    // Optional: placeIds to exclude (dedup across pages)
    const excludePlaceIds: string[] = rawBody.excludePlaceIds || [];

    // Normalize market (default SE)
    const marketUpper = (marketRaw || "SE").toString().toUpperCase();
    const market: "SE" | "US" | "DE" | "ES" =
      marketUpper === "US" || marketUpper === "DE" || marketUpper === "ES" ? marketUpper : "SE";

    const MARKET_CONFIG: Record<"SE" | "US" | "DE" | "ES", {
      regionCode: string;
      languageCode: string;
      countryName: string;
      countryAliases: string[];
    }> = {
      SE: { regionCode: "SE", languageCode: "sv", countryName: "Sverige", countryAliases: ["sverige", "sweden"] },
      US: { regionCode: "US", languageCode: "en", countryName: "USA", countryAliases: ["usa", "united states", "u.s.", "us"] },
      DE: { regionCode: "DE", languageCode: "de", countryName: "Deutschland", countryAliases: ["deutschland", "germany"] },
      ES: { regionCode: "ES", languageCode: "es", countryName: "España", countryAliases: ["españa", "espana", "spain"] },
    };
    const cfg = MARKET_CONFIG[market];

    if (!query) {
      throw new Error("Search query is required");
    }

    // Build text query with location
    let textQuery = query;
    if (location) {
      const locationLower = location.toLowerCase();
      const hasCountry = cfg.countryAliases.some((a) => locationLower.includes(a)) ||
                         locationLower.includes(",");
      textQuery = hasCountry ? `${query} in ${location}` : `${query} in ${location}, ${cfg.countryName}`;
    } else {
      // No location: still anchor query to country for US/DE so we don't get global/Swedish defaults
      const queryLower = query.toLowerCase();
      const hasCountry = cfg.countryAliases.some((a) => queryLower.includes(a));
      if (!hasCountry && market !== "SE") {
        textQuery = `${query} in ${cfg.countryName}`;
      }
    }

    console.log(`Searching Google Places [${market}]: "${textQuery}"${locationBias ? ` with bias (${locationBias.lat}, ${locationBias.lng}, r=${locationBias.radius})` : ""}`);

    const searchUrl = "https://places.googleapis.com/v1/places:searchText";

    const requestBody: Record<string, unknown> = {
      textQuery: textQuery,
      maxResultCount: 20,
      languageCode: cfg.languageCode,
      regionCode: cfg.regionCode,
    };

    // Add locationBias if provided (for geo-offset pagination)
    if (locationBias) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: locationBias.lat,
            longitude: locationBias.lng,
          },
          radius: locationBias.radius,
        },
      };
    }

    const searchRes = await fetchWithRetry(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.regularOpeningHours,places.location",
      },
      body: JSON.stringify(requestBody),
    }, { timeoutMs: 30_000, label: "Google Places" });

    const searchData = await searchRes.json();

    if (searchData.error) {
      console.error("Google Places API error:", searchData.error);
      throw new Error(`Google Places API error: ${searchData.error.message || searchData.error.status}`);
    }

    const excludeSet = new Set(excludePlaceIds);
    const results: PlaceResult[] = [];

    for (const place of searchData.places || []) {
      const id = place.id;
      if (excludeSet.has(id)) continue; // Skip already-seen results
      results.push({
        placeId: id,
        name: place.displayName?.text || "",
        address: place.formattedAddress || "",
        phone: place.nationalPhoneNumber,
        website: place.websiteUri,
        rating: place.rating,
        userRatingsTotal: place.userRatingCount,
        types: place.types,
        openNow: place.regularOpeningHours?.openNow,
        lat: place.location?.latitude,
        lng: place.location?.longitude,
      });
    }

    // Compute center of results for geo-offset pagination
    let center: { lat: number; lng: number } | null = null;
    const withCoords = results.filter(r => r.lat && r.lng);
    if (withCoords.length > 0) {
      const avgLat = withCoords.reduce((s, r) => s + r.lat!, 0) / withCoords.length;
      const avgLng = withCoords.reduce((s, r) => s + r.lng!, 0) / withCoords.length;
      center = { lat: avgLat, lng: avgLng };
    }

    console.log(`Found ${results.length} places (excluded ${excludePlaceIds.length} dupes)`);

    return new Response(
      JSON.stringify({
        success: true,
        results,
        totalResults: results.length,
        center, // Return center for geo-offset pagination
        hasMore: results.length >= 15, // Likely more results available if we got close to 20
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in google-places-search:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
