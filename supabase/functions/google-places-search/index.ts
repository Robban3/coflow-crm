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

// Geocode a city/locality to its viewport rectangle so we can HARD-restrict the
// text search to that area. Places searchText's text locality ("in Göteborg")
// alone is only a weak bias — prominent chains (e.g. BASTA) leak in from other
// cities — so we geocode and pass a locationRestriction rectangle. Returns null
// on failure (e.g. Geocoding API not enabled) → caller falls back to text scoping.
async function geocodeViewport(
  location: string,
  countryName: string,
  regionCode: string,
  apiKey: string,
): Promise<{ low: { lat: number; lng: number }; high: { lat: number; lng: number } } | null> {
  try {
    const addr = encodeURIComponent(`${location}, ${countryName}`);
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${addr}&region=${regionCode.toLowerCase()}&key=${apiKey}`;
    const res = await fetchWithRetry(url, {}, { timeoutMs: 10_000, label: "Geocode" });
    const data = await res.json();
    if (data.status !== "OK" || !data.results?.length) {
      console.warn(`[geocode] status=${data.status} for "${location}"`);
      return null;
    }
    const vp = data.results[0].geometry?.viewport;
    if (!vp?.northeast || !vp?.southwest) return null;
    return {
      low: { lat: vp.southwest.lat, lng: vp.southwest.lng },
      high: { lat: vp.northeast.lat, lng: vp.northeast.lng },
    };
  } catch (e) {
    console.warn("[geocode] failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
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
    const market: "SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA" =
      marketUpper === "US" || marketUpper === "DE" || marketUpper === "ES" || marketUpper === "UK" || marketUpper === "KR" || marketUpper === "CA" ? marketUpper : "SE";

    const MARKET_CONFIG: Record<"SE" | "US" | "DE" | "ES" | "UK" | "KR" | "CA", {
      regionCode: string;
      languageCode: string;
      countryName: string;
      countryAliases: string[];
      // Optional hard bounding box (locationRestriction.rectangle) for the country.
      // US is intentionally omitted (Alaska/Hawaii/antimeridian make a single box wrong).
      bbox?: { low: { lat: number; lng: number }; high: { lat: number; lng: number } };
    }> = {
      SE: { regionCode: "SE", languageCode: "sv", countryName: "Sverige", countryAliases: ["sverige", "sweden"], bbox: { low: { lat: 55.0, lng: 10.5 }, high: { lat: 69.1, lng: 24.2 } } },
      US: { regionCode: "US", languageCode: "en", countryName: "USA", countryAliases: ["usa", "united states", "u.s.", "us"] },
      DE: { regionCode: "DE", languageCode: "de", countryName: "Deutschland", countryAliases: ["deutschland", "germany"], bbox: { low: { lat: 47.2, lng: 5.8 }, high: { lat: 55.1, lng: 15.1 } } },
      ES: { regionCode: "ES", languageCode: "es", countryName: "España", countryAliases: ["españa", "espana", "spain"], bbox: { low: { lat: 27.6, lng: -18.2 }, high: { lat: 43.9, lng: 4.4 } } },
      UK: { regionCode: "GB", languageCode: "en", countryName: "United Kingdom", countryAliases: ["uk", "united kingdom", "great britain", "gb", "england", "scotland", "wales"], bbox: { low: { lat: 49.9, lng: -8.65 }, high: { lat: 60.9, lng: 1.8 } } },
      KR: { regionCode: "KR", languageCode: "ko", countryName: "South Korea", countryAliases: ["korea", "south korea", "republic of korea", "kr", "대한민국", "한국", "sydkorea"], bbox: { low: { lat: 33.0, lng: 124.5 }, high: { lat: 38.7, lng: 131.0 } } },
      CA: { regionCode: "CA", languageCode: "en", countryName: "Canada", countryAliases: ["canada", "ca", "kanada"], bbox: { low: { lat: 41.6, lng: -141.0 }, high: { lat: 83.2, lng: -52.6 } } },
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

    // Geographic constraint. locationRestriction and locationBias are mutually
    // exclusive:
    //  - "Load more" → the pagination circle bias.
    //  - A city/location was given → NO rectangle: the text query
    //    ("query in {city}, {country}") scopes to the city, and the country
    //    post-filter (addressComponents) keeps foreign results out. A country-wide
    //    rectangle here would override the city and return results nationwide.
    //  - No city → hard-restrict to the country's bounding box so a broad search
    //    (e.g. "restaurang") can't return foreign (e.g. German) places, since
    //    regionCode alone is only a bias in Places API v1, not a filter.
    let cityBox: { low: { lat: number; lng: number }; high: { lat: number; lng: number } } | null = null;
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
    } else if (location) {
      // Hard-restrict to the city's geographic box when we can geocode it, so a
      // city search stays in that city. If geocoding is unavailable, fall back to
      // text scoping (the query already contains "in {city}, {country}") + the
      // country post-filter below.
      cityBox = await geocodeViewport(location, cfg.countryName, cfg.regionCode, apiKey);
      if (cityBox) {
        requestBody.locationRestriction = {
          rectangle: {
            low: { latitude: cityBox.low.lat, longitude: cityBox.low.lng },
            high: { latitude: cityBox.high.lat, longitude: cityBox.high.lng },
          },
        };
        console.log(`[places] city viewport restriction for "${location}"`);
      } else {
        console.log(`[places] no geocode for "${location}" — text scoping only`);
      }
    } else if (cfg.bbox) {
      requestBody.locationRestriction = {
        rectangle: {
          low: { latitude: cfg.bbox.low.lat, longitude: cfg.bbox.low.lng },
          high: { latitude: cfg.bbox.high.lat, longitude: cfg.bbox.high.lng },
        },
      };
    }

    const searchRes = await fetchWithRetry(searchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.types,places.regularOpeningHours,places.location",
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
    let droppedForeign = 0;

    for (const place of searchData.places || []) {
      const id = place.id;
      if (excludeSet.has(id)) continue; // Skip already-seen results

      // Hard country filter: drop places whose country doesn't match the market.
      // regionCode/locationBias are only soft biases, so without this German (etc.)
      // results leak into a Swedish search. Keep places where country is undeterminable.
      const countryComp = (place.addressComponents || []).find(
        (c: { types?: string[] }) => (c.types || []).includes("country"),
      );
      const countryCode = countryComp?.shortText?.toUpperCase();
      if (countryCode && countryCode !== cfg.regionCode) {
        droppedForeign++;
        continue;
      }

      // City guard: when we geocoded the city, drop anything whose coordinates
      // fall outside its viewport (belt-and-suspenders on the rectangle).
      if (cityBox) {
        const lat = place.location?.latitude;
        const lng = place.location?.longitude;
        if (
          typeof lat === "number" && typeof lng === "number" &&
          (lat < cityBox.low.lat || lat > cityBox.high.lat ||
           lng < cityBox.low.lng || lng > cityBox.high.lng)
        ) {
          droppedForeign++;
          continue;
        }
      }

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

    if (droppedForeign > 0) {
      console.log(`[google-places-search] Filtered out ${droppedForeign} result(s) outside ${cfg.regionCode}`);
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
